// Lightweight typing-indicator debug bus.
// Enable in browser console:  localStorage.setItem('debugTyping','1'); location.reload();
// Or visit any chat URL with ?debugTyping=1
//
// All event payloads land in a ring buffer that <TypingDebugOverlay /> subscribes to.

export type TypingDebugKind =
  | "subscribe"
  | "subscribe-status"
  | "presence-sync"
  | "broadcast-send"
  | "broadcast-recv"
  | "db-upsert"
  | "db-change"
  | "poll"
  | "set-remote"
  | "cleanup"
  | "info";

export interface TypingDebugEvent {
  id: number;
  ts: number;
  surface: "Chat" | "Messages";
  kind: TypingDebugKind;
  conversationKey?: string | null;
  detail?: Record<string, unknown>;
}

const MAX_EVENTS = 60;
const listeners = new Set<(events: TypingDebugEvent[]) => void>();
let buffer: TypingDebugEvent[] = [];
let nextId = 1;

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("debugTyping") === "1") return true;
    if (new URLSearchParams(window.location.search).get("debugTyping") === "1") {
      localStorage.setItem("debugTyping", "1");
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export const typingDebug = {
  enabled: isEnabled,
  log(surface: TypingDebugEvent["surface"], kind: TypingDebugKind, detail?: TypingDebugEvent["detail"], conversationKey?: string | null) {
    if (!isEnabled()) return;
    const evt: TypingDebugEvent = { id: nextId++, ts: Date.now(), surface, kind, conversationKey, detail };
    buffer = [evt, ...buffer].slice(0, MAX_EVENTS);
    listeners.forEach((l) => l(buffer));
    // Also echo to console so users can grep [typing-debug]
    // eslint-disable-next-line no-console
    console.debug(`[typing-debug:${surface}:${kind}]`, conversationKey ?? "", detail ?? {});
  },
  subscribe(listener: (events: TypingDebugEvent[]) => void) {
    listeners.add(listener);
    listener(buffer);
    return () => listeners.delete(listener);
  },
  clear() {
    buffer = [];
    listeners.forEach((l) => l(buffer));
  },
};
