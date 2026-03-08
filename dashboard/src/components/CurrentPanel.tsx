import type { HistoryPoint, SensorData } from "../types";
import "./CurrentPanel.css";

interface Props {
    data: SensorData;
    history: HistoryPoint[];
}

const STRESSED_RATIO = 0.85;
const OVERLOAD_RATIO = 1.0;
const MIN_RATE = 0.0005; // ratio points per second
const MAX_FORECAST_SECONDS = 60 * 60;

interface EstimateCard {
    label: string;
    value: string;
    detail: string;
    tone: "safe" | "warn" | "danger" | "muted";
}

function formatDuration(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "Now";
    if (seconds < 60) return `${Math.round(seconds)} sec`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    return `${(seconds / 3600).toFixed(1)} hr`;
}

function estimateSeconds(currentRatio: number, targetRatio: number, slopePerSecond: number) {
    const delta = targetRatio - currentRatio;

    if (Math.abs(delta) < 0.005) return 0;
    if (Math.abs(slopePerSecond) < MIN_RATE) return null;
    if ((delta > 0 && slopePerSecond <= 0) || (delta < 0 && slopePerSecond >= 0)) return null;

    const seconds = delta / slopePerSecond;
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_FORECAST_SECONDS) return null;
    return seconds;
}

function buildEstimateCards(status: SensorData["status"], ratio: number, slopePerSecond: number | null): EstimateCard[] {
    if (slopePerSecond === null) {
        return [
            {
                label: "Trend ETA",
                value: "Calibrating",
                detail: "Need a few live samples before forecasting transitions.",
                tone: "muted",
            },
        ];
    }

    if (status === "SAFE") {
        const toStressed = estimateSeconds(ratio, STRESSED_RATIO, slopePerSecond);
        const stressedToOverload = estimateSeconds(STRESSED_RATIO, OVERLOAD_RATIO, slopePerSecond);

        return [
            {
                label: "Safe -> Stressed",
                value: toStressed === null ? "Stable" : formatDuration(toStressed),
                detail: toStressed === null ? "Load ratio is flat or moving away from the stressed band." : `At ${(slopePerSecond * 60).toFixed(2)} ratio/min.`,
                tone: toStressed === null ? "safe" : "warn",
            },
            {
                label: "Stressed -> Overload",
                value: stressedToOverload === null ? "Unclear" : formatDuration(stressedToOverload),
                detail: stressedToOverload === null ? "Only shown when the recent trend is still rising." : "Additional time after entering stressed.",
                tone: stressedToOverload === null ? "muted" : "danger",
            },
        ];
    }

    if (status === "STRESSED") {
        const toOverload = estimateSeconds(ratio, OVERLOAD_RATIO, slopePerSecond);
        const backToSafe = estimateSeconds(ratio, STRESSED_RATIO, slopePerSecond);

        return [
            {
                label: "Stressed -> Overload",
                value: toOverload === null ? "Holding" : formatDuration(toOverload),
                detail: toOverload === null ? "Recent samples are not climbing toward the overload threshold." : `At ${(slopePerSecond * 60).toFixed(2)} ratio/min.`,
                tone: toOverload === null ? "warn" : "danger",
            },
            {
                label: "Recovery to Safe",
                value: backToSafe === null ? "Not cooling" : formatDuration(backToSafe),
                detail: backToSafe === null ? "Needs a sustained downward trend to forecast recovery." : "Time to drop below the stressed band.",
                tone: backToSafe === null ? "muted" : "safe",
            },
        ];
    }

    const backToStressed = estimateSeconds(ratio, OVERLOAD_RATIO, slopePerSecond);
    const backToSafe = estimateSeconds(ratio, STRESSED_RATIO, slopePerSecond);

    return [
        {
            label: "Overload -> Stressed",
            value: backToStressed === null ? "Not recovering" : formatDuration(backToStressed),
            detail: backToStressed === null ? "Current trend is still flat or rising above the limit." : "Time to fall back under the limit.",
            tone: backToStressed === null ? "danger" : "warn",
        },
        {
            label: "Then to Safe",
            value: backToSafe === null ? "Not projected" : formatDuration(backToSafe),
            detail: backToSafe === null ? "Need continued cooling after leaving overload." : "Projected full recovery below stressed.",
            tone: backToSafe === null ? "muted" : "safe",
        },
    ];
}

export function CurrentPanel({ data, history }: Props) {
    const { I_actual, I_safe, status } = data;
    const ratio = I_actual / I_safe;
    const pct = Math.min(ratio * 100, 100);
    const overPct = Math.max(0, (ratio - 1) * 100);
    const recentHistory = history.slice(-8);

    let slopePerSecond: number | null = null;
    if (recentHistory.length >= 2) {
        const first = recentHistory[0];
        const last = recentHistory[recentHistory.length - 1];
        const elapsedSeconds = (last.ts - first.ts) / 1000;
        if (elapsedSeconds > 0) {
            slopePerSecond = ((last.I_actual / last.I_safe) - (first.I_actual / first.I_safe)) / elapsedSeconds;
        }
    }

    const estimateCards = buildEstimateCards(status, ratio, slopePerSecond);

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

                <div className="cp-estimates">
                    {estimateCards.map((card) => (
                        <div key={card.label} className={`cp-estimate cp-estimate--${card.tone}`}>
                            <div className="cp-estimate__label">{card.label}</div>
                            <div className="cp-estimate__value">{card.value}</div>
                            <div className="cp-estimate__detail">{card.detail}</div>
                        </div>
                    ))}
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
