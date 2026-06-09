import { useEffect, useMemo, useState } from "react";
import { Bug, X, Eraser } from "lucide-react";
import { typingDebug, TypingDebugEvent } from "@/lib/typingDebug";

interface Props {
  surface: "Chat" | "Messages";
  conversationKey: string | null;
  channelStatus: string;
  typingUsers: Map<string, string>;
}

const kindColor: Record<string, string> = {
  "subscribe": "text-blue-300",
  "subscribe-status": "text-blue-400",
  "presence-sync": "text-purple-300",
  "broadcast-send": "text-amber-300",
  "broadcast-recv": "text-emerald-300",
  "db-upsert": "text-cyan-300",
  "db-change": "text-emerald-400",
  "poll": "text-zinc-400",
  "set-remote": "text-pink-300",
  "cleanup": "text-red-300",
  "info": "text-zinc-300",
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}.${d.getMilliseconds().toString().padStart(3, "0")}`;
};

const TypingDebugOverlay = ({ surface, conversationKey, channelStatus, typingUsers }: Props) => {
  const [events, setEvents] = useState<TypingDebugEvent[]>([]);
  const [open, setOpen] = useState(true);
  const enabled = typingDebug.enabled();

  useEffect(() => {
    if (!enabled) return;
    return typingDebug.subscribe(setEvents);
  }, [enabled]);

  const filtered = useMemo(() => events.filter((e) => e.surface === surface), [events, surface]);

  if (!enabled) return null;

  const typingList = Array.from(typingUsers.entries());
  const lastBroadcastRecv = filtered.find((e) => e.kind === "broadcast-recv");
  const lastDbChange = filtered.find((e) => e.kind === "db-change");
  const lastBroadcastSend = filtered.find((e) => e.kind === "broadcast-send");

  return (
    <div
      className="fixed bottom-24 right-3 z-[9999] w-[340px] max-w-[calc(100vw-1.5rem)] rounded-lg border border-amber-500/50 bg-zinc-950/95 text-[11px] text-zinc-200 shadow-2xl backdrop-blur-sm"
      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-2 py-1.5">
        <div className="flex items-center gap-1.5 text-amber-300">
          <Bug className="h-3.5 w-3.5" />
          <span className="font-semibold">Typing Debug · {surface}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => typingDebug.clear()}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="Clear log"
          >
            <Eraser className="h-3 w-3" />
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title={open ? "Minimize" : "Expand"}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 border-b border-zinc-800 px-2 py-1.5">
            <div className="text-zinc-500">channel</div>
            <div className={channelStatus === "SUBSCRIBED" ? "text-emerald-400" : "text-amber-400"}>
              {channelStatus || "—"}
            </div>
            <div className="text-zinc-500">conv key</div>
            <div className="truncate" title={conversationKey ?? ""}>{conversationKey ?? "—"}</div>
            <div className="text-zinc-500">typing now</div>
            <div className={typingList.length ? "text-emerald-300" : "text-zinc-400"}>
              {typingList.length ? typingList.map(([id, name]) => `${name} (${id.slice(0, 6)})`).join(", ") : "—"}
            </div>
            <div className="text-zinc-500">last sent</div>
            <div className="text-amber-300">{lastBroadcastSend ? `${formatTime(lastBroadcastSend.ts)} · ${String(lastBroadcastSend.detail?.isTyping)}` : "—"}</div>
            <div className="text-zinc-500">last bcast</div>
            <div className="text-emerald-300">{lastBroadcastRecv ? formatTime(lastBroadcastRecv.ts) : "—"}</div>
            <div className="text-zinc-500">last db chg</div>
            <div className="text-emerald-400">{lastDbChange ? formatTime(lastDbChange.ts) : "—"}</div>
          </div>

          <div className="max-h-56 overflow-y-auto px-2 py-1.5">
            {filtered.length === 0 ? (
              <div className="text-zinc-500">No events yet. Have someone type to you…</div>
            ) : (
              filtered.map((e) => (
                <div key={e.id} className="flex gap-1.5 border-b border-zinc-900 py-0.5">
                  <span className="shrink-0 text-zinc-500">{formatTime(e.ts).slice(0, 12)}</span>
                  <span className={`shrink-0 font-semibold ${kindColor[e.kind] ?? "text-zinc-300"}`}>{e.kind}</span>
                  <span className="truncate text-zinc-400" title={JSON.stringify(e.detail ?? {})}>
                    {e.detail ? JSON.stringify(e.detail) : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TypingDebugOverlay;
