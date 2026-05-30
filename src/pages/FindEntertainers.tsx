import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  UserCircle,
  PlaySquare,
  Search,
  Star,
} from "lucide-react";
import logo from "@/assets/logo.png";
import performer1 from "@/assets/hero-performer-sax.jpg";
import performer2 from "@/assets/hero-performer-vocalist.jpg";
import performer5 from "@/assets/hero-performer-guitar.jpg";

const BASIC_PRICE_ID = "price_1TcATOEPiAZgF8Me2TkOBbG0";
const FEATURED_PRICE_ID = "price_1TcATsEPiAZgF8MeuJY76UlD";

const STEPS = [
  {
    icon: UserCircle,
    title: "1. Create Your Profile",
    desc: "Add your bio, photos, genres, and location.",
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    icon: PlaySquare,
    title: "2. Upload Your Clips",
    desc: "Showcase your talent with performance videos.",
    color: "from-fuchsia-500 to-pink-500",
  },
  {
    icon: Search,
    title: "3. Get Discovered",
    desc: "Our agents and booking managers find you.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Star,
    title: "4. Get Booked",
    desc: "Receive offers and get hired for great events.",
    color: "from-blue-500 to-cyan-500",
  },
];

const FEATURES = [
  "Create a professional performer profile",
  "Upload photos, videos & music clips",
  "List your genres, instruments & skills",
  "Get discovered by agents & booking managers",
  "Receive booking inquiries & job offers",
  "Priority placement in search results",
  "24/7 account support",
];

const TRUSTED_BY = ["Hard Rock Cafe", "Four Seasons", "The Ritz-Carlton", "Fleming's", "Marriott"];

const FindEntertainers = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    setUser(session.user);
    try {
      await supabase.functions.invoke("sync-entertainer-subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch (e) {
      /* non-fatal */
    }
    const { data: sub } = await supabase
      .from("entertainer_subscribers" as any)
      .select("status")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (sub && (sub as any).status === "active") setIsSubscribed(true);
  };

  const handleSubscribe = async (priceId: string = BASIC_PRICE_ID) => {
    const plan = priceId === FEATURED_PRICE_ID ? "entertainer_featured" : "entertainer_basic";
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      navigate(`/auth?mode=signup&plan=${plan}`);
      return;
    }
    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(230_35%_7%)] text-foreground overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-fuchsia-500/20 blur-[140px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[hsl(230_35%_7%/0.7)] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={logo} alt="GiggMe" className="h-20 sm:h-28 md:h-32 w-auto object-contain" />
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate("/")}
              className="text-sm text-white/70 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Home
            </button>
            {!user && (
              <button
                onClick={() => navigate("/auth")}
                className="inline-flex h-9 items-center px-4 rounded-lg border border-white/15 text-sm font-medium text-white hover:bg-white/5 transition-colors"
              >
                Log In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 border border-violet-400/30">
              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
              <span className="text-xs font-semibold tracking-wide text-white/90">
                FOR PERFORMERS & ENTERTAINERS
              </span>
            </div>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight">
              Get Discovered.
              <br />
              Get Hired.
              <br />
              Do What You{" "}
              <span className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                Love.
              </span>
            </h1>
            <p className="mt-6 text-white/65 text-lg max-w-xl leading-relaxed">
              Join GiggMe and get your talent in front of booking managers, restaurants, event
              planners, and private clients looking for amazing entertainment like you.
            </p>

            <div className="mt-8">
              {isSubscribed ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 text-emerald-300 text-sm">
                    <CheckCircle2 className="h-4 w-4" /> Active membership
                  </div>
                  <Button
                    onClick={() => navigate("/artist-profile")}
                    className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500"
                  >
                    Edit my profile
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => handleSubscribe(BASIC_PRICE_ID)}
                  disabled={subscribing}
                  className="h-14 px-8 text-base font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 hover:opacity-95 shadow-[0_10px_40px_-10px_rgba(168,85,247,0.6)]"
                >
                  {subscribing ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : null}
                  Join for Only $8.99/mo
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              )}
              <p className="mt-4 flex items-center gap-2 text-sm text-white/55">
                <ShieldCheck className="h-4 w-4 text-white/40" />
                Cancel anytime. No long-term contracts.
              </p>
            </div>
          </div>

          {/* Hero collage */}
          <div className="relative h-[460px] sm:h-[520px] hidden lg:block">
            <div className="absolute top-0 left-4 w-44 h-60 rounded-2xl overflow-hidden border border-white/10 shadow-2xl rotate-[-6deg]">
              <img src={performer1} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-52 h-72 rounded-2xl overflow-hidden border border-white/10 shadow-2xl z-10">
              <img src={performer2} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute top-2 right-0 w-44 h-60 rounded-2xl overflow-hidden border border-white/10 shadow-2xl rotate-[6deg]">
              <img src={performer5} alt="" className="w-full h-full object-cover" />
            </div>

            {/* Profile card */}
            <div className="absolute bottom-0 left-0 w-72 rounded-2xl border border-white/10 bg-[hsl(230_35%_10%/0.9)] backdrop-blur-xl p-4 shadow-2xl">
              <p className="text-[11px] uppercase tracking-wider text-white/50">Your Profile</p>
              <div className="mt-2 flex items-center gap-3">
                <img src={performer2} alt="" className="h-12 w-12 rounded-full object-cover border border-white/10" />
                <div>
                  <p className="text-sm font-semibold text-white">Sophia Vale</p>
                  <p className="text-[11px] text-white/60">Vocalist · Pop & Soul</p>
                  <p className="text-[11px] text-white/50">New York, NY</p>
                </div>
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Available for events
              </div>
              <p className="mt-3 text-[11px] font-semibold text-white/80">About Me</p>
              <p className="text-[11px] text-white/55 leading-snug">
                Professional vocalist with 8+ years of experience performing at weddings, private
                parties, restaurants, and corporate events.
              </p>
              <p className="mt-3 text-[11px] font-semibold text-white/80">Genres</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {["Pop", "Soul", "R&B", "Jazz"].map((g) => (
                  <span key={g} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/75">
                    {g}
                  </span>
                ))}
              </div>
            </div>

            {/* Discovered badge */}
            <div className="absolute bottom-24 right-2 h-20 w-20 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 border border-violet-400/40 backdrop-blur-md flex items-center justify-center text-center">
              <div>
                <Sparkles className="h-4 w-4 text-amber-300 mx-auto" />
                <p className="text-[10px] text-white/85 leading-tight mt-0.5">Get<br/>Discovered</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-center text-2xl sm:text-3xl font-bold text-white mb-10">
          How GiggMe Works for You
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 relative">
          <div className="hidden md:block absolute top-8 left-[12%] right-[12%] border-t border-dashed border-white/15" />
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="relative text-center">
                <div className={`mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <p className="mt-4 text-sm font-semibold text-white">{s.title}</p>
                <p className="mt-1.5 text-xs text-white/55 leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Features + Plan */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-6 sm:p-10">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                Everything You Need to Get Hired
              </h2>
              <ul className="mt-6 space-y-3">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-white/80 text-sm sm:text-base">
                    <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-violet-500/20 border border-violet-400/40 flex items-center justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5 text-violet-300" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Plan cards */}
            <div className="grid sm:grid-cols-2 gap-5">
              {/* Basic */}
              <div className="relative rounded-2xl border border-white/15 bg-white/[0.03] p-6 text-center flex flex-col">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider bg-emerald-500/90 text-white shadow-md">
                  7-DAY FREE TRIAL
                </span>
                <h3 className="mt-2 text-lg font-bold text-white">Basic Profile</h3>
                <div className="mt-4 flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-white">$8.99</span>
                  <span className="text-white/60 text-base">/mo</span>
                </div>
                <p className="mt-1 text-xs text-white/55">Cancel anytime</p>
                <Button
                  onClick={() => handleSubscribe(BASIC_PRICE_ID)}
                  disabled={subscribing || isSubscribed}
                  variant="outline"
                  className="mt-6 w-full h-11 font-semibold rounded-xl border-white/20 text-white hover:bg-white/5"
                >
                  {subscribing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isSubscribed ? "Subscribed" : "Start Free Trial"}
                </Button>
              </div>

              {/* Featured */}
              <div className="relative rounded-2xl border border-violet-400/40 bg-gradient-to-br from-violet-600/15 via-fuchsia-600/10 to-pink-500/10 p-6 text-center flex flex-col">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider bg-gradient-to-r from-pink-500 to-orange-400 text-white shadow-md whitespace-nowrap">
                  MOST POPULAR
                </span>
                <h3 className="mt-2 text-lg font-bold bg-gradient-to-r from-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
                  Featured Performer
                </h3>
                <div className="mt-4 flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-white">$14</span>
                  <span className="text-white/60 text-base">/mo</span>
                </div>
                <p className="mt-1 text-xs text-violet-200/80">Prime placement + featured badge</p>
                <Button
                  onClick={() => handleSubscribe(FEATURED_PRICE_ID)}
                  disabled={subscribing || isSubscribed}
                  className="mt-6 w-full h-11 font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 hover:opacity-95 shadow-[0_10px_30px_-10px_rgba(236,72,153,0.6)]"
                >
                  {subscribing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {isSubscribed ? "Subscribed" : "Start 7-Day Free Trial"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h3 className="text-center text-lg sm:text-xl font-semibold text-white mb-8">
          Trusted by Booking Managers & Event Planners
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {TRUSTED_BY.map((name) => (
            <span
              key={name}
              className="text-white/40 hover:text-white/70 transition-colors text-base sm:text-lg font-serif italic tracking-wide"
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 text-center">
        <div className="flex items-center justify-center gap-1 text-amber-400 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-5 w-5 fill-current" />
          ))}
        </div>
        <blockquote className="text-white/85 text-lg sm:text-xl leading-relaxed italic">
          "GiggMe helps me find incredible talent faster than any other platform."
        </blockquote>
        <p className="mt-3 text-sm text-white/55">– Event Planner, Miami</p>
      </section>
    </div>
  );
};

export default FindEntertainers;
