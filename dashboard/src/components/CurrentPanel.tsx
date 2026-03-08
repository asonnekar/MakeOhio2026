import type { SensorData } from "../types";
import "./CurrentPanel.css";

interface Props { data: SensorData; }

export function CurrentPanel({ data }: Props) {
    const { I_actual, I_safe, status } = data;
    const ratio = I_actual / I_safe;
    const pct = Math.min(ratio * 100, 100);
    const overPct = Math.max(0, (ratio - 1) * 100);

    const fillColor =
        status === "OVERLOAD" ? "var(--red)"
            : status === "STRESSED" ? "var(--warn)"
                : "var(--safe)";

    const numColor =
        status === "OVERLOAD" ? "var(--red)"
            : status === "STRESSED" ? "var(--warn)"
                : "var(--safe)";

    return (
        <div className="cp card">
            <div className="card__head">
                <div className="card__title">
                    <span className="card__title-dot" />
                    Current Load vs Safe Limit
                </div>
                <span className={`cp-tag cp-tag--${status.toLowerCase()}`}>
                    {(ratio * 100).toFixed(0)}% of limit
                </span>
            </div>
            <div className="card__body">
                {/* Primary readout */}
                <div className="cp-primary">
                    <div className="cp-primary__block">
                        <div className="cp-primary__label">ACTUAL LOAD</div>
                        <div className="cp-primary__val" style={{ color: numColor }}>
                            {I_actual.toFixed(1)}
                            <span className="cp-primary__unit">A</span>
                        </div>
                    </div>
                    <div className="cp-primary__div" />
                    <div className="cp-primary__block">
                        <div className="cp-primary__label">SAFE LIMIT</div>
                        <div className="cp-primary__val cp-primary__val--muted">
                            {I_safe.toFixed(1)}
                            <span className="cp-primary__unit">A</span>
                        </div>
                    </div>
                    <div className="cp-primary__div" />
                    <div className="cp-primary__block">
                        <div className="cp-primary__label">HEADROOM</div>
                        <div className="cp-primary__val" style={{ color: ratio < 1 ? "var(--safe)" : "var(--red)", fontSize: 28 }}>
                            {ratio < 1 ? `+${(I_safe - I_actual).toFixed(1)}` : `−${(I_actual - I_safe).toFixed(1)}`}
                            <span className="cp-primary__unit" style={{ fontSize: 14 }}>A</span>
                        </div>
                    </div>
                </div>

                {/* Gauge bar — the dominant visual */}
                <div className="cp-gauge-wrap">
                    <div className="cp-gauge-labels-top">
                        <span>0 A</span>
                        <span>Dynamic limit: <strong>{I_safe.toFixed(1)} A</strong></span>
                    </div>
                    <div className="cp-gauge-track">
                        {/* Background capacity zones */}
                        <div className="cp-gauge-zone cp-gauge-zone--safe" style={{ width: "66.7%" }} />
                        <div className="cp-gauge-zone cp-gauge-zone--over" style={{ left: "66.7%", right: 0 }} />
                        {/* Actual fill */}
                        <div
                            className="cp-gauge-fill"
                            style={{ width: `${pct}%`, background: fillColor }}
                        />
                        {/* Overflow striped */}
                        {overPct > 0 && (
                            <div
                                className="cp-gauge-overflow"
                                style={{ width: `${Math.min(overPct * 0.67, 22)}%` }}
                            />
                        )}
                        {/* Limit marker */}
                        <div className="cp-gauge-marker" style={{ left: "66.7%" }}>
                            <div className="cp-gauge-marker-line" />
                            <div className="cp-gauge-marker-label">Limit</div>
                        </div>
                        {/* Actual position dot */}
                        <div
                            className={`cp-gauge-cur cp-gauge-cur--${status.toLowerCase()}`}
                            style={{ left: `${Math.min(pct, 98)}%` }}
                        />
                    </div>
                    <div className="cp-gauge-legend">
                        <span className="cp-gauge-legend__item cp-gauge-legend__item--safe">Within limit</span>
                        <span className="cp-gauge-legend__item cp-gauge-legend__item--over">Exceeds limit</span>
                    </div>
                </div>

                {/* Metadata row */}
                <div className="cp-meta">
                    <div className="cp-meta__item">
                        <span className="cp-meta__label">Load Ratio</span>
                        <span className="cp-meta__val">{ratio.toFixed(2)}</span>
                    </div>
                    <div className="cp-meta__item">
                        <span className="cp-meta__label">Fan Cooling</span>
                        <span className="cp-meta__val" style={{ color: data.fanOn ? "var(--safe)" : "var(--gray-500)" }}>
                            {data.fanOn ? "Active" : "Off"}
                        </span>
                    </div>
                    <div className="cp-meta__item">
                        <span className="cp-meta__label">Humidity</span>
                        <span className="cp-meta__val">{data.humidity.toFixed(0)} %</span>
                    </div>
                    <div className="cp-meta__item">
                        <span className="cp-meta__label">Line Temp</span>
                        <span className="cp-meta__val" style={{ color: data.Tc > 55 ? "var(--red)" : "inherit" }}>
                            {data.Tc.toFixed(1)} °C
                        </span>
                    </div>
                </div>

                {/* Plain-English insight */}
                <div className="cp-insight">
                    <div className="cp-insight__bar" style={{ background: fillColor }} />
                    <p className="cp-insight__text">
                        {status === "SAFE" && "Line is operating comfortably. Current ambient and wind conditions keep the thermal limit elevated."}
                        {status === "STRESSED" && `Load is approaching the dynamic limit. ${!data.fanOn ? "No wind cooling is reducing the safe current — " : "Rising environmental temperature is compressing the safe margin — "}monitor closely.`}
                        {status === "OVERLOAD" && `Load exceeds the thermal rating by ${(I_actual - I_safe).toFixed(1)} A. The conductor is accumulating heat. Reduce load or increase cooling immediately.`}
                    </p>
                </div>
            </div>
        </div>
    );
}
