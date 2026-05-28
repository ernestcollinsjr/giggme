import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Music,
  Mic,
  Speaker,
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
  Headphones,
  Heart,
  Zap,
  Settings2,
  ChevronDown,
  LogIn,
  UserPlus,
  DollarSign,
  HelpCircle,
} from "lucide-react";

import heroVirtualAssistant from "@/assets/hero-virtual-assistant.jpg";

const Index = () => {
  const navigate = useNavigate();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/artists?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/artists");
    }
  };

  const categories = [
    {
      icon: Music,
      title: "Musical Acts",
      desc: "Bands, DJs, Ensembles, Singers & more",
      iconBg: "bg-purple-500/15 text-purple-400",
      tile: "bg-purple-500",
      accent: "text-purple-400",
    },
    {
      icon: Mic,
      title: "Artists & Performers",
      desc: "Solo artists, Vocalists, Instrumentalists & more",
      iconBg: "bg-orange-500/15 text-orange-400",
      tile: "bg-orange-500",
      accent: "text-orange-400",
    },
    {
      icon: Speaker,
      title: "Sound & Production",
      desc: "Sound engineers, Lighting, AV crews & more",
      iconBg: "bg-emerald-500/15 text-emerald-400",
      tile: "bg-emerald-500",
      accent: "text-emerald-400",
    },
    {
      icon: Calendar,
      title: "Event Services",
      desc: "MCs, Hosts, Dancers, Photographers & more",
      iconBg: "bg-blue-500/15 text-blue-400",
      tile: "bg-blue-500",
      accent: "text-blue-400",
    },
  ];

  const features = [
    {
      icon: Heart,
      title: "Smart Matching",
      desc: "We find the best talent for your unique needs.",
      color: "text-pink-400",
    },
    {
      icon: Clock,
      title: "Automated Scheduling",
      desc: "Handles availability, contracts and recurring bookings.",
      color: "text-purple-400",
    },
    {
      icon: ShieldCheck,
      title: "Secure & Reliable",
      desc: "Verified talent and secure payments you can trust.",
      color: "text-emerald-400",
    },
    {
      icon: Settings2,
      title: "Manage Everything",
      desc: "All your bookings and communication in one place.",
      color: "text-blue-400",
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="GiggMe" className="h-10 w-auto object-contain" />
          </div>

          <nav className="hidden lg:flex items-center gap-8">
            {["Features", "How It Works", "For Entertainers", "Pricing"].map((item) => (
              <button
                key={item}
                onClick={() => navigate(item === "Pricing" ? "/pricing" : "/auth")}
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
              onClick={() => navigate("/auth")}
              className="inline-flex h-9 items-center gap-1.5 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500 shadow-lg shadow-violet-600/25 transition-all"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-white/70">
                  <Menu className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/pricing")}>
                  <DollarSign className="mr-2 h-4 w-4" /> Pricing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/auth")}>
                  <HelpCircle className="mr-2 h-4 w-4" /> Support
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/auth")}>
                  <LogIn className="mr-2 h-4 w-4" /> Sign In
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/auth")}>
                  <UserPlus className="mr-2 h-4 w-4" /> Get Started
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 lg:pt-20 pb-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-8 items-center">
          {/* Left */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-medium text-white/80">Your personal booking assistant</span>
            </div>

            <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05]">
              Let us manage your{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
                entertainment
              </span>
              <Sparkles className="inline-block h-6 w-6 ml-2 text-violet-400" />
            </h1>

            <p className="mt-6 text-lg text-white/60 max-w-xl leading-relaxed">
              Our virtual assistant handles everything — finding talent, scheduling, and managing your recurring bookings automatically.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-full font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500 shadow-xl shadow-violet-600/30 transition-all hover:scale-[1.02]"
              >
                Get Started Free <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center gap-2 h-12 px-2 pr-5 rounded-full text-white/90 hover:text-white font-medium group"
              >
                <span className="h-10 w-10 rounded-full border border-white/20 flex items-center justify-center group-hover:border-white/40 group-hover:bg-white/5 transition-all">
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                </span>
                Watch Demo
              </button>
            </div>

            {/* Trust strip */}
            <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="flex -space-x-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 border-2 border-[hsl(230_35%_7%)]" />
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 border-2 border-[hsl(230_35%_7%)]" />
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 border-2 border-[hsl(230_35%_7%)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">Loved by 2,000+</p>
                  <p className="text-xs text-white/50 leading-tight mt-0.5">event planners</p>
                </div>
              </div>
              {[
                { icon: Clock, title: "Save Time", sub: "Automate bookings", color: "text-blue-400" },
                { icon: ShieldCheck, title: "Verified Talent", sub: "Trusted professionals", color: "text-violet-400" },
                { icon: Headphones, title: "24/7 Support", sub: "We're here to help", color: "text-cyan-400" },
              ].map((t) => (
                <div key={t.title} className="flex flex-col items-center text-center gap-2">
                  <t.icon className={`h-7 w-7 ${t.color}`} />
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">{t.title}</p>
                    <p className="text-xs text-white/50 leading-tight mt-0.5">{t.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Image */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-violet-600/30 via-fuchsia-500/20 to-cyan-500/30 rounded-[3rem] blur-2xl" />
            <div className="relative aspect-[5/4] rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
              <img
                src={heroVirtualAssistant}
                alt="Virtual booking assistant managing entertainment"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-900/40 via-transparent to-transparent" />
            </div>
            <Sparkles className="absolute -top-2 -right-2 h-8 w-8 text-violet-300 animate-pulse" />
          </div>
        </div>

        {/* Search panel */}
        <form
          onSubmit={handleSearch}
          className="mt-14 relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8"
        >
          <h2 className="text-center text-lg font-semibold text-white mb-5">
            Find the perfect entertainment for your event
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-white/50">Entertainers</p>
              <p className="text-sm text-white mt-0.5">Any type</p>
            </div>
            <div className="md:col-span-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-white/50">Location</p>
              <p className="text-sm text-white mt-0.5">All locations</p>
            </div>
            <div className="md:col-span-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-white/50">Date</p>
              <p className="text-sm text-white mt-0.5">Select date</p>
            </div>
            <div className="md:col-span-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-white/50">Event Type</p>
              <p className="text-sm text-white mt-0.5">All events</p>
            </div>
            <button
              type="submit"
              className="md:col-span-1 h-auto rounded-xl px-5 py-3 font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500 shadow-lg shadow-violet-600/25 inline-flex items-center justify-center gap-2"
            >
              Search <Search className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, genre, or instrument…"
              className="pl-11 bg-white/[0.03] border-white/10 text-white placeholder:text-white/40 h-11"
            />
          </div>
        </form>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-center text-3xl sm:text-4xl font-bold text-white mb-12">
          Browse popular categories
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {categories.map((c) => (
            <button
              key={c.title}
              onClick={() => navigate("/artists")}
              className="group text-left rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 hover:border-white/20 hover:bg-white/[0.06] transition-all"
            >
              <div className={`h-12 w-12 rounded-xl ${c.tile} flex items-center justify-center shadow-lg`}>
                <c.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{c.title}</h3>
              <p className="mt-2 text-sm text-white/55 leading-relaxed">{c.desc}</p>
              <div className={`mt-5 inline-flex items-center gap-1 text-sm font-medium ${c.accent} group-hover:gap-2 transition-all`}>
                Explore <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Features band */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-violet-900/30 via-indigo-900/20 to-blue-900/20 p-10 sm:p-14 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 -z-10 opacity-40">
            <div className="absolute top-0 left-1/4 h-72 w-72 rounded-full bg-violet-500/30 blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          </div>
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">We make booking effortless</h2>
            <p className="mt-3 text-white/60">
              Everything you need to plan amazing events, all in one place.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <f.icon className={`h-6 w-6 mt-0.5 shrink-0 ${f.color}`} />
                <div>
                  <h3 className="text-white font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-white/55 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">How it works</h2>
          <p className="mt-3 text-white/60">Book the best. Exceptional talent is just a few clicks away.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { n: "01", t: "Browse and compare", d: "Discover talented bands and artists in your area, compare their rates and availability." },
            { n: "02", t: "Book securely", d: "GigMe ensures secure connections, amazing service, and hassle-free coordination." },
            { n: "03", t: "Enjoy your event", d: "Watch your special moment spring to life with professional talent." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
              <div className="text-sm font-mono text-violet-400">{s.n}</div>
              <h3 className="mt-3 text-xl font-semibold text-white">{s.t}</h3>
              <p className="mt-2 text-white/55 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="relative overflow-hidden rounded-3xl p-10 sm:p-14 text-center bg-gradient-to-br from-blue-600 via-violet-600 to-fuchsia-600">
          <Zap className="absolute top-6 right-6 h-10 w-10 text-white/30" />
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Ready to transform your gig management?</h2>
          <p className="mt-3 text-white/85 max-w-2xl mx-auto">
            Join GigMe today and experience seamless connections between band leaders, members, artists, and booking managers.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="mt-7 inline-flex items-center gap-2 h-12 px-7 rounded-full font-semibold text-violet-700 bg-white hover:bg-white/90 shadow-xl transition-all"
          >
            Sign Up Now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={logo} alt="GiggMe" className="h-10 w-auto object-contain" />
          <div className="flex items-center gap-6 text-sm text-white/60">
            <button onClick={() => navigate("/pricing")} className="hover:text-white transition-colors">Pricing</button>
            <button onClick={() => navigate("/auth")} className="hover:text-white transition-colors">Sign In</button>
          </div>
          <p className="text-sm text-white/40">© 2026 GigMe. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
