import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimePicker12hProps {
  value: string; // "HH:mm" 24-hour
  onChange: (value: string) => void;
  className?: string;
}

// Convert "HH:mm" -> { hour12, minute, period }
function parse(value: string) {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) {
    return { hour12: "", minute: "", period: "AM" as "AM" | "PM" };
  }
  const [hStr, mStr] = value.split(":");
  let h = parseInt(hStr, 10);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return { hour12: String(h12), minute: mStr, period };
}

function format24(hour12: string, minute: string, period: "AM" | "PM") {
  if (!hour12 || !minute) return "";
  let h = parseInt(hour12, 10) % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

export function TimePicker12h({ value, onChange, className }: TimePicker12hProps) {
  const { hour12, minute, period } = parse(value);

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  const update = (next: { hour12?: string; minute?: string; period?: "AM" | "PM" }) => {
    const h = next.hour12 ?? hour12;
    const m = next.minute ?? minute;
    const p = next.period ?? period;
    onChange(format24(h, m, p));
  };

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <Select value={hour12} onValueChange={(v) => update({ hour12: v })}>
        <SelectTrigger className="w-[70px]"><SelectValue placeholder="Hr" /></SelectTrigger>
        <SelectContent>
          {hours.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select value={minute} onValueChange={(v) => update({ minute: v })}>
        <SelectTrigger className="w-[70px]"><SelectValue placeholder="Min" /></SelectTrigger>
        <SelectContent className="max-h-60">
          {minutes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={period} onValueChange={(v) => update({ period: v as "AM" | "PM" })}>
        <SelectTrigger className="w-[75px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
