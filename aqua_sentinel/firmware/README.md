# Heltech WiFi LoRa 32 Probe & Online Deployment Guide

This folder contains the firmware for flashing your **Heltech WiFi LoRa 32** development board to act as an IoT telemetry probe for Aqua Sentinel.

## 1. Hardware Overview
- **Board**: Heltech WiFi LoRa 32 (V2 or V3 - ESP32)
- **Microcontroller**: Dual-core ESP32 with built-in Wi-Fi (802.11 b/g/n), Bluetooth, and LoRa transceiver
- **Display**: Onboard 0.96-inch OLED (128x64 SSD1306)

---

## 2. How to Send Events to an Online Deployed Backend Quickly

When your FastAPI backend is deployed on a cloud host (such as **Render, Railway, Fly.io, AWS, or DigitalOcean**), it is secured with **HTTPS (port 443)**.

### Method A: Mobile Hotspot (Fastest & Simplest for Field Testing)
This is the recommended approach for rapid field demos on Dal Lake or in the lab:

1. **Turn on Personal Hotspot** on your smartphone (4G or 5G).
2. In [`heltech_wifi_water_sensor.ino`](./heltech_wifi_water_sensor.ino), configure your phone's hotspot details:
   ```cpp
   const char* WIFI_SSID     = "My_iPhone_Hotspot";
   const char* WIFI_PASSWORD = "mysecretpassword";
   ```
3. Set your online deployed backend HTTPS URL:
   ```cpp
   const char* SERVER_URL    = "https://your-app-name.onrender.com/api/v1/telemetry";
   ```
4. Flash the board.
5. As soon as the board powers on (via USB or 3.7V LiPo battery), it connects to your phone's cellular hotspot and executes high-speed HTTPS POSTs directly to your cloud backend in **under 120ms** per reading!
   - The sketch uses `WiFiClientSecure` with `client->setInsecure()`, so it handshakes with Render/Railway/AWS SSL certificates instantly with **zero certificate configuration required**.

---

### Method B: Long-Range LoRa Shore Gateway (For Remote Lake Areas >1 km from Shore)
If the drone or boat travels far out onto Dal Lake beyond cellular or Wi-Fi range:
1. **Heltech #1 (Drone Probe on water)**: Transmits raw telemetry over LoRa RF (868 / 915 MHz). Range: 2–5 km line-of-sight over water.
2. **Heltech #2 (Base Station on shore)**: Connected to your phone hotspot. Listens on LoRa, receives the packet, and forwards it to `https://your-app-name.onrender.com/api/v1/telemetry` over Wi-Fi.

---

## 3. Physical Sensor Wiring Pinout
Only 3 physical sensors are required on the hardware probe:

| Available Sensor Parameter | Output Type | Recommended Heltech Pin | Role |
| :--- | :--- | :--- | :--- |
| **pH Sensor** | Analog (0-3.3V) | `GPIO 36` (VP) | Physical Hardware Sensor |
| **Turbidity Sensor** | Analog (0-4.5V / 3.3V) | `GPIO 37` (ADC1_CH1) | Physical Hardware Sensor |
| **TDS Sensor** | Analog (0-3.3V) | `GPIO 38` (ADC1_CH2) | Physical Hardware Sensor |
| **Water Temperature** | *N/A (No hardware)* | *Omitted* | **Mocked dynamically by backend** |
| **GPS Coordinates** | *N/A (No hardware)* | *Omitted* | **Mocked Dal Lake trajectory by backend** |
| **Power (VCC & GND)** | Power | `3V3` / `5V` & `GND` | Common ground with Heltech |

> [!NOTE]
> All 3 physical sensors use **ADC1** pins (GPIO 36, 37, 38). ADC1 is safe to use simultaneously with Wi-Fi without any pin conflict. Do not use ADC2 pins (GPIO 0, 2, 4, 12-15, 25-27) as they are disabled when ESP32 Wi-Fi is active.

---

## 4. Flashing with Arduino IDE
1. Open **Arduino IDE**.
2. Install the ESP32 board definitions:
   - File &rarr; Preferences &rarr; Additional Board Manager URLs:
     `https://resource.heltec.cn/download/package_heltec_esp32_index.json`
   - Tools &rarr; Board &rarr; Boards Manager &rarr; Search "Heltec ESP32" &rarr; Install.
3. Install required libraries via Library Manager:
   - **ArduinoJson** (by Benoit Blanchon, v6 or v7)
   - **ESP8266_and_ESP32_OLED_driver** (or included Heltec display driver)
4. Open [`heltech_wifi_water_sensor.ino`](./heltech_wifi_water_sensor.ino).
5. Edit `WIFI_SSID`, `WIFI_PASSWORD`, and `SERVER_URL`.
6. Select Board **WiFi LoRa 32(V2)** or **WiFi LoRa 32(V3)** and select your USB COM port.
7. Click **Upload**.

---

## 5. Software Simulator (Test without Board)
You can test the stream and digital twin without the physical board at any time:
- Via Python script:
  ```bash
  python aqua_sentinel/scripts/simulate_heltech_telemetry.py --url https://your-app-name.onrender.com/api/v1/telemetry
  ```
- Or click **"▶ Simulate Heltech Probe"** directly in the top right of the web console!
