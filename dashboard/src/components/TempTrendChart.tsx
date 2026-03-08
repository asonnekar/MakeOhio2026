import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ReferenceLine,
    CartesianGrid,
    Legend,
} from "recharts";
import type { HistoryPoint, SensorData } from "../types";
import "./TempTrendChart.css";

interface Props {
    history: HistoryPoint[];
    data: SensorData;
}

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip__time">{label}</div>
            {payload.map((p: any) => (
                <div key={p.dataKey} className="chart-tooltip__row">
                    <span className="chart-tooltip__dot" style={{ background: p.color }} />
                    <span className="chart-tooltip__key">{p.dataKey === "Tc" ? "Conductor" : "Ambient"}</span>
                    <span className="chart-tooltip__val">{p.value.toFixed(1)} °C</span>
                </div>
            ))}
        </div>
    );
}

// Show max every Nth tick label to avoid crowding
function tickFormatter(_: string, index: number, history: HistoryPoint[]) {
    const step = Math.max(1, Math.floor(history.length / 6));
    return index % step === 0 ? history[index]?.t ?? "" : "";
}

export function TempTrendChart({ history, data }: Props) {
    const minY = Math.floor(Math.min(...history.map(h => Math.min(h.Tc, h.Ta))) - 3);
    const maxY = Math.ceil(Math.max(...history.map(h => Math.max(h.Tc, h.Ta))) + 3);

    return (
        <div className="trend-chart card">
            <div className="card__head">
                <div className="card__title">
                    <span className="card__title-dot" />
                    Temperature Trend
                </div>
                <div className="trend-chart__legend">
                    <span className="trend-chart__key trend-chart__key--tc">Conductor Tc</span>
                    <span className="trend-chart__key trend-chart__key--ta">Ambient Ta</span>
                </div>
            </div>
            <div className="card__body trend-chart__body">
                {history.length < 3 ? (
                    <div className="trend-chart__waiting">Collecting data…</div>
                ) : (
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradTc" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#c8102e" stopOpacity={0.18} />
                                    <stop offset="95%" stopColor="#c8102e" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradTa" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#737373" stopOpacity={0.14} />
                                    <stop offset="95%" stopColor="#737373" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-150)" vertical={false} />
                            <XAxis
                                dataKey="t"
                                tick={{ fontSize: 9, fill: "var(--gray-400)", fontFamily: "var(--mono)" }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(_, i) => tickFormatter(_, i, history)}
                                interval={0}
                            />
                            <YAxis
                                domain={[minY, maxY]}
                                tick={{ fontSize: 9, fill: "var(--gray-400)", fontFamily: "var(--mono)" }}
                                tickLine={false}
                                axisLine={false}
                                unit="°"
                            />
                            <Tooltip content={<CustomTooltip />} />
                            {/* Danger threshold line at Tc > 60 */}
                            <ReferenceLine
                                y={60}
                                stroke="var(--red)"
                                strokeDasharray="4 3"
                                strokeOpacity={0.4}
                                label={{ value: "Thermal limit", position: "insideTopLeft", fontSize: 9, fill: "var(--red)", fillOpacity: 0.6 }}
                            />
                            <Area
                                type="monotone"
                                dataKey="Ta"
                                stroke="var(--gray-400)"
                                strokeWidth={1.5}
                                fill="url(#gradTa)"
                                dot={false}
                                animationDuration={300}
                                name="Ta"
                            />
                            <Area
                                type="monotone"
                                dataKey="Tc"
                                stroke="var(--red)"
                                strokeWidth={2}
                                fill="url(#gradTc)"
                                dot={false}
                                animationDuration={300}
                                name="Tc"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
                <div className="trend-chart__footer">
                    <span>ΔT = {(data.Tc - data.Ta) > 0 ? "+" : ""}{(data.Tc - data.Ta).toFixed(1)} °C above ambient</span>
                    <span>Last: Tc {data.Tc.toFixed(1)} °C · Ta {data.Ta.toFixed(1)} °C</span>
                </div>
            </div>
        </div>
    );
}
