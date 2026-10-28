#include <Arduino.h>
#include <WiFi.h>
#include <OOCSI.h>
#include "HeistGate.h"
#include "PolicyChecks.h"  // Compile-time policy checks; no runtime code.

// ESP32-S3 Dev Module, Arduino ESP32 core 3.x, OOCSI 1.6.0, ArduinoJson 7.x.
// Fill these in locally; never publish Wi-Fi passwords.
const char* WIFI_SSID="YOUR_WIFI_NAME";
const char* WIFI_PASSWORD="YOUR_WIFI_PASSWORD";
const char* TEAM_CHANNEL="OOCSI-things/team-2";
const char* OOCSI_SERVER="oocsi.id.tue.nl";
const char* DEVICE_NAME="team2_vault_bridge_########";

const int UNO_COMMAND_TX=4; // ESP GPIO4 -> Uno D2 (RX).
const int UNUSED_UART_RX=5; // Leave unconnected. NEVER connect a 5V Uno TX here.
const uint32_t COMMAND_REPEAT_MS=1000;
const uint32_t STATUS_INTERVAL_MS=5000;

HardwareSerial uno(1);
OOCSI oocsi;
vault::HeistGate gate;
vault::Command lastCommand=vault::Command::None,manualCommand=vault::Command::None;
bool configured=false,manualMode=false;
uint32_t lastCommandAt=0,lastStatusAt=0,lastSubscribeAt=0;

const char* commandName(vault::Command cmd){return cmd==vault::Command::Unlock?"unlock":cmd==vault::Command::Lock?"lock":"none";}

void sendCommand(vault::Command cmd){
  if(cmd==vault::Command::None)return;
  uno.println(cmd==vault::Command::Unlock?"VAULT1,UNLOCK":"VAULT1,LOCK");
  if(!manualMode)gate.noteSent(cmd);
  lastCommand=cmd;lastCommandAt=millis();
}

void receiveHeist(){
  if(oocsi.getRecipient()!=TEAM_CHANNEL)return;
  const String session=oocsi.getString("toktik_session","");
  if(session.isEmpty())return; // ESP inputs and terminal/solved events aren't commands.
  const String round=oocsi.getString("toktik_round_id","");
  const String state=oocsi.getString("heist_state","");
  const String phase=oocsi.getString("heist_phase","");
  const vault::Beat b={session.c_str(),round.c_str(),state.c_str(),phase.c_str(),oocsi.getLong("toktik_beat",-1),
    oocsi.getBool("heist_navigation_complete",false),oocsi.getBool("laser_solved",false),
    oocsi.getBool("skidule_solved",false),oocsi.getBool("morse_solved",false)};
  gate.ingest(b,millis());
}

void sendStatus(){
  oocsi.newMessage(TEAM_CHANNEL);
  oocsi.addString("module","vault_bridge");oocsi.addString("event","state");
  oocsi.addString("device_id","team2-vault");
  oocsi.addString("mode",manualMode?"manual":"auto");
  oocsi.addString("commanded",commandName(lastCommand));
  oocsi.addString("controller_session",gate.owner());oocsi.addString("round_id",gate.round());
  oocsi.addString("controller_link",gate.conflict()?"conflict":gate.fresh(millis())?"fresh":"waiting");
  oocsi.addBool("servo_confirmed",false); // One-way command wire: no physical feedback.
  oocsi.sendMessage();
}

// Optional USB calibration. Commands need no line ending and never gate normal play.
// U=manual unlock, L=manual lock, A=automatic heist mode. S=print local status.
void checkUsb(){
  while(Serial.available()){
    const char c=Serial.read();
    if(c=='u'||c=='U'){manualMode=true;manualCommand=vault::Command::Unlock;sendCommand(manualCommand);}
    if(c=='l'||c=='L'){manualMode=true;manualCommand=vault::Command::Lock;sendCommand(manualCommand);}
    if(c=='a'||c=='A'){manualMode=false;manualCommand=vault::Command::None;gate=vault::HeistGate();}
    if((c=='s'||c=='S')&&Serial&&Serial.availableForWrite()>=80)Serial.printf("Mode: %s; last command: %s; controller: %s\n",manualMode?"manual":"auto",commandName(lastCommand),gate.conflict()?"conflict":gate.fresh(millis())?"fresh":"waiting");
  }
}

void setup(){
  Serial.begin(115200);
#if ARDUINO_USB_CDC_ON_BOOT
  Serial.setTxTimeoutMs(0);
#endif
  uno.begin(9600,SERIAL_8N1,UNUSED_UART_RX,UNO_COMMAND_TX);
  oocsi.setLogging(false);
  if(strcmp(WIFI_SSID,"YOUR_WIFI_NAME")==0)return;
  configured=true;
  oocsi.connect(DEVICE_NAME,OOCSI_SERVER,WIFI_SSID,WIFI_PASSWORD,receiveHeist);
  oocsi.subscribe(TEAM_CHANNEL);lastSubscribeAt=millis();
}

void loop(){
  checkUsb(); // Also works for local calibration before adding Wi-Fi details.
  if(configured)oocsi.check();
  const uint32_t now=millis();
  const vault::Command desired=manualMode?manualCommand:gate.canSend(now)?gate.command():vault::Command::None;
  if(desired!=vault::Command::None&&(desired!=lastCommand||uint32_t(now-lastCommandAt)>=COMMAND_REPEAT_MS))sendCommand(desired);
  if(configured&&uint32_t(now-lastSubscribeAt)>=5000){oocsi.subscribe(TEAM_CHANNEL);lastSubscribeAt=now;} // Restore subscription after reconnection.
  if(configured&&uint32_t(now-lastStatusAt)>=STATUS_INTERVAL_MS){sendStatus();lastStatusAt=now;}
  delay(2);
}
