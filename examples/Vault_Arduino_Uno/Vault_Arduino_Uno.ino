#include <Arduino.h>
#include <SoftwareSerial.h>
#include "CommandLine.h"

#if !defined(__AVR_ATmega328P__) || F_CPU != 16000000UL
#error "This sketch targets the 16 MHz ATmega328P Arduino Uno R3, not an Uno R4."
#endif

// Preserve the supplied sketch's pins and same-direction 90 -> 0 movement.
const uint8_t SERVO1_PIN=9,SERVO2_PIN=10;
const uint8_t LOCKED_ANGLE[2]={90,90};
const uint8_t UNLOCKED_ANGLE[2]={0,0}; // Swap these with LOCKED_ANGLE if mechanics are reversed.
const uint16_t STEP_INTERVAL_MS=50; // Original speed: 1 degree per 50 ms.
const uint16_t MIN_PULSE_US=544,MAX_PULSE_US=2400; // Servo.h defaults used by the supplied sketch.
const uint8_t COMMAND_RX_PIN=2,UNUSED_TX_PIN=3;
const bool DEBUG_SERIAL=true;

SoftwareSerial esp(COMMAND_RX_PIN,UNUSED_TX_PIN); // RX only in the wiring; leave D3 unconnected.
CommandLine espLine,usbLine;
uint8_t currentAngle[2]={90,90},targetAngle[2]={90,90};
bool servoEnabled=false,localOverride=false;
uint32_t lastStepAt=0;

uint16_t pulseTicks(uint8_t angle){return (MIN_PULSE_US+uint32_t(angle)*(MAX_PULSE_US-MIN_PULSE_US)/180)*2;}
void writePositions(){OCR1A=pulseTicks(currentAngle[0]);OCR1B=pulseTicks(currentAngle[1]);}
void enableServos(){
  if(servoEnabled)return;
  // Timer1 directly generates both pulses. Serial interrupts cannot stretch them.
  // This replaces Servo.h for these two fixed pins; do not also load Servo.h.
  digitalWrite(SERVO1_PIN,LOW);digitalWrite(SERVO2_PIN,LOW);
  pinMode(SERVO1_PIN,OUTPUT);pinMode(SERVO2_PIN,OUTPUT);
  TCCR1A=0;TCCR1B=0;TCNT1=0;ICR1=39999;writePositions();
  TCCR1A=_BV(COM1A1)|_BV(COM1B1)|_BV(WGM11);
  TCCR1B=_BV(WGM13)|_BV(WGM12)|_BV(CS11); // 16MHz / 8 / 40000 = 50Hz.
  servoEnabled=true;lastStepAt=millis();
}
void setDoor(bool unlock){
  for(uint8_t i=0;i<2;i++)targetAngle[i]=unlock?UNLOCKED_ANGLE[i]:LOCKED_ANGLE[i];
  enableServos(); // No startup sweep: wait for an explicit bridge/USB command.
}
void stepServos(uint32_t now){
  if(!servoEnabled||uint32_t(now-lastStepAt)<STEP_INTERVAL_MS)return;
  lastStepAt=now;
  for(uint8_t i=0;i<2;i++){if(currentAngle[i]<targetAngle[i])currentAngle[i]++;else if(currentAngle[i]>targetAngle[i])currentAngle[i]--;}
  writePositions(); // A repeated command doesn't restart the motion.
}
void status(){
  if(!DEBUG_SERIAL||Serial.availableForWrite()<55)return;
  Serial.print(localOverride?F("LOCAL "):F("ESP "));
  Serial.print(servoEnabled?F("PWM ON "):F("PWM OFF "));
  Serial.print(currentAngle[0]);Serial.print('/');Serial.print(currentAngle[1]);
  Serial.print(F(" -> "));Serial.print(targetAngle[0]);Serial.print('/');Serial.println(targetAngle[1]);
}
void receiveEsp(const char* line){
  if(localOverride)return;
  const WireCommand command=decodeWire(line);
  if(command==WireCommand::Lock)setDoor(false);
  else if(command==WireCommand::Unlock)setDoor(true);
}
void receiveUsb(const char* line){
  if(strcmp(line,"OPEN")==0){localOverride=true;setDoor(true);status();}
  else if(strcmp(line,"CLOSE")==0){localOverride=true;setDoor(false);status();}
  else if(strcmp(line,"AUTO")==0){localOverride=false;status();}
  else if(strcmp(line,"STATUS")==0)status();
}
void setup(){
  Serial.begin(115200);esp.begin(9600);
  digitalWrite(COMMAND_RX_PIN,LOW); // Remove SoftwareSerial's 5V pull-up on the 3.3V link.
  if(DEBUG_SERIAL)Serial.println(F("Vault Uno ready. USB: OPEN / CLOSE / AUTO / STATUS + newline."));
}
void loop(){
  uint32_t now=millis();espLine.expire(now);usbLine.expire(now);
  while(esp.available()){const char* line=espLine.feed(esp.read(),millis());if(line)receiveEsp(line);}
  while(Serial.available()){const char* line=usbLine.feed(Serial.read(),millis());if(line)receiveUsb(line);}
  stepServos(millis());
}
