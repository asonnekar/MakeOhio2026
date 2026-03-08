# SmartLine Guardian

**Real-time power transmission line monitoring system** built for MakeOHI/O 2026.

> **Team Truxie** — Aneesh Sonnekar · Luke Fenstermaker · Conlan Mayberry

---

## Overview

SmartLine Guardian monitors the thermal health of overhead power transmission lines in real time. An ESP32 microcontroller reads a thermistor clamped to the conductor and a DHT11 ambient sensor, computes a risk score and predicted sag, then streams data over USB serial to a host machine. A Node.js bridge exposes the data as a local HTTP API consumed by a React dashboard.

```
┌──────────────┐   UART 115200   ┌─────────────────┐   HTTP /api/status   ┌──────────────────┐
│  ESP32 + Sensors │ ──────────────► │  Serial Bridge   │ ───────────────────► │  React Dashboard  │
│  (PlatformIO)    │               │  (Node.js)       │                      │  (Vite + Recharts)│
└──────────────────┘               └─────────────────┘                      └──────────────────┘
```

---

## Repository Structure

```
MakeOhio2026/
├── testesp/          # ESP32 firmware (PlatformIO / Arduino)
├── serial-bridge/    # Node.js serial→HTTP bridge
└── dashboard/        # React + TypeScript + Vite dashboard
```

---

## Hardware

| Component | Role | Pin |
|---|---|---|
| ESP32 NodeMCU-32S | Main MCU | — |
| Thermistor (NTC 10 kΩ, β=3950) | Conductor (line) temperature | GPIO 34 (ADC) |
| 10 kΩ series resistor | Voltage divider for thermistor | — |
| DHT11 | Ambient temperature + humidity | GPIO 14 |
| Green LED | SAFE status indicator | GPIO 25 |
| Yellow LED | STRESSED status indicator | GPIO 26 |
| Red LED | OVERLOAD status indicator | GPIO 27 |

### Wiring

- **Thermistor**: one leg to 3.3 V, other leg → GPIO 34 and to GND via 10 kΩ resistor.
- **DHT11**: VCC → 3.3 V, GND → GND, DATA → GPIO 14.
- **Status LEDs**: each with a 220 Ω current-limiting resistor to GND.

---

## Firmware — `testesp/`

Written with the Arduino framework via **PlatformIO**.

### How it works

1. Reads the thermistor using an 8-sample averaged ADC, converts to °C via the Steinhart–Hart β equation.
2. Reads ambient temperature and humidity from the DHT11.
3. Computes an **effective conductor temperature** (humidity-adjusted), a weighted **risk score** (0–100), and **predicted cable sag** (parabolic thermal expansion model over a 30 m span).
4. Applies hysteresis thresholds to classify line status as `SAFE`, `STRESSED`, or `OVERLOAD`.
5. Drives the three status LEDs.
6. Prints a structured line to `Serial` at 115200 baud every 2 s.

### Risk score weights

| Factor | Weight |
|---|---|
| Conductor temperature | 50 % |
| Thermal rise above ambient | 25 % |
| Sag | 15 % |
| Ambient temperature | 10 % |

### Build & Flash

```bash
# Install PlatformIO CLI (if not already installed)
pip install platformio

cd testesp
pio run --target upload      # build + flash
pio device monitor -b 115200 # watch serial output
```

Library dependencies (auto-installed by PlatformIO):
- `adafruit/DHT sensor library @ ^1.4.6`
- `marcoschwartz/LiquidCrystal_I2C @ ^1.1.4`

---

## Serial Bridge — `serial-bridge/`

A small **Node.js** process that:
1. Opens the ESP32's USB-serial port.
2. Parses each structured output line into JSON.
3. Serves the latest reading at `http://localhost:3001/api/status`.

### Setup & Run

```bash
cd serial-bridge
npm install

# List available serial ports to find your ESP32
node -e "const {SerialPort} = require('serialport'); SerialPort.list().then(p => p.forEach(x => console.log(x.path)))"

# Start the bridge (edit the port in serial-bridge.js if needed)
npm start
# or
node serial-bridge.js
```

The server listens on **port 3001** by default.

---

## Dashboard — `dashboard/`

A **React + TypeScript** single-page app built with Vite. Polls the serial bridge every second and displays:

- **Status Banner** — full-width SAFE / STRESSED / OVERLOAD indicator
- **Current Panel** — live current gauge (I_actual vs I_safe)
- **Temperature Trend Chart** — scrolling area chart of Line Temp (Tc) and Environmental Temp (Ta)
- **Conditions Panel** — line temp, environmental temp, humidity, predicted sag, rated current limit, and a plain-English explanation
- **Event Log** — timestamped history of status transitions

### Setup & Run

```bash
cd dashboard
npm install
npm run dev          # starts Vite dev server at http://localhost:5173
```

> The serial bridge **must be running** before starting the dashboard, otherwise the dashboard will show a "Connecting…" spinner.

### Production Build

```bash
cd dashboard
npm run build        # output in dashboard/dist/
npm run preview      # preview the production build locally
```

---

## Running Everything Together

Open **three terminals**:

```bash
# Terminal 1 — Flash firmware (one time, or after changes)
cd testesp && pio run --target upload

# Terminal 2 — Serial bridge
cd serial-bridge && npm start

# Terminal 3 — Dashboard
cd dashboard && npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## License

MIT — open source, hack freely.
