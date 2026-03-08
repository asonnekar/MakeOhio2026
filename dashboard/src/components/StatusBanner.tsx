import type { LineStatus } from "../types";
import "./StatusBanner.css";

interface Props { status: LineStatus; }

const CFG: Record<LineStatus, {
    label: string; tagline: string; barClass: string; textClass: string; iconCls: string;
}> = {
    SAFE: {
        label: "SAFE",
        tagline: "Line operating within rated thermal capacity",
        barClass: "banner--safe", textClass: "banner__status--safe", iconCls: "banner__icon--safe",
    },
    STRESSED: {
        label: "STRESSED",
        tagline: "Approaching thermal limit — reduce load or increase cooling",
        barClass: "banner--stressed", textClass: "banner__status--stressed", iconCls: "banner__icon--stressed",
    },
    OVERLOAD: {
        label: "OVERLOAD",
        tagline: "Current exceeds rated limit — immediate intervention required",
        barClass: "banner--overload", textClass: "banner__status--overload", iconCls: "banner__icon--overload",
    },
};

export function StatusBanner({ status }: Props) {
    const cfg = CFG[status];
    return (
        <div className={`banner ${cfg.barClass}`}>
            <div className={`banner__icon ${cfg.iconCls}`} />
            <div className="banner__body">
                <div className="banner__eyebrow">LINE STATUS</div>
                <div className={`banner__label ${cfg.textClass}`}>{cfg.label}</div>
                <div className="banner__tagline">{cfg.tagline}</div>
            </div>
            <div className="banner__indicators">
                <div className={`banner__dot ${status === "SAFE" || status === "STRESSED" || status === "OVERLOAD" ? "banner__dot--active banner__dot--safe" : ""}`} />
                <div className={`banner__dot ${status === "STRESSED" || status === "OVERLOAD" ? "banner__dot--active banner__dot--stressed" : ""}`} />
                <div className={`banner__dot ${status === "OVERLOAD" ? "banner__dot--active banner__dot--overload" : ""}`} />
            </div>
        </div>
    );
}
