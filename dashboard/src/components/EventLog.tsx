import type { LogEntry } from "../types";
import "./EventLog.css";

interface Props { entries: LogEntry[]; }



export function EventLog({ entries }: Props) {
    return (
        <div className="el card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card__head">
                <div className="card__title">
                    <span className="card__title-dot" />
                    Event Log
                </div>
                <span className="el__count">{entries.length}/10</span>
            </div>

            {entries.length === 0 ? (
                <div className="el__empty">
                    <div className="el__empty-icon" />
                    <p>Awaiting first status event…</p>
                </div>
            ) : (
                <ul className="el__list">
                    {entries.map((e, i) => (
                        <li
                            key={e.id}
                            className={`el__item el__item--${e.status.toLowerCase()} ${i === 0 ? "el__item--new" : ""}`}
                        >
                            <div className={`el__dot el__dot--${e.status.toLowerCase()}`} />
                            <div className="el__body">
                                <div className={`el__msg ${i > 0 ? "el__msg--muted" : ""}`}>{e.message}</div>
                                <div className="el__time">{e.time}</div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
