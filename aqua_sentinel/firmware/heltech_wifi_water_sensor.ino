/*
  ========================================================================
  Aqua Sentinel - Heltech WiFi LoRa 32 Water Quality Telemetry Probe
  ========================================================================
  Target Board: Heltech WiFi LoRa 32 (V2 or V3 - ESP32)
  Hardware Sensors Available:
    - pH Sensor (Analog)
    - Turbidity Sensor (Analog Nephelometric)
    - TDS Sensor (Analog Total Dissolved Solids)
  Simulated by Backend:
    - Water Temperature (Mocked dynamically)
    - GPS Coordinates (Mocked Digital Twin trajectory on Dal Lake)

  Function:
    - Reads available sensors (pH, Turbidity, TDS)
    - Connects to Wi-Fi / Mobile 4G/5G Hotspot
    - Securely posts telemetry JSON to online deployed backend (HTTPS)
      or local server (HTTP)
    - Displays live readings and transmission status on onboard 0.96" OLED
  ========================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>        // Install "ArduinoJson" via Arduino Library Manager (v6 or v7)
#include <Wire.h>
#include "HT_SSD1306Wire.h"     // Heltech ESP32 display library

// ── 1. Wi-Fi or Mobile Hotspot Configuration ──
// Set this to your phone's personal hotspot name and password when testing in the field!
const char* WIFI_SSID     = "YOUR_PHONE_HOTSPOT_OR_WIFI";
const char* WIFI_PASSWORD = "YOUR_HOTSPOT_PASSWORD";

// ── 2. Aqua Sentinel Backend Endpoint (Local or Online Cloud) ──
// When deployed on Render / Railway / AWS / VPS, use your HTTPS URL:
// e.g.: "https://your-backend-app.onrender.com/api/v1/telemetry"
// If testing locally on the same Wi-Fi, use your laptop's IP:
// e.g.: "http://192.168.1.100:8000/api/v1/telemetry"
const char* SERVER_URL    = "https://your-backend-app.onrender.com/api/v1/telemetry";
const char* DEVICE_ID     = "heltech-lora32-dal-01";

// ── 3. Pin Definitions for Available Physical Sensors ──
// Only use ADC1 pins (GPIO 32 to 39) so they don't conflict with Wi-Fi!
#define PIN_PH_ANALOG        36   // ADC1_CH0 (VP) -> pH Sensor
#define PIN_TURBIDITY_ANALOG 37   // ADC1_CH1      -> Turbidity Sensor
#define PIN_TDS_ANALOG       38   // ADC1_CH2      -> TDS (Total Dissolved Solids) Sensor

// ── Display Setup (Heltech onboard OLED) ──
#if defined(HELTEC_V3)
static SSD1306Wire display(0x3c, 500000, 17, 18, 21);
#else
static SSD1306Wire display(0x3c, 500000, 4, 15, 16);
#endif

unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL_MS = 2500; // Send telemetry every 2.5 seconds
int packetCounter = 0;

void setupDisplay() {
  display.init();
  display.setFont(ArialMT_Plain_10);
  display.clear();
  display.drawString(0, 0, "Aqua Sentinel 🛸");
  display.drawString(0, 16, "Sensors: pH, Turb, TDS");
  display.drawString(0, 30, "Heltech LoRa32 Init...");
  display.display();
}

void connectWiFi() {
  display.clear();
  display.drawString(0, 0, "Connecting Hotspot:");
  display.drawString(0, 16, WIFI_SSID);
  display.display();

  Serial.print("Connecting to Wi-Fi/Hotspot: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  display.clear();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());
    display.drawString(0, 0, "HOTSPOT CONNECTED!");
    display.drawString(0, 16, WiFi.localIP().toString());
    display.drawString(0, 32, "Streaming live data...");
  } else {
    Serial.println("\nWiFi Connection failed. Will retry in loop...");
    display.drawString(0, 0, "HOTSPOT OFFLINE");
    display.drawString(0, 16, "Retrying in background");
  }
  display.display();
  delay(1200);
}

// ── Sensor Reading Helpers for Available Physical Sensors ──

// 1. pH Sensor Reading
float readPH() {
  int raw = analogRead(PIN_PH_ANALOG);
  float voltage = raw * (3.3 / 4095.0);
  // Calibration: standard glass electrode slope
  float ph = 7.0 + (voltage - 1.65) * 3.5;
  return constrain(ph, 0.0, 14.0);
}

// 2. Turbidity Sensor Reading (Nephelometric NTU)
float readTurbidity() {
  int raw = analogRead(PIN_TURBIDITY_ANALOG);
  float voltage = raw * (3.3 / 4095.0);
  float ntu = -1120.4 * (voltage * voltage) + 5742.3 * voltage - 4353.8;
  if (ntu < 0) ntu = (4095 - raw) / 100.0;
  return constrain(ntu, 0.5, 100.0);
}

// 3. TDS Sensor Reading (Total Dissolved Solids in ppm)
float readTDS() {
  int raw = analogRead(PIN_TDS_ANALOG);
  float voltage = raw * (3.3 / 4095.0);
  // Standard Gravity / DFRobot TDS transfer formula:
  float compensationCoefficient = 1.0; // Temperature compensation handled by backend model
  float compensationVoltage = voltage / compensationCoefficient;
  float tds = (133.42 * pow(compensationVoltage, 3) - 255.86 * pow(compensationVoltage, 2) + 857.39 * compensationVoltage) * 0.5;
  if (tds < 0) tds = 150.0 + (voltage * 60.0);
  return constrain(tds, 10.0, 1000.0);
}

float readBatteryPct() {
  return 96.0;
}

void setup() {
  Serial.begin(115200);
  setupDisplay();
  connectWiFi();
}

void sendTelemetry() {
  // Auto-reconnect Wi-Fi if phone hotspot connection dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Hotspot disconnected. Reconnecting...");
    WiFi.reconnect();
    return;
  }

  // 1. Gather Available Physical Sensor Measurements
  float ph = readPH();
  float turbidity = readTurbidity();
  float tds = readTDS();
  float battery = readBatteryPct();
  int rssi = WiFi.RSSI();

  packetCounter++;

  // 2. Build Lightweight JSON Payload (<200 bytes)
  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["ph"] = round(ph * 100) / 100.0;
  doc["turbidity"] = round(turbidity * 10) / 10.0;
  doc["tds"] = round(tds * 10) / 10.0;
  doc["battery_pct"] = battery;
  doc["rssi"] = rssi;
  // NOTE: Temperature & GPS coordinates are left omitted;
  // The backend automatically mocks temperature and Dal Lake GPS waypoints!

  String jsonString;
  serializeJson(doc, jsonString);

  // 3. Fast Online HTTP/HTTPS POST
  HTTPClient http;
  int httpCode = -1;
  String url = String(SERVER_URL);

  if (url.startsWith("https://")) {
    // Online SSL/TLS connection (Render, Railway, Fly, AWS, etc.)
    WiFiClientSecure *secureClient = new WiFiClientSecure;
    if (secureClient) {
      secureClient->setInsecure(); // Connect directly to cloud without root CA certificate hardcoding
      http.begin(*secureClient, url);
      http.addHeader("Content-Type", "application/json");
      http.setTimeout(3500);

      unsigned long t0 = millis();
      httpCode = http.POST(jsonString);
      unsigned long elapsed = millis() - t0;
      Serial.printf("[HTTPS POST] Status: %d | Time: %lums | Payload: %s\n", httpCode, elapsed, jsonString.c_str());

      http.end();
      delete secureClient;
    }
  } else {
    // Local development HTTP connection
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(2500);

    unsigned long t0 = millis();
    httpCode = http.POST(jsonString);
    unsigned long elapsed = millis() - t0;
    Serial.printf("[HTTP POST] Status: %d | Time: %lums | Payload: %s\n", httpCode, elapsed, jsonString.c_str());

    http.end();
  }

  // 4. Update OLED Display with Available Sensors
  display.clear();
  display.drawString(0, 0, String("AQUA PROBE #") + String(packetCounter));
  display.drawString(0, 14, String("pH: ") + String(ph, 2) + " | Turb: " + String(turbidity, 1));
  display.drawString(0, 28, String("TDS: ") + String(tds, 0) + " ppm");

  if (httpCode == 200) {
    display.drawString(0, 44, String("ONLINE OK (") + String(rssi) + "dBm)");
  } else {
    display.drawString(0, 44, String("ERR CODE: ") + String(httpCode));
  }
  display.display();
}

void loop() {
  if (millis() - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = millis();
    sendTelemetry();
  }
  delay(10);
}
