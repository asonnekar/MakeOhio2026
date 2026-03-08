export type LineStatus = "SAFE" | "STRESSED" | "OVERLOAD";

export interface SensorData {
  Tc: number;
  Ta: number;
  humidity: number;
  I_safe: number;
  I_actual: number;
  status: LineStatus;
  fanOn: boolean;
  timestamp: string;
}

export interface HistoryPoint {
  t: string;      // short time label e.g. "21:30"
  Tc: number;
  Ta: number;
  I_actual: number;
  I_safe: number;
}

export interface LogEntry {
  id: number;
  time: string;
  message: string;
  status: LineStatus;
}
