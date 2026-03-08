import { useState, useEffect, useRef, useCallback } from "react";
import type { SensorData, LogEntry, LineStatus, HistoryPoint } from "../types";

// ── Config ──────────────────────────────────────────────────
// Point this at your ESP32's IP address.
// When running `npm run dev`, also set the Vite proxy target in vite.config.ts.
const API_URL = "/api/status";
const POLL_MS = 1500;
const STALE_MS = 8000;  // mark data stale if no update for 8 s
const MAX_HISTORY = 40;

// ── Hook ────────────────────────────────────────────────────
export function useStatusPoller() {
    const [data, setData] = useState<SensorData | null>(null);
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    const [log, setLog] = useState<LogEntry[]>([]);
    const [stale, setStale] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const lastStatusRef = useRef<LineStatus | null>(null);
    const lastUpdateRef = useRef<number>(Date.now());
    const logIdRef = useRef(0);

    const pushLog = useCallback((entry: Omit<LogEntry, "id">) => {
        setLog(prev => [{ ...entry, id: ++logIdRef.current }, ...prev].slice(0, 10));
    }, []);

    const processData = useCallback((d: SensorData) => {
        setData(d);
        setError(null);
        setStale(false);
        lastUpdateRef.current = Date.now();

        // Sparkline history
        const timeLabel = new Date().toLocaleTimeString([], {
            hour: "2-digit", minute: "2-digit", second: "2-digit",
        });
        setHistory(prev => [
            ...prev,
            { t: timeLabel, Tc: d.Tc, Ta: d.Ta, I_actual: d.I_actual, I_safe: d.I_safe },
        ].slice(-MAX_HISTORY));

        // Status change log
        if (lastStatusRef.current !== d.status) {
            const prev = lastStatusRef.current;
            lastStatusRef.current = d.status;
            const ts = new Date().toLocaleTimeString();
            if (prev !== null) {
                pushLog({
                    time: ts, status: d.status,
                    message: `Status → ${d.status}  |  ${d.I_actual.toFixed(1)}A ${d.I_actual > d.I_safe ? ">" : "≤"} ${d.I_safe.toFixed(1)}A limit`,
                });
            } else {
                pushLog({ time: ts, status: d.status, message: `Monitoring started — ${d.status}` });
            }
        }
    }, [pushLog]);

    useEffect(() => {
        let alive = true;

        async function poll() {
            if (!alive) return;
            try {
                const res = await fetch(API_URL, { signal: AbortSignal.timeout(4000) });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json: SensorData = await res.json();
                if (alive) processData(json);
            } catch (err: any) {
                if (alive) setError(err?.message ?? "Cannot reach ESP32");
            }
        }

        // Poll immediately then on interval
        poll();
        const pollId = setInterval(poll, POLL_MS);

        // Stale watcher
        const staleId = setInterval(() => {
            if (Date.now() - lastUpdateRef.current > STALE_MS) setStale(true);
        }, 2000);

        return () => {
            alive = false;
            clearInterval(pollId);
            clearInterval(staleId);
        };
    }, [processData]);

    return { data, history, log, stale, error };
}
