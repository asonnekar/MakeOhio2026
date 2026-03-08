import { useStatusPoller } from "./hooks/useStatusPoller";
import { StatusBanner } from "./components/StatusBanner";
import { CurrentPanel } from "./components/CurrentPanel";
import { TempTrendChart } from "./components/TempTrendChart";
import { ConditionsPanel } from "./components/ConditionsPanel";
import { EventLog } from "./components/EventLog";
import "./SmartLineDashboard.css";

/* ── Subtle animated wave background ── */
function DashBg() {
    return (
        <div className="dash-bg" aria-hidden="true">
            <div className="dash-bg__wave dash-bg__wave--1" />
            <div className="dash-bg__wave dash-bg__wave--2" />
            <div className="dash-bg__wave dash-bg__wave--3" />
            <div className="dash-bg__wave dash-bg__wave--4" />
        </div>
    );
}

export function SmartLineDashboard() {
    const { data, history, log, stale } = useStatusPoller();


    if (!data) {
        return (
            <div className="loading-screen">
                <div className="loading-screen__spinner" />
                <p className="loading-screen__text">Connecting to SmartLine Guardian…</p>
            </div>
        );
    }

    const dotCls =
        data.status === "STRESSED" ? "pill-dot--orange"
            : data.status === "OVERLOAD" ? "pill-dot--red"
                : "";

    return (
        <div className="dashboard">
            <DashBg />
            {/* ── Topbar ── */}
            <header className="topbar">
                <div className="topbar__left">
                    <img src="/logo.png" alt="SmartLine Guardian" className="topbar__logo" />
                    <div className="topbar__sep" />
                    <div>
                        <div className="topbar__title">SmartLine Guardian</div>
                        <div className="topbar__sub">AEP Power Transmission Line Monitor · MakeOHI/O</div>
                    </div>
                </div>
                <div className="topbar__right">

                    {stale && <span className="tag tag--warn">STALE DATA</span>}
                    <div className="topbar__pill">
                        <span className={`pill-dot ${dotCls}`} />
                        {data.status}
                    </div>
                    <span className="topbar__ts">{new Date(data.timestamp).toLocaleTimeString()}</span>
                </div>
            </header>

            {/* ── Page ── */}
            <div className="dashboard__inner">
                {/* Status banner — full width, dominant */}
                <StatusBanner status={data.status} />

                {/* Row 1: Current gauge (dominant) + Temp trend */}
                <div className="dashboard__row">
                    <CurrentPanel data={data} history={history} />
                    <TempTrendChart history={history} data={data} />
                </div>

                {/* Row 2: Conditions + Event log */}
                <div className="dashboard__row dashboard__row--bottom">
                    <ConditionsPanel data={data} />
                    <EventLog entries={log} />
                </div>
            </div>

            {/* ── Footer ── */}
            <footer className="dashboard__footer">
                <span className="footer__brand">SmartLine Guardian</span>
                <span>Team Truxie · Aneesh Sonnekar · Luke Fenstermaker · Conlan Mayberry</span>
                <span>MakeOHI/O · Live hardware feed</span>
            </footer>
        </div>
    );
}
