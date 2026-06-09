import { useEffect, useState, useCallback } from "react";

export type TimeFormat = "12h" | "24h";

const STORAGE_KEY = "time_format_pref";
const EVENT_NAME = "time-format-changed";

export function getTimeFormat(): TimeFormat {
  if (typeof window === "undefined") return "12h";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "24h" ? "24h" : "12h";
}

export function formatTimeString(text: string, fmt?: TimeFormat): string {
  const format = fmt ?? getTimeFormat();
  if (!text) return text;
  if (format === "24h") return text;
  return text.replace(/\b(\d{1,2}):(\d{2})\b/g, (_, hh, mm) => {
    const h = parseInt(hh, 10);
    if (isNaN(h) || h < 0 || h > 23) return `${hh}:${mm}`;
    const period = h >= 12 ? "pm" : "am";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return mm === "00" ? `${h12}${period}` : `${h12}:${mm}${period}`;
  });
}

export function useTimeFormat() {
  const [format, setFormatState] = useState<TimeFormat>(() => getTimeFormat());

  useEffect(() => {
    const handler = () => setFormatState(getTimeFormat());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setFormat = useCallback((f: TimeFormat) => {
    window.localStorage.setItem(STORAGE_KEY, f);
    window.dispatchEvent(new Event(EVENT_NAME));
    setFormatState(f);
  }, []);

  const formatTime = useCallback((text: string) => formatTimeString(text, format), [format]);

  return { format, setFormat, formatTime };
}
