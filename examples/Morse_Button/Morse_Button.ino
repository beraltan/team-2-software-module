#include <Arduino.h>
#include <WiFi.h>
#include <OOCSI.h>

// Board: Seeed Studio XIAO ESP32-C6. USB CDC On Boot: Enabled.
// Original Morse module: DFRobot DFR0029 three-wire, active-HIGH button.
// Signal -> D3 / GPIO21, + -> 3V3, - -> GND. No pin_config.h needed.
// Libraries: OOCSI 1.6.0 and ArduinoJson 7.3.2.
// Set Wi-Fi locally. Do not share or commit a sketch with real credentials.
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* OOCSI_SERVER = "oocsi.id.tue.nl";
const char* TEAM_CHANNEL = "OOCSI-things/team-2";
const int BUTTON_PIN = D3;  // GPIO21. D4 is GPIO22: change only if wired there.
const bool BUTTON_ACTIVE_LOW = false;
// For a bare two-wire switch connected between D3 and GND, set the above to true.
const uint32_t DEBOUNCE_MS = 25;
const uint32_t HEARTBEAT_MS = 5000;
const uint32_t DASH_THRESHOLD_MS = 400;  // Matches the hacker screen's signal strip.

OOCSI oocsi;
char deviceName[40];
bool configured = false;
bool lastReading = false;
bool pressed = false;
bool pressStarted = false;
uint32_t changedAt = 0;
uint32_t pressedAt = 0;
uint32_t lastHeartbeatAt = 0;

bool readPressed() {
  return digitalRead(BUTTON_PIN) == (BUTTON_ACTIVE_LOW ? LOW : HIGH);
}

void sendHeartbeat() {
  oocsi.newMessage(TEAM_CHANNEL);
  oocsi.addString("module", "suitcase");
  oocsi.addString("event", "online");
  oocsi.addLong("uptime_s", static_cast<long>(millis() / 1000));
  oocsi.sendMessage();
}

void sendButton(bool down, uint32_t durationMs = 0) {
  oocsi.newMessage(TEAM_CHANNEL);
  oocsi.addString("module", "morse_button");
  oocsi.addString("state", down ? "pressed" : "released");
  oocsi.addBool("lampo_toggle", down);
  if (!down) oocsi.addLong("duration_ms", static_cast<long>(durationMs));
  oocsi.sendMessage();
}

void setup() {
  Serial.begin(115200);
  delay(800);  // Allow native USB serial to enumerate; never wait indefinitely.
  pinMode(BUTTON_PIN, BUTTON_ACTIVE_LOW ? INPUT_PULLUP : INPUT_PULLDOWN);
  snprintf(deviceName, sizeof(deviceName), "team2_morse_%012llX",
           static_cast<unsigned long long>(ESP.getEfuseMac() & 0xFFFFFFFFFFFFULL));

  Serial.println("Team 2 Morse button - XIAO ESP32-C6");
  Serial.printf("Button GPIO: %d, active %s\n", BUTTON_PIN, BUTTON_ACTIVE_LOW ? "LOW" : "HIGH");
  Serial.printf("Client: %s | Channel: %s\n", deviceName, TEAM_CHANNEL);
  if (strcmp(WIFI_SSID, "YOUR_WIFI_NAME") == 0 || strlen(WIFI_SSID) == 0 ||
      strcmp(WIFI_PASSWORD, "YOUR_WIFI_PASSWORD") == 0) {
    Serial.println("Set WIFI_SSID and WIFI_PASSWORD locally, then upload again.");
    return;
  }

  configured = true;
  oocsi.setLogging(false);
  Serial.println("Connecting to Wi-Fi and OOCSI...");
  const bool connected = oocsi.connect(deviceName, OOCSI_SERVER, WIFI_SSID, WIFI_PASSWORD);
  Serial.println(connected ? "OOCSI connection accepted." : "Connection failed; the library will retry in loop().");

  // Establish the baseline AFTER connection, so a button held during boot is
  // ignored until released. Old button actions are not queued for replay.
  lastReading = pressed = readPressed();
  changedAt = millis();
  sendHeartbeat();
  sendButton(false);  // Initial lamp-off state; never a synthetic press.
  lastHeartbeatAt = millis();
}

void loop() {
  if (!configured) {
    delay(20);
    return;
  }

  // Services pings and automatic reconnection. Reconnection may block;
  // after a network outage, reset the screen's receiver and repeat the signal.
  // check()'s return value means "message received", NOT "connected".
  oocsi.check();
  const uint32_t now = millis();
  const bool reading = readPressed();
  if (reading != lastReading) changedAt = now;
  lastReading = reading;

  if (reading != pressed && now - changedAt >= DEBOUNCE_MS) {
    pressed = reading;
    if (pressed) {
      pressedAt = now;
      pressStarted = true;
      sendButton(true);
      Serial.println("Pressed -> sending lamp ON");
    } else {
      const uint32_t duration = pressStarted ? now - pressedAt : 0;
      sendButton(false, duration);
      if (pressStarted) {
        Serial.printf("Released -> %lu ms -> %s\n", static_cast<unsigned long>(duration),
                      duration < DASH_THRESHOLD_MS ? "DOT" : "DASH");
      }
      pressStarted = false;
    }
  }

  if (now - lastHeartbeatAt >= HEARTBEAT_MS) {
    sendHeartbeat();
    lastHeartbeatAt = now;
  }
  delay(1);
}
