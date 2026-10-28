#include <Arduino.h>
#include <WiFi.h>
#include <OOCSI.h>

// Board: XIAO_ESP32C6, USB CDC On Boot: Enabled.
// Arduino libraries: OOCSI 1.6.0 and ArduinoJson 7.x.
// Fill these in locally before uploading. Keep real passwords out of GitHub.
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* OOCSI_SERVER = "oocsi.id.tue.nl";
const char* TEAM_CHANNEL = "OOCSI-things/team-2";
const char* DEVICE_NAME = "team2_skidule_controls_########";

const int SLIDER_PIN = A0;  // D0 / GPIO0
const int KNOB_PIN = A1;    // D1 / GPIO1
const int BUTTON_PIN = D4;  // GPIO22; button connects D4 to GND

const int BAR_COUNT = 4;
// Initial endpoints based on the reported ~3270 maximum. Measure each control
// at both ends and adjust these four values for this particular physical unit.
const int SLIDER_RAW_MIN = 0;
const int SLIDER_RAW_MAX = 3270;
const int KNOB_RAW_MIN = 0;
const int KNOB_RAW_MAX = 3270;
const bool DEBUG_SERIAL = false;  // Gameplay must work without a serial monitor.
static_assert(SLIDER_RAW_MAX > SLIDER_RAW_MIN && KNOB_RAW_MAX > KNOB_RAW_MIN,
              "Analog maximums must exceed minimums");

const uint32_t SAMPLE_INTERVAL_MS = 10;
const uint32_t SEND_INTERVAL_MS = 100;
const uint32_t DEBOUNCE_MS = 25;

OOCSI oocsi;
char bootId[9];
uint32_t messageSequence = 0;
uint32_t buttonPressCount = 0;
uint32_t lastSampleAt = 0;
uint32_t lastSendAt = 0;
uint32_t buttonChangedAt = 0;
int sliderRaw = 0;
int knobRaw = 0;
bool lastButtonReading = false;
bool buttonPressed = false;
bool configured = false;

int readAnalogAverage(int pin) {
  int total = 0;
  for (int i = 0; i < 4; ++i) total += analogRead(pin);
  return total / 4;
}

float normalizedAnalog(int raw, int minimum, int maximum) {
  return constrain((raw - minimum) / static_cast<float>(maximum - minimum), 0.0f, 1.0f);
}

int selectedBar() {
  const float knob = normalizedAnalog(knobRaw, KNOB_RAW_MIN, KNOB_RAW_MAX);
  return min(BAR_COUNT - 1, static_cast<int>(knob * BAR_COUNT));
}

void sendControls(const char* event) {
  oocsi.newMessage(TEAM_CHANNEL);
  oocsi.addString("module", "skidule_controls");
  oocsi.addString("event", event);
  oocsi.addString("boot_id", bootId);
  oocsi.addLong("seq", static_cast<long>(++messageSequence));
  oocsi.addInt("slider_raw", sliderRaw);
  oocsi.addInt("knob_raw", knobRaw);
  oocsi.addFloat("slider", 100.0f * normalizedAnalog(sliderRaw, SLIDER_RAW_MIN, SLIDER_RAW_MAX));
  oocsi.addFloat("knob", normalizedAnalog(knobRaw, KNOB_RAW_MIN, KNOB_RAW_MAX));
  oocsi.addInt("bar_index", selectedBar());
  oocsi.addInt("bar_count", BAR_COUNT);
  oocsi.addFloat("bar_height", normalizedAnalog(sliderRaw, SLIDER_RAW_MIN, SLIDER_RAW_MAX));
  oocsi.addBool("button_pressed", buttonPressed);
  // The receiver handles event == "pressed" once per (sender, boot_id, count).
  // Periodic "state" messages describe a held button without toggling again.
  oocsi.addLong("button_press_count", static_cast<long>(buttonPressCount));
  oocsi.sendMessage();
}

void setup() {
  Serial.begin(115200);
#if ARDUINO_USB_CDC_ON_BOOT
  Serial.setTxTimeoutMs(0);
#endif
  analogReadResolution(12);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  sliderRaw = readAnalogAverage(SLIDER_PIN);
  knobRaw = readAnalogAverage(KNOB_PIN);
  buttonPressed = lastButtonReading = digitalRead(BUTTON_PIN) == LOW;
  buttonChangedAt = millis();
  snprintf(bootId, sizeof(bootId), "%08lx", static_cast<unsigned long>(esp_random()));

  if (strcmp(WIFI_SSID, "YOUR_WIFI_NAME") == 0) {
    if (DEBUG_SERIAL) Serial.println("Fill in WIFI_SSID and WIFI_PASSWORD, then upload again.");
    return;
  }

  configured = true;
  if (DEBUG_SERIAL) Serial.println("Connecting to Wi-Fi and OOCSI...");
  if (oocsi.connect(DEVICE_NAME, OOCSI_SERVER, WIFI_SSID, WIFI_PASSWORD)) {
    if (DEBUG_SERIAL) Serial.printf("Connected: %s -> %s\n", oocsi.getName().c_str(), TEAM_CHANNEL);
    sendControls("online");
  } else {
    if (DEBUG_SERIAL) Serial.println("Connection failed; OOCSI will retry in loop().");
  }
}

void loop() {
  if (!configured) {
    delay(20);
    return;
  }

  // Handles server pings and attempts reconnection after a dropped connection.
  // Reconnection can block; this sketch does not replay old button presses.
  oocsi.check();
  uint32_t now = millis();

  if (now - lastSampleAt >= SAMPLE_INTERVAL_MS) {
    lastSampleAt = now;
    sliderRaw = readAnalogAverage(SLIDER_PIN);
    knobRaw = readAnalogAverage(KNOB_PIN);

    bool reading = digitalRead(BUTTON_PIN) == LOW;
    if (reading != lastButtonReading) buttonChangedAt = now;
    lastButtonReading = reading;

    if (reading != buttonPressed && now - buttonChangedAt >= DEBOUNCE_MS) {
      buttonPressed = reading;
      if (buttonPressed) ++buttonPressCount;
      sendControls(buttonPressed ? "pressed" : "released");
    }
  }

  if (now - lastSendAt >= SEND_INTERVAL_MS) {
    lastSendAt = now;
    sendControls("state");
    if (DEBUG_SERIAL && Serial && Serial.availableForWrite() >= 96) {
      Serial.printf("Slider: %4d  Knop: %4d  Bar: %d  Button: %s\n",
                    sliderRaw, knobRaw, selectedBar(),
                    buttonPressed ? "INGEDRUKT" : "-");
    }
  }

  delay(1);
}
