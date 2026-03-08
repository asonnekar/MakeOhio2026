import type { SensorData } from "../types";
import "./ConditionsPanel.css";

interface Props { data: SensorData; }

function buildExplanation(data: SensorData): string {
    const parts: string[] = [];
    if (data.Ta > 30) parts.push("High environmental temp reduces safe current rating");

    if (data.humidity > 70) parts.push("Elevated humidity may affect sensor accuracy");
    if (data.Tc > 55) parts.push("Line temperature is elevated");
    if (data.sagMeters != null && data.sagMeters > 0.55) parts.push("Predicted sag is elevated — clearance may be reduced");
    if (parts.length === 0) parts.push("All conditions are nominal");
    return parts.join(". ") + ".";
}

interface RowProps {
    label: string; value: string; sub?: string;
    alert?: boolean; positive?: boolean;
}

function Row({ label, value, sub, alert, positive }: RowProps) {
    return (
        <div className={`cp2-row ${alert ? "cp2-row--alert" : ""} ${positive ? "cp2-row--positive" : ""}`}>
            <div className="cp2-row__info">
                <span className="cp2-row__label">{label}</span>
                {sub && <span className="cp2-row__sub">{sub}</span>}
            </div>
            <span className="cp2-row__value">{value}</span>
        </div>
    );
}

export function ConditionsPanel({ data }: Props) {
    return (
        <div className="cp2 card">
            <div className="card__head">
                <div className="card__title">
                    <span className="card__title-dot" />
                    Conditions
                </div>
            </div>
            <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="cp2-rows">
                    <Row label="Line Temp" sub="Thermistor"
                        value={`${data.Tc.toFixed(1)} °C`} alert={data.Tc > 55} />
                    <Row label="Environmental Temp" sub="DHT11"
                        value={`${data.Ta.toFixed(1)} °C`} alert={data.Ta > 32} />
                    <Row label="Humidity" sub="DHT11"
                        value={`${data.humidity.toFixed(0)} %`} alert={data.humidity > 75} />

                    <Row label="Predicted Sag" sub="Thermal model"
                        value={data.sagMeters != null ? `${data.sagMeters.toFixed(3)} m` : "—"}
                        alert={data.sagMeters != null && data.sagMeters > 0.55} />
                    <Row label="Rated Limit" sub="I_safe"
                        value={`${data.I_safe.toFixed(1)} A`} />
                </div>

                <div className="cp2-note">
                    <div className="cp2-note__icon" />
                    <p className="cp2-note__text">{buildExplanation(data)}</p>
                </div>
            </div>
        </div>
    );
}
