import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Music,
  Mic,
  Calendar,
  Search,
  Moon,
  Sun,
  Menu,
  ArrowRight,
  Play,
  Sparkles,
  Clock,
  ShieldCheck,
  ChevronDown,
  LogIn,
  UserPlus,
  DollarSign,
  HelpCircle,
  Users,
  MapPin,
  Bell,
  MessageSquare,
  DollarSign as DollarIcon,
  BarChart3,
  Settings as SettingsIcon,
  LayoutDashboard,
  UserPlus2,
  Send,
  CheckCircle2,
  Star,
  Check,
  ChevronRight,
} from "lucide-react";

import logo from "@/assets/logo.png";
import avatar1 from "@/assets/avatar-1.jpg";
import avatar2 from "@/assets/avatar-2.jpg";
import avatar3 from "@/assets/avatar-3.jpg";


const Index = () => {
  const navigate = useNavigate();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Force dark theme on landing for the modern look
  useEffect(() => {
    if (resolvedTheme !== "dark") setTheme("dark");
  }, [resolvedTheme, setTheme]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) navigate("/dashboard");
    };
    checkAuth();
  }, [navigate]);


  const features = [
    { icon: Calendar, title: "Gig Scheduling", desc: "Create gigs and assign performers in seconds.", color: "text-blue-400", bg: "bg-blue-500/10" },
    { icon: Users, title: "Performer Roster", desc: "Track availability, bookings, and performer details.", color: "text-brand-gold", bg: "bg-orange-500/10" },
    { icon: MapPin, title: "Arrival Tracking", desc: "See live ETAs and get notified when they arrive.", color: "text-violet-400", bg: "bg-violet-500/10" },
    { icon: Bell, title: "Automated Reminders", desc: "Never send another text. GiggMe does it for you.", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: MessageSquare, title: "Team Messaging", desc: "Communicate with your entire team in one place.", color: "text-blue-400", bg: "bg-blue-500/10" },
    { icon: DollarIcon, title: "Payment Tracking", desc: "Track payments, balances, and payment history.", color: "text-brand-gold", bg: "bg-amber-500/10" },
  ];

  const steps = [
    { n: 1, icon: UserPlus2, title: "Add Your Performers", desc: "Build your roster and manage availability." },
    { n: 2, icon: Calendar, title: "Create a Gig", desc: "Add details, location, time, and pay." },
    { n: 3, icon: Users, title: "Assign Your Team", desc: "Invite performers and confirm the gig." },
    { n: 4, icon: Send, title: "Automate Communication", desc: "Reminders, updates, and changes sent automatically." },
    { n: 5, icon: CheckCircle2, title: "Track the Event Live", desc: "Monitor arrivals, messages, and payments in real-time." },
  ];

  const testimonials = [
    { quote: "GiggMe has completely changed how we manage our band. No more text chains and missed details.", name: "David R.", role: "Band Leader", avatar: avatar1 },
    { quote: "The arrival tracking feature alone is worth every penny. I always know exactly when my performers arrive.", name: "Michelle T.", role: "Entertainment Manager", avatar: avatar2 },
    { quote: "Our entire team stays on the same page now. It's a game changer for our production company.", name: "Jason L.", role: "Production Director", avatar: avatar3 },
  ];

  const plans = [
    {
      name: "Entertainer",
      price: "$8.99",
      tagline: "Showcase your talent and get discovered",
      features: [
        "Professional entertainer profile",
        "Upload performance videos",
        "Photo gallery",
        "Availability calendar",
        "Connect with booking managers",
      ],
      featured: false,
    },
    {
      name: "Featured Entertainer",
      price: "$13.99",
      tagline: "Stand out and get booked faster",
      features: [
        "Everything in Entertainer +",
        "Priority placement in search",
        "Featured badge on profile",
        "Top of booking manager lists",
        "Boosted visibility",
        "Priority support",
      ],
      featured: true,
    },
    {
      name: "Booking Manager",
      price: "$49.99",
      tagline: "Everything you need to book talent",
      features: [
        "Multi-group management",
        "Artist discovery",
        "Location tracking",
        "Direct messaging",
        "Booking calendar",
      ],
      featured: false,
    },
  ];


  return (
    <div className="min-h-screen bg-[hsl(230_35%_7%)] text-foreground overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-fuchsia-500/20 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      {/* Top Nav */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[hsl(230_35%_7%/0.7)] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="GiggMe" className="h-24 sm:h-20 w-auto object-contain" />
          </div>

          <nav className="hidden lg:flex items-center gap-8">
            {["Features", "How It Works", "Entertainers", "Pricing"].map((item) => (
              <button
                key={item}
                onClick={() => {
                  if (item === "Pricing") {
                    navigate("/pricing");
                  } else if (item === "How It Works") {
                    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  } else if (item === "Entertainers") {
                    navigate("/find-entertainers");
                  } else {
                    navigate("/auth");
                  }
                }}
                className="text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                {item}
              </button>
            ))}
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-medium text-white/70 hover:text-white transition-colors flex items-center gap-1"
            >
              Resources <ChevronDown className="h-4 w-4" />
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/70"
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 -mt-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>

            <button
              onClick={() => navigate("/auth")}
              className="hidden sm:inline-flex h-9 items-center px-4 rounded-lg border border-white/15 text-sm font-medium text-white hover:bg-white/5 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate("/get-started")}
              className="hidden sm:inline-flex h-9 items-center gap-1.5 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500 shadow-lg shadow-violet-600/25 transition-all"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-white/70">
                  <Menu className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  Features
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  How It Works
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/find-entertainers")}>
                  Entertainers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/pricing")}>
                  <DollarSign className="mr-2 h-4 w-4" /> Pricing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/auth")}>
                  Resources
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/auth")}>
                  <HelpCircle className="mr-2 h-4 w-4" /> Support
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/auth")}>
                  <LogIn className="mr-2 h-4 w-4" /> Sign In
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/get-started")}>
                  <UserPlus className="mr-2 h-4 w-4" /> Get Started
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 lg:pt-16 pb-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          {/* Left */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <Star className="h-3.5 w-3.5 text-brand-gold fill-brand-gold" />
              <span className="text-xs font-medium text-white/80">The #1 Platform for Entertainment Managers</span>
            </div>

            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.05]">
              Stop managing gigs through{" "}
              <span className="bg-gradient-to-r from-[hsl(33_92%_60%)] to-[hsl(45_95%_60%)] bg-clip-text text-transparent">text messages.</span>
            </h1>

            <p className="mt-6 text-lg text-white/65 max-w-xl leading-relaxed">
              Schedule performers, automate reminders, track arrivals, manage payments, and keep every gig organized from one dashboard.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={() => navigate("/get-started")}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500 shadow-xl shadow-violet-600/30 transition-all"
              >
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-2">
                <img src={avatar1} alt="" className="h-9 w-9 rounded-full object-cover border-2 border-[hsl(230_35%_7%)]" />
                <img src={avatar2} alt="" className="h-9 w-9 rounded-full object-cover border-2 border-[hsl(230_35%_7%)]" />
                <img src={avatar3} alt="" className="h-9 w-9 rounded-full object-cover border-2 border-[hsl(230_35%_7%)]" />
              </div>
              <div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-brand-gold fill-brand-gold" />
                  ))}
                </div>
                <p className="text-xs text-white/60 mt-1">Trusted by 2,000+ entertainment professionals</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-white/35 text-sm font-serif italic">
              <span>Hard Rock</span>
              <span>Four Seasons</span>
              <span>The Ritz-Carlton</span>
              <span>FLEMING'S</span>
              <span>Marriott</span>
            </div>
          </div>

          {/* Right - Dashboard mockup */}
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-violet-600/20 via-fuchsia-500/10 to-cyan-500/20 rounded-[3rem] blur-3xl" />
            <div className="relative rounded-2xl border border-white/10 bg-[hsl(230_30%_11%)] shadow-2xl overflow-hidden">
              {/* Mock browser bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[hsl(230_30%_9%)]">
                <div className="flex items-center gap-2">
                  <img src={logo} alt="" className="h-6 w-auto" />
                </div>
                <div className="flex items-center gap-3 text-white/50">
                  <Search className="h-4 w-4" />
                  <Bell className="h-4 w-4" />
                  <img src={avatar1} alt="" className="h-6 w-6 rounded-full object-cover" />
                </div>
              </div>
              <div className="flex">
                {/* Sidebar */}
                <div className="hidden sm:flex w-36 flex-col gap-1 p-3 border-r border-white/5 text-xs">
                  {[
                    { i: LayoutDashboard, l: "Dashboard", active: true },
                    { i: Music, l: "Gigs" },
                    { i: Users, l: "Performers" },
                    { i: Calendar, l: "Schedule" },
                    { i: MessageSquare, l: "Messages", badge: 3 },
                    { i: DollarIcon, l: "Payments" },
                    { i: BarChart3, l: "Reports" },
                    { i: SettingsIcon, l: "Settings" },
                  ].map((it) => (
                    <div key={it.l} className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${it.active ? "bg-blue-500/15 text-blue-300" : "text-white/60"}`}>
                      <it.i className="h-3.5 w-3.5" />
                      <span className="flex-1 truncate">{it.l}</span>
                      {it.badge && <span className="text-[10px] bg-orange-500 text-white rounded-full px-1.5">{it.badge}</span>}
                    </div>
                  ))}
                </div>
                {/* Main */}
                <div className="flex-1 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Upcoming Gigs</h3>
                    <span className="text-[10px] text-white/50 border border-white/10 rounded-md px-2 py-1">View Calendar</span>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-white/5">
                    <div className="h-20 bg-gradient-to-br from-violet-600/60 to-blue-600/60 relative">
                      <div className="absolute bottom-1 left-2 text-[10px] text-white/80 uppercase tracking-wider">Sat, May 25</div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[hsl(230_30%_9%)]">
                      <div>
                        <p className="text-xs font-semibold text-white">Saturday Jazz Night</p>
                        <p className="text-[10px] text-white/50">The Blue Note · Tampa, FL · 8:00 PM</p>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-md">Confirmed</span>
                    </div>
                  </div>

                  <div>
                    <div className="grid grid-cols-[1fr_auto_auto] text-[10px] text-white/40 uppercase tracking-wider px-1 mb-1">
                      <span>Performers</span><span className="pr-3">Status</span><span>ETA</span>
                    </div>
                    {[
                      { name: "Sarah Williams", role: "Vocalist", status: "Confirmed", statusColor: "text-emerald-400", eta: "12 min away", avatar: avatar2 },
                      { name: "Marcus Jones", role: "Drummer", status: "Arrived", statusColor: "text-blue-400", eta: "On site", avatar: avatar1 },
                      { name: "James Carter", role: "Bassist", status: "Not Responded", statusColor: "text-brand-gold", eta: "25 min away", avatar: avatar3 },
                    ].map((p) => (
                      <div key={p.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1.5 border-t border-white/5 text-[11px]">
                        <div className="flex items-center gap-2">
                          <img src={p.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                          <div>
                            <p className="text-white font-medium leading-tight">{p.name}</p>
                            <p className="text-[9px] text-white/40 leading-tight">{p.role}</p>
                          </div>
                        </div>
                        <span className={`${p.statusColor} pr-3`}>{p.status}</span>
                        <span className="text-white/60">{p.eta}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="rounded-lg border border-white/5 bg-[hsl(230_30%_9%)] p-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-semibold text-white">Arrival Tracking</p>
                        <span className="text-[8px] text-emerald-400">● Live</span>
                      </div>
                      <div className="h-16 rounded bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-blue-400" />
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-[hsl(230_30%_9%)] p-2">
                      <p className="text-[10px] font-semibold text-white mb-1">Payment Status</p>
                      <p className="text-[9px] text-white/50">3 of 4 Paid</p>
                      <div className="h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                        <div className="h-full w-3/4 bg-emerald-400" />
                      </div>
                      <p className="text-[9px] text-white/60 mt-1">$2,550 / $3,400</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
        <h2 className="text-center text-3xl sm:text-4xl font-bold text-white mb-12">
          Everything You Need to Run Entertainment Teams
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
              <div className={`mx-auto h-12 w-12 rounded-full ${f.bg} flex items-center justify-center mb-3`}>
                <f.icon className={`h-5 w-5 ${f.color}`} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-xs text-white/55 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How GiggMe Works */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
        <h2 className="text-center text-3xl sm:text-4xl font-bold text-white mb-14">How GiggMe Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-3 items-start">
          {steps.map((s, i) => (
            <div key={s.n} className="relative flex flex-col items-center text-center px-2">
              <div className="relative">
                <div className="absolute -top-1 -left-1 h-6 w-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center z-10">{s.n}</div>
                <div className={`h-16 w-16 rounded-full border-2 ${s.n === 5 ? "border-emerald-500 bg-emerald-500/10" : "border-white/15 bg-white/5"} flex items-center justify-center`}>
                  <s.icon className={`h-6 w-6 ${s.n === 5 ? "text-emerald-400" : "text-white/80"}`} />
                </div>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-xs text-white/55 leading-relaxed">{s.desc}</p>
              {i < steps.length - 1 && (
                <ChevronRight className="hidden lg:block absolute top-7 -right-3 h-5 w-5 text-white/25" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-center text-3xl sm:text-4xl font-bold text-white mb-12">Loved by Entertainment Professionals</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-brand-gold fill-brand-gold" />
                ))}
              </div>
              <p className="text-white/80 text-sm leading-relaxed mb-5">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <img src={t.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-white/50">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
        <h2 className="text-center text-3xl sm:text-4xl font-bold text-white mb-12">Simple, Transparent Pricing</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl p-6 ${
                p.featured
                  ? "border-2 border-blue-500 bg-gradient-to-b from-blue-500/10 to-transparent"
                  : "border border-white/10 bg-white/[0.03]"
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md bg-blue-500 text-white text-xs font-semibold">
                  Most Popular
                </div>
              )}
              <h3 className="text-center text-lg font-semibold text-white">{p.name}</h3>
              <div className="text-center mt-4">
                <span className="text-4xl font-bold text-white">{p.price}</span>
                {p.price !== "Free" && <span className="text-white/50 text-sm">/month</span>}
              </div>
              <p className="text-center text-xs text-white/55 mt-2 mb-5">{p.tagline}</p>
              <ul className="space-y-2.5 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/75">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate("/pricing")}
                className={`w-full h-11 rounded-xl font-semibold text-sm transition-all ${
                  p.featured
                    ? "bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow-lg shadow-violet-600/25 hover:from-blue-400 hover:to-violet-500"
                    : "border border-blue-500/60 text-blue-400 hover:bg-blue-500/10"
                }`}
              >
                Start Free Trial
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA banner */}
      <section className="relative overflow-hidden border-t border-white/5">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-900/30 via-fuchsia-900/20 to-blue-900/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              The Operating System for{" "}
              <span className="bg-gradient-to-r from-[hsl(33_92%_60%)] to-[hsl(45_95%_60%)] bg-clip-text text-transparent">Entertainment Managers</span>
            </h2>
            <p className="mt-2 text-sm text-white/60">Stop chasing performers. Start running professional, stress-free events.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <button
              onClick={() => navigate("/get-started")}
              className="inline-flex whitespace-nowrap items-center justify-center gap-2 h-12 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500 shadow-xl shadow-violet-600/30"
            >
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate("/schedule-demo")}
              className="inline-flex whitespace-nowrap items-center justify-center gap-2 h-12 px-5 rounded-xl text-sm font-medium text-white border border-white/15 hover:bg-white/5"
            >
              <Calendar className="h-4 w-4" /> Schedule a Demo
            </button>
          </div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-white/55">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> 14-Day Free Trial</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> No Credit Card Required</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Cancel Anytime</span>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={logo} alt="GiggMe" className="h-10 w-auto object-contain" />
          <div className="flex items-center gap-6 text-sm text-white/60">
            <button onClick={() => navigate("/pricing")} className="hover:text-white transition-colors">Pricing</button>
            <button onClick={() => navigate("/auth")} className="hover:text-white transition-colors">Sign In</button>
          </div>
          <p className="text-sm text-white/40">© 2026 GiggMe. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
};

export default Index;
