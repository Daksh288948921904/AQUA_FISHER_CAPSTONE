#!/usr/bin/env python3
"""
Simulates the Heltech WiFi LoRa 32 probe pushing live water sensor telemetry
(pH, Turbidity, TDS) to the Aqua Sentinel FastAPI backend via Wi-Fi HTTP/HTTPS POST.
Temperature and GPS coordinates are automatically mocked by the backend.

Usage:
    python simulate_heltech_telemetry.py [--url http://localhost:8000/api/v1/telemetry] [--interval 2.5]
"""

import argparse
import random
import sys
import time
import httpx

def generate_sensor_packet(device_id="heltech-lora32-dal-01"):
    return {
        "device_id": device_id,
        "ph": round(random.gauss(7.82, 0.22), 2),
        "turbidity": round(max(1.5, random.gauss(14.8, 3.8)), 2),
        "tds": round(max(50.0, random.gauss(210.0, 22.0)), 1),
        "battery_pct": 96.0,
        "rssi": random.randint(-72, -54),
        # Temperature and GPS are intentionally omitted to test backend mocking!
    }

def main():
    parser = argparse.ArgumentParser(description="Heltech WiFi LoRa 32 Telemetry Simulator (pH, Turbidity, TDS)")
    parser.add_argument("--url", default="http://localhost:8000/api/v1/telemetry", help="Target API URL")
    parser.add_argument("--interval", type=float, default=2.5, help="Transmission interval in seconds")
    parser.add_argument("--count", type=int, default=0, help="Number of packets to send (0 = infinite)")
    args = parser.parse_args()

    print(f"🛰️  Starting Heltech probe simulation (pH, Turbidity, TDS) -> {args.url}")
    print("🌡️  Temperature and GPS will be dynamically mocked by the backend on Dal Lake.")
    print(f"⏱️  Sending sensor readings every {args.interval}s (Press Ctrl+C to stop)...")

    sent = 0
    with httpx.Client(timeout=5.0) as client:
        while True:
            packet = generate_sensor_packet()
            try:
                response = client.post(args.url, json=packet)
                if response.status_code == 200:
                    data = response.json()
                    sent += 1
                    status_emoji = (
                        "🟢" if data.get("overall_status") == "Normal"
                        else "🟡" if data.get("overall_status") == "Caution"
                        else "🔴"
                    )
                    print(
                        f"[{sent:04d}] {status_emoji} Sector: {data.get('sector'):<24} | "
                        f"pH: {data.get('ph'):.2f} (Sensor) | Turb: {data.get('turbidity'):.1f} NTU (Sensor) | "
                        f"TDS: {data.get('tds'):.0f} ppm (Sensor) | Temp: {data.get('temperature'):.1f}°C (Mocked) | "
                        f"WQI: {data.get('wqi_score')} ({data.get('wqi_category')}) | "
                        f"GPS: {data.get('latitude'):.4f}, {data.get('longitude'):.4f} (Mocked)"
                    )
                else:
                    print(f"⚠️  HTTP Error {response.status_code}: {response.text}")
            except Exception as e:
                print(f"❌ Connection error: {e}")

            if args.count > 0 and sent >= args.count:
                break
            time.sleep(args.interval)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nSimulation stopped.")
        sys.exit(0)
