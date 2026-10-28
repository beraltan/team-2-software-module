#include <Arduino.h>
#include <WiFi.h>
#include <OOCSI.h>
#include "HeistGate.h"
#include "RemoteChecks.h"

#if !CONFIG_IDF_TARGET_ESP32S3
#error "Select ESP32S3 Dev Module for this sketch."
#endif
// Arduino ESP32 core 3.x. OOCSI 1.6.0 and ArduinoJson 7.x.
const char* WIFI_SSID="YOUR_WIFI_NAME";
const char* WIFI_PASSWORD="YOUR_WIFI_PASSWORD";
const char* TEAM_CHANNEL="OOCSI-things/team-2";
const char* DEVICE_NAME="team2_vault_direct_########";
const uint8_t SERVO_PINS[2]={4,5};
const uint8_t LOCKED_ANGLE[2]={90,90},UNLOCKED_ANGLE[2]={0,0};
const uint16_t MIN_PULSE_US=544,MAX_PULSE_US=2400; // Preserve supplied Servo.h angle mapping.
const uint16_t STEP_MS=50; // Both together: one degree per 50ms, as supplied.
const uint8_t PWM_BITS=14;
const uint32_t STATUS_MS=1000;

OOCSI oocsi;
vault::HeistGate gate;
vault::Command commanded=vault::Command::None;
bool configured=false,manualMode=false,heistActive=false,servoEnabled=false,servoError=false,statusDirty=true;
uint8_t angles[2]={90,90},targets[2]={90,90};
uint32_t lastStepAt=0,lastStatusAt=0,lastSubscribeAt=0,statusSequence=0;
char deviceId[32],bootId[9];
String lastRequestId="",lastRequestResult="";
String requestIds[16];uint8_t requestIndex=0;

const char* commandName(){return commanded==vault::Command::Unlock?"unlock":commanded==vault::Command::Lock?"lock":"none";}
bool moving(){return servoEnabled&&(angles[0]!=targets[0]||angles[1]!=targets[1]);}
uint32_t pulseDuty(uint8_t angle){const uint32_t us=MIN_PULSE_US+uint32_t(angle)*(MAX_PULSE_US-MIN_PULSE_US)/180;return (us*((1UL<<PWM_BITS)-1)+10000)/20000;}
void writeAngles(){for(uint8_t i=0;i<2;i++)ledcWrite(SERVO_PINS[i],pulseDuty(angles[i]));}
bool enableServos(){
  if(servoEnabled)return true;
  for(uint8_t i=0;i<2;i++){
    if(!ledcAttach(SERVO_PINS[i],50,PWM_BITS)){
      for(uint8_t j=0;j<2;j++){ledcDetach(SERVO_PINS[j]);pinMode(SERVO_PINS[j],OUTPUT);digitalWrite(SERVO_PINS[j],LOW);}
      servoError=true;statusDirty=true;return false;
    }
  }
  servoEnabled=true;servoError=false;writeAngles();lastStepAt=millis();return true;
}
void applyCommand(vault::Command c){
  if(c==vault::Command::None)return;
  commanded=c;for(uint8_t i=0;i<2;i++)targets[i]=c==vault::Command::Unlock?UNLOCKED_ANGLE[i]:LOCKED_ANGLE[i];
  if(enableServos()&&!manualMode)gate.noteSent(c);
  statusDirty=true;
}
void rejectRequest(const String& id,const char* reason){lastRequestId=id;lastRequestResult=reason;statusDirty=true;}
void receiveControl(){
  if(oocsi.getString("device_id","")!=deviceId||oocsi.getString("boot_id","")!=bootId)return;
  const String id=oocsi.getString("request_id","");if(id.isEmpty()||id.length()>64)return;
  for(const String& previous:requestIds)if(previous==id)return;
  requestIds[requestIndex++%16]=id;
  const long reference=oocsi.getLong("status_seq",-1);
  const String scope=oocsi.getString("scope","");
  const String session=oocsi.getString("requester_session","");
  const char* rejection=vault::rejectRemote(scope.c_str(),session.c_str(),reference,statusSequence,gate,millis(),heistActive);
  if(*rejection){rejectRequest(id,rejection);return;}
  const String command=oocsi.getString("command","");
  if(command=="auto"){manualMode=false;}
  else if(command=="unlock"||command=="lock"){manualMode=true;applyCommand(command=="unlock"?vault::Command::Unlock:vault::Command::Lock);}
  else{rejectRequest(id,"invalid_command");return;}
  lastRequestId=id;lastRequestResult="accepted";statusDirty=true;
}
void receiveMessage(){
  if(oocsi.getRecipient()!=TEAM_CHANNEL)return;
  if(oocsi.getString("module","")=="vault_control"){receiveControl();return;}
  const String session=oocsi.getString("toktik_session","");if(session.isEmpty())return;
  const String round=oocsi.getString("toktik_round_id","");
  const String state=oocsi.getString("heist_state","");
  const String phase=oocsi.getString("heist_phase","");
  const vault::Beat b={session.c_str(),round.c_str(),state.c_str(),phase.c_str(),oocsi.getLong("toktik_beat",-1),oocsi.getBool("heist_navigation_complete",false),oocsi.getBool("laser_solved",false),oocsi.getBool("skidule_solved",false),oocsi.getBool("morse_solved",false)};
  if(gate.ingest(b,millis()))heistActive=state=="armed"||state=="running";
}
void publishStatus(){
  int current[2]={angles[0],angles[1]},target[2]={targets[0],targets[1]};
  oocsi.newMessage(TEAM_CHANNEL);oocsi.addString("module","vault_door");oocsi.addString("event","state");
  oocsi.addString("device_id",deviceId);oocsi.addString("boot_id",bootId);oocsi.addLong("seq",++statusSequence);
  oocsi.addString("mode",manualMode?"manual":"auto");oocsi.addString("commanded",commandName());
  oocsi.addString("motion",servoError?"error":!servoEnabled?"disabled":moving()?"moving":"at_target");
  oocsi.addIntArray("angles",current,2);oocsi.addIntArray("target_angles",target,2);oocsi.addBool("servo_confirmed",false);
  oocsi.addString("controller_link",gate.conflict()?"conflict":gate.fresh(millis())?"fresh":"waiting");
  oocsi.addString("controller_session",gate.owner());oocsi.addString("round_id",gate.round());
  oocsi.addString("request_id",lastRequestId.c_str());oocsi.addString("request_result",lastRequestResult.c_str());
  oocsi.sendMessage();lastStatusAt=millis();statusDirty=false;
}
void checkUsb(){
  while(Serial.available()){
    const char c=Serial.read();
    if(c=='U'||c=='u'){manualMode=true;applyCommand(vault::Command::Unlock);}
    if(c=='L'||c=='l'){manualMode=true;applyCommand(vault::Command::Lock);}
    if(c=='A'||c=='a'){manualMode=false;statusDirty=true;}
    if((c=='S'||c=='s')&&Serial&&Serial.availableForWrite()>=64)Serial.printf("Vault %s; %s; targets %d/%d; no position sensor\n",manualMode?"manual":"auto",commandName(),targets[0],targets[1]);
  }
}
void setup(){
  Serial.begin(115200);
#if ARDUINO_USB_CDC_ON_BOOT
  Serial.setTxTimeoutMs(0);
#endif
  for(uint8_t pin:SERVO_PINS){pinMode(pin,OUTPUT);digitalWrite(pin,LOW);} // No sweep until commanded.
  snprintf(bootId,sizeof(bootId),"%08lx",static_cast<unsigned long>(esp_random()));
  snprintf(deviceId,sizeof(deviceId),"team2-vault-%06lx",static_cast<unsigned long>(ESP.getEfuseMac()&0xffffff));
  oocsi.setLogging(false);
  if(strcmp(WIFI_SSID,"YOUR_WIFI_NAME")==0)return;
  configured=true;oocsi.connect(DEVICE_NAME,"oocsi.id.tue.nl",WIFI_SSID,WIFI_PASSWORD,receiveMessage);oocsi.subscribe(TEAM_CHANNEL);lastSubscribeAt=millis();
}
void loop(){
  checkUsb();if(configured)oocsi.check();const uint32_t now=millis();
  if(!manualMode&&gate.canSend(now)){if(gate.command()!=commanded)applyCommand(gate.command());else if(servoEnabled)gate.noteSent(commanded);}
  if(servoEnabled&&uint32_t(now-lastStepAt)>=STEP_MS){
    const bool wasMoving=moving();lastStepAt=now;
    for(uint8_t i=0;i<2;i++){if(angles[i]<targets[i])angles[i]++;else if(angles[i]>targets[i])angles[i]--;}
    writeAngles();if(wasMoving&&!moving())statusDirty=true;
  }
  if(configured&&uint32_t(now-lastSubscribeAt)>=5000){oocsi.subscribe(TEAM_CHANNEL);lastSubscribeAt=now;}
  if(configured&&(statusDirty||uint32_t(now-lastStatusAt)>=STATUS_MS))publishStatus();
  delay(2);
}
