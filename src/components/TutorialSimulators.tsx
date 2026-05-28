import { MessageSquare, MapPin, CalendarCheck, Bell, Check, CheckCheck, Navigation, Sparkles } from "lucide-react";

type Sim = {
  title: string;
  subtitle: string;
  accent: string; // tailwind gradient stops
  ring: string;
  icon: React.ComponentType<{ className?: string }>;
  screen: React.ReactNode;
};

const PhoneFrame = ({ children, accent }: { children: React.ReactNode; accent: string }) => (
  <div className="relative mx-auto w-full max-w-[260px]">
    <div className={`absolute -inset-4 rounded-[3rem] bg-gradient-to-br ${accent} opacity-20 blur-2xl`} />
    <div className="relative rounded-[2.2rem] border border-white/10 bg-neutral-900 p-2 shadow-2xl">
      <div className="relative h-[440px] w-full overflow-hidden rounded-[1.8rem] bg-gradient-to-b from-neutral-950 to-neutral-900">
        {/* notch */}
        <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
        <div className="absolute inset-0 z-10 pt-8">{children}</div>
      </div>
    </div>
  </div>
);

const MessagingScreen = () => (
  <div className="flex h-full flex-col px-3 pb-3">
    <div className="mb-2 text-center text-[11px] font-semibold text-white/80">Donatello • Drummer</div>
    <div className="flex-1 space-y-2 overflow-hidden">
      <div className="flex justify-start opacity-0 [animation:msg-in_.6s_ease-out_.3s_forwards]">
        <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-[11px] text-white">
          Hey! Ready for Friday's gig?
        </div>
      </div>
      <div className="flex justify-end opacity-0 [animation:msg-in_.6s_ease-out_1.3s_forwards]">
        <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-gradient-to-br from-blue-500 to-blue-600 px-3 py-2 text-[11px] text-white">
          Absolutely. Setlist locked in 🎶
        </div>
      </div>
      <div className="flex justify-start opacity-0 [animation:msg-in_.6s_ease-out_2.3s_forwards]">
        <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-[11px] text-white">
          Perfect — see you at 6!
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 pr-1 text-[9px] text-white/50 opacity-0 [animation:msg-in_.4s_ease-out_3.1s_forwards]">
        <CheckCheck className="h-3 w-3 text-blue-400" /> Read
      </div>
    </div>
    <div className="mt-2 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
      <div className="h-1.5 w-24 rounded-full bg-white/10">
        <div className="h-full w-0 rounded-full bg-white/40 [animation:type-bar_3s_ease-in-out_3.4s_infinite]" />
      </div>
      <Check className="ml-auto h-3 w-3 text-white/40" />
    </div>
  </div>
);

const TrackingScreen = () => (
  <div className="relative h-full">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(16,185,129,0.18),transparent_60%)]" />
    {/* grid */}
    <div
      className="absolute inset-0 opacity-30"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    />
    {/* route */}
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 240 400" fill="none">
      <path
        d="M30 360 C 80 280, 60 220, 130 180 S 200 80, 210 40"
        stroke="rgb(16 185 129)"
        strokeWidth="3"
        strokeDasharray="6 6"
        className="[stroke-dashoffset:200] [animation:dash_3s_linear_infinite]"
      />
    </svg>
    {/* venue pin */}
    <div className="absolute right-4 top-6 flex flex-col items-center">
      <div className="rounded-full bg-red-500 p-1.5 shadow-lg">
        <MapPin className="h-3 w-3 text-white" />
      </div>
      <span className="mt-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white">Venue</span>
    </div>
    {/* moving performer */}
    <div className="absolute left-6 top-[340px] [animation:travel_4s_ease-in-out_infinite]">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
        <div className="relative rounded-full bg-emerald-500 p-1.5 shadow-lg">
          <Navigation className="h-3 w-3 text-white" />
        </div>
      </div>
    </div>
    {/* ETA card */}
    <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] text-white/60">Arriving in</div>
          <div className="text-lg font-bold text-emerald-400">12 min</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-white/60">Status</div>
          <div className="text-[11px] font-semibold text-white">On time</div>
        </div>
      </div>
    </div>
  </div>
);

const BookingScreen = () => (
  <div className="flex h-full flex-col gap-2 px-3 pb-3">
    <div className="text-center text-[11px] font-semibold text-white/80">New Booking Request</div>
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600" />
        <div className="flex-1">
          <div className="text-[11px] font-semibold text-white">Saturday Jazz Night</div>
          <div className="text-[9px] text-white/60">The Blue Note • Sat 8:00 PM</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px]">
        <div className="rounded-md bg-white/5 p-1.5">
          <div className="text-white/50">Pay</div>
          <div className="font-semibold text-white">$850</div>
        </div>
        <div className="rounded-md bg-white/5 p-1.5">
          <div className="text-white/50">Set</div>
          <div className="font-semibold text-white">2×45m</div>
        </div>
        <div className="rounded-md bg-white/5 p-1.5">
          <div className="text-white/50">Crew</div>
          <div className="font-semibold text-white">4</div>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <button className="rounded-lg border border-white/10 bg-white/5 py-2 text-[10px] font-semibold text-white/70">
        Decline
      </button>
      <button className="relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 py-2 text-[10px] font-semibold text-white shadow-lg [animation:pulse-btn_2.4s_ease-in-out_infinite]">
        Accept Gig
      </button>
    </div>
    <div className="mt-1 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 opacity-0 [animation:msg-in_.6s_ease-out_2s_forwards]">
      <Check className="h-3.5 w-3.5 text-emerald-400" />
      <span className="text-[10px] font-medium text-emerald-300">Confirmed & added to calendar</span>
    </div>
    <div className="mt-auto text-center text-[9px] text-white/40">Auto-synced to your team</div>
  </div>
);

const NotificationsScreen = () => (
  <div className="flex h-full flex-col gap-2 px-3 pb-3">
    <div className="text-center text-[11px] font-semibold text-white/80">Smart Reminders</div>
    {[
      { t: "Gig starts in 60 minutes", s: "The Blue Note • Tonight", d: "0.2s", c: "from-amber-500 to-orange-500", i: Bell },
      { t: "Sarah confirmed availability", s: "Saturday Jazz Night", d: "1.0s", c: "from-emerald-500 to-emerald-600", i: Check },
      { t: "Setlist updated", s: "Marco added 2 new songs", d: "1.8s", c: "from-violet-500 to-fuchsia-500", i: Sparkles },
      { t: "Payment received", s: "$850 from The Blue Note", d: "2.6s", c: "from-blue-500 to-cyan-500", i: CalendarCheck },
    ].map((n) => {
      const Icon = n.i;
      return (
        <div
          key={n.t}
          style={{ animationDelay: n.d }}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 opacity-0 [animation:slide-in_.5s_ease-out_forwards]"
        >
          <div className={`rounded-lg bg-gradient-to-br ${n.c} p-1.5`}>
            <Icon className="h-3 w-3 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-semibold leading-tight text-white">{n.t}</div>
            <div className="text-[9px] text-white/55">{n.s}</div>
          </div>
        </div>
      );
    })}
  </div>
);

const sims: Sim[] = [
  {
    title: "Real-time Messaging",
    subtitle: "Coordinate with your crew in iMessage-style threads with read receipts.",
    accent: "from-blue-500 to-cyan-500",
    ring: "text-blue-400",
    icon: MessageSquare,
    screen: <MessagingScreen />,
  },
  {
    title: "Arrival Tracking",
    subtitle: "Live ETAs so managers know exactly when performers will arrive.",
    accent: "from-emerald-500 to-teal-500",
    ring: "text-emerald-400",
    icon: MapPin,
    screen: <TrackingScreen />,
  },
  {
    title: "One-Tap Booking",
    subtitle: "Send, accept, and confirm gigs in seconds — auto-synced to everyone.",
    accent: "from-violet-500 to-fuchsia-500",
    ring: "text-violet-400",
    icon: CalendarCheck,
    screen: <BookingScreen />,
  },
  {
    title: "Smart Notifications",
    subtitle: "Proximity alerts, confirmations, and payment updates — automatically.",
    accent: "from-amber-500 to-orange-500",
    ring: "text-amber-400",
    icon: Bell,
    screen: <NotificationsScreen />,
  },
];

export const TutorialSimulators = () => {
  return (
    <section id="see-in-action" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
      <style>{`
        @keyframes msg-in { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform: translateY(0) } }
        @keyframes slide-in { from { opacity:0; transform: translateX(20px) } to { opacity:1; transform: translateX(0) } }
        @keyframes type-bar { 0%,100% { width: 0 } 50% { width: 100% } }
        @keyframes dash { to { stroke-dashoffset: 0 } }
        @keyframes travel {
          0% { transform: translate(0, 0) }
          50% { transform: translate(110px, -200px) }
          100% { transform: translate(180px, -310px) }
        }
        @keyframes pulse-btn { 0%,100% { box-shadow: 0 0 0 0 rgba(59,130,246,.6) } 50% { box-shadow: 0 0 0 8px rgba(59,130,246,0) } }
      `}</style>
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">See GiggMe in action</h2>
        <p className="mt-3 text-white/60 max-w-2xl mx-auto">
          Four quick simulations of the features your team will use every day.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {sims.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.title}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm hover:border-white/20 hover:bg-white/[0.06] transition-all"
            >
              <PhoneFrame accent={s.accent}>{s.screen}</PhoneFrame>
              <div className="mt-5 flex items-center gap-2">
                <div className={`rounded-lg bg-gradient-to-br ${s.accent} p-1.5`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white">{s.title}</h3>
              </div>
              <p className="mt-2 text-sm text-white/55 leading-relaxed">{s.subtitle}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
