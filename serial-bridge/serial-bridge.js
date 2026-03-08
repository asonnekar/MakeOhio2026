#!/usr/bin/env node
/**
 * SmartLine Guardian — Serial Bridge
 * 
 * Reads ESP32 serial output, parses it, and serves it as JSON at:
 *   GET http://localhost:3001/api/status
 *
 * ESP32 serial format (one line per 2 s):
 *   RawADC: 1234  Tc: 48.23  Ta: 27.50  H: 55.0%  EffectiveC: 52.10  Risk: 62.3  STATUS: STRESSED
 *
 * Usage:
 *   node serial-bridge.js [--port /dev/cu.usbserial-XXX] [--baud 115200]
 */

const http = require("http");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

// ── CLI args ───────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, fallback) {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : fallback;
}

const SERIAL_PORT = getArg("--port", process.env.SERIAL_PORT || "AUTO");
const BAUD_RATE = parseInt(getArg("--baud", process.env.BAUD_RATE || "115200"));
const HTTP_PORT = parseInt(getArg("--http-port", "3001"));

// ── Latest parsed state ────────────────────────────────────
let latestData = null;
let lastReceived = 0;

/**
 * Parse one ESP32 serial line into the dashboard's SensorData shape.
 *
 * Raw line example:
 *   RawADC: 1234  Tc: 48.23  Ta: 27.50  H: 55.0%  EffectiveC: 52.10  Risk: 62.3  STATUS: STRESSED
 *
 * The dashboard needs: Tc, Ta, humidity, I_actual, I_safe, status, fanOn, timestamp
 *
 * I_actual / I_safe are not directly on the ESP32 yet, so we derive them from
 * EffectiveC (effective conductor temp) and Risk score using the same thermal
 * model the firmware uses — keeping the numbers self-consistent.
 */
function parseLine(line) {
    // Skip boot messages
    if (!line.includes("Tc:")) return null;

    const extract = (pattern) => {
        const m = line.match(pattern);
        return m ? parseFloat(m[1]) : null;
    };

    const Tc = extract(/Tc:\s*([\d.]+)/);
    const Ta = extract(/Ta:\s*([\d.]+)/);
    const H = extract(/H:\s*([\d.]+)/);
    const effC = extract(/EffectiveC:\s*([\d.]+)/);
    const risk = extract(/Risk:\s*([\d.]+)/);
    const sagM = line.match(/Sag:\s*([\d.]+)\s*m/);
    const sag = sagM ? parseFloat(sagM[1]) : null;
    const statusM = line.match(/STATUS:\s*(SAFE|STRESSED|OVERLOAD)/);
    const status = statusM ? statusM[1] : null;

    if (Tc === null || Ta === null || H === null || status === null) return null;

    // ── I_safe: same thermal model as firmware ─────────────────────────────────
    // Base = 18 A at Ta=25°C neutral humidity.
    // Each +1°C ambient reduces capacity by 0.3 A.
    // Humidity gives up to ±6% via the same cooling factor the firmware uses.
    const humFactor = 1.0 + ((H - 50) / 50) * 0.06;
    const I_safe = Math.max(4, (18 - 0.3 * (Ta - 25)) * humFactor);

    // ── I_actual: status-aware mapping ────────────────────────────────────────
    // We guarantee the gauge bar always falls in the correct visual zone:
    //   SAFE     → ratio 0.40 – 0.84  (comfortable, well under limit)
    //   STRESSED → ratio 0.85 – 0.99  (approaching limit)
    //   OVERLOAD → ratio 1.01 – 1.35  (exceeds limit)
    //
    // Within each zone we use the risk score (normalised to that zone's range)
    // for smooth continuous motion rather than a hard jump at the threshold.
    let ratio;
    const r = risk ?? 0;
    if (status === "SAFE") {
        // risk 0–44 → ratio 0.40–0.84
        const t = Math.min(r, 44) / 44;
        ratio = 0.40 + t * 0.44;
    } else if (status === "STRESSED") {
        // risk 45–79 → ratio 0.85–0.99
        const t = Math.min(Math.max(r - 45, 0), 34) / 34;
        ratio = 0.85 + t * 0.14;
    } else {
        // OVERLOAD: risk 80–100 → ratio 1.01–1.35
        const t = Math.min(Math.max(r - 80, 0), 20) / 20;
        ratio = 1.01 + t * 0.34;
    }
    const I_actual = I_safe * ratio;

    // fanOn: humidity cooling is actively lowering effective conductor temp
    const fanOn = effC !== null && Tc !== null && (Tc - (effC ?? Tc)) > 0.5;

    return {
        Tc: parseFloat(Tc.toFixed(2)),
        Ta: parseFloat(Ta.toFixed(2)),
        humidity: parseFloat(H.toFixed(1)),
        I_safe: parseFloat(I_safe.toFixed(1)),
        I_actual: parseFloat(I_actual.toFixed(1)),
        status,
        fanOn,
        riskScore: r,
        effectiveConductorTemp: effC,
        sagMeters: sag !== null ? parseFloat(sag.toFixed(3)) : null,
        timestamp: new Date().toISOString(),
    };
}


// ── Auto-detect ESP32 port ─────────────────────────────────
async function detectPort() {
    const ports = await SerialPort.list();
    // Prefer ports that look like USB-serial adapters
    const esp = ports.find(p =>
        /usbserial|usbmodem|SLAB_USB|CP210|CH340|FT232|ESP32/i.test(p.path + (p.manufacturer || ""))
    );
    return esp?.path || null;
}

// ── Start serial reading ───────────────────────────────────
async function startSerial(portPath) {
    console.log(`\n📡 Opening serial port: ${portPath} @ ${BAUD_RATE} baud`);
    const port = new SerialPort({ path: portPath, baudRate: BAUD_RATE });
    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

    port.on("open", () => console.log(`   Port opened successfully`));
    port.on("error", (err) => console.error(`   Serial error: ${err.message}`));

    parser.on("data", (rawLine) => {
        const line = rawLine.trim();
        if (line) {
            process.stdout.write(`[ESP32] ${line}\n`);
            const parsed = parseLine(line);
            if (parsed) {
                latestData = parsed;
                lastReceived = Date.now();
            }
        }
    });
}

// ── HTTP server ────────────────────────────────────────────
const server = http.createServer((req, res) => {
    // CORS — allow Vite dev server
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

    if (req.url === "/api/status" && req.method === "GET") {
        if (!latestData) {
            res.writeHead(503, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "No data yet — waiting for ESP32" }));
        }
        const age = Date.now() - lastReceived;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ...latestData, dataAgeMs: age }));
        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

// ── Main ───────────────────────────────────────────────────
(async () => {
    let portPath = SERIAL_PORT === "AUTO" ? await detectPort() : SERIAL_PORT;

    if (!portPath) {
        const ports = await SerialPort.list();
        console.error("\nNo ESP32 serial port detected automatically.");
        if (ports.length) {
            console.error("Available ports:");
            ports.forEach(p => console.error(`  ${p.path}  (${p.manufacturer || "unknown"})`));
            console.error('\nRun with:  node serial-bridge.js --port /dev/cu.YOUR_PORT');
        } else {
            console.error("No serial ports found at all. Plug in the ESP32 and try again.");
        }
        process.exit(1);
    }

    await startSerial(portPath);

    server.listen(HTTP_PORT, () => {
        console.log(`\n🌐 API server running at http://localhost:${HTTP_PORT}/api/status`);
        console.log(`   Dashboard will auto-switch from simulation to live data.\n`);
    });
})();
