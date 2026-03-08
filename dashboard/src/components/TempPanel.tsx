import type { SensorData } from "../types";
import "./TempPanel.css";

interface Props { data: SensorData; }

function RingGauge({
    value, max, label, colorVar, unit = "°C",
}: {
    value: number; max: number; label: string; colorVar: string; unit?: string;
}) {
    const r = 44;
    const circ = 2 * Math.PI * r;
    const pct = Math.min(value / max, 1);

    return (
        <div className="ring-gauge">
            <svg viewBox="0 0 100 100" className="ring-gauge__svg" aria-label={label}>
                {/* Track */}
                <circle cx="50" cy="50" r={r} className="ring-gauge__track" />
                {/* Fill */}
                <circle
                    cx="50" cy="50" r={r}
                    className="ring-gauge__fill"
                    style={{ stroke: colorVar, strokeDasharray: `${pct * circ} ${circ}` }}
                    transform="rotate(-90 50 50)"
                    strokeLinecap="round"
                />
            </svg>
            <div className="ring-gauge__center">
                <span className="ring-gauge__value">{value.toFixed(1)}</span>
                <span className="ring-gauge__unit">{unit}</span>
            </div>
            <div className="ring-gauge__label">{label}</div>
        </div>
    );
}

export function TempPanel({ data }: Props) {
    const delta = data.Tc - data.Ta;
    const riskPct = Math.min(((data.Tc - 30) / 50) * 100, 100);

    return (
        <div className="temp-panel card">
            <div className="card__head">
                <div className="card__title">
                    <span className="card__title-dot" />
                    Temperature
                </div>
                <span className="tp-sensor">DHT11 · Thermistor</span>
            </div>
            <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Rings */}
                <div className="tp-rings">
                    <RingGauge value={data.Tc} max={90} label="Conductor Tc" colorVar="#c8102e" />
                    <RingGauge value={data.Ta} max={55} label="Ambient Ta" colorVar="#737373" />
                </div>

                {/* Delta */}
                <div className="tp-delta">
                    <div className="tp-delta__label">ΔT Conductor − Ambient</div>
                    <div className="tp-delta__value">{delta >= 0 ? "+" : ""}{delta.toFixed(1)} °C</div>
                </div>

                {/* Thermal risk bar */}
                <div>
                    <div className="tp-risk-label">
                        <span>Thermal Risk</span>
                        <span style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>
                            {riskPct.toFixed(0)}%
                        </span>
                    </div>
                    <div className="tp-risk-track">
                        <div
                            className="tp-risk-fill"
                            style={{
                                width: `${riskPct}%`,
                                background: riskPct > 70 ? "var(--red)" : riskPct > 40 ? "var(--warn)" : "var(--safe)",
                            }}
                        />
                    </div>
                    <div className="tp-risk-ticks">
                        <span>Low</span><span>Medium</span><span>High</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
