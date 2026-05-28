import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, CheckCircle2, Loader2, User } from "lucide-react";
import logo from "@/assets/logo.png";

const ENTERTAINER_PRICE_ID = "price_1Tc7DGEPiAZgF8MeCcRLu2rd";

interface FeaturedEntertainer {
  user_id: string;
  name: string | null;
  bio: string | null;
  photo_urls: string[] | null;
  performer_category: string | null;
  stage_name: string | null;
  genre: string | null;
  instrument: string | null;
}

const FindEntertainers = () => {
  const navigate = useNavigate();
  const [entertainers, setEntertainers] = useState<FeaturedEntertainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    loadEntertainers();
    checkUser();
  }, []);

  const loadEntertainers = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_featured_entertainers");
    if (!error && data) setEntertainers(data as FeaturedEntertainer[]);
    setLoading(false);
  };

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    setUser(session.user);

    // Sync from Stripe and read current status
    try {
      await supabase.functions.invoke("sync-entertainer-subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch (e) {
      // non-fatal
    }
    const { data: sub } = await supabase
      .from("entertainer_subscribers" as any)
      .select("status, current_period_end")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (sub && (sub as any).status === "active") setIsSubscribed(true);
    loadEntertainers();
  };

  const handleSubscribe = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      navigate("/auth");
      return;
    }
    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: ENTERTAINER_PRICE_ID },
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
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-fuchsia-500/20 blur-[140px]" />
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[hsl(230_35%_7%/0.7)] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={logo} alt="GiggMe" className="h-12 sm:h-16 w-auto object-contain" />
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

      {/* Hero / Join CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-medium text-white/80">Find Entertainers</span>
          </div>
          <h1 className="mt-5 text-3xl sm:text-5xl font-bold text-white leading-tight">
            Discover{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
              featured entertainers
            </span>{" "}
            for your next event
          </h1>
          <p className="mt-5 text-white/60 text-lg">
            Browse our roster of musicians and performers. Click anyone to view their full profile.
          </p>
        </div>

        {/* Subscribe panel */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {isSubscribed ? "You're a featured entertainer" : "Are you an entertainer?"}
              </h2>
              <p className="mt-1 text-white/60 max-w-xl">
                {isSubscribed
                  ? "Your profile is live on this page. Update your bio, photos and videos anytime."
                  : "Get featured on this page for $10.99/month. Upload your bio, photos, and videos so event planners can find and book you."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isSubscribed ? (
                <>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-300 text-sm">
                    <CheckCircle2 className="h-4 w-4" /> Active membership
                  </div>
                  <Button
                    onClick={() => navigate("/artist-profile")}
                    className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500"
                  >
                    Edit my profile
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500"
                >
                  {subscribing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Join for $10.99/mo
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Entertainer grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <h3 className="text-2xl font-bold text-white mb-6">Featured entertainers</h3>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        ) : entertainers.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <User className="h-10 w-10 mx-auto text-white/30" />
            <p className="mt-4 text-white/60">
              No featured entertainers yet. Be the first to join!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {entertainers.map((e) => {
              const photo = e.photo_urls?.[0];
              const displayName = e.stage_name || e.name || "Entertainer";
              return (
                <button
                  key={e.user_id}
                  onClick={() => navigate(`/artist-profile/${e.user_id}`)}
                  className="group text-left rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06] transition-all"
                >
                  <div className="aspect-square w-full bg-gradient-to-br from-violet-900/40 to-fuchsia-900/40 overflow-hidden">
                    {photo ? (
                      <img
                        src={photo}
                        alt={displayName}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="h-12 w-12 text-white/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                    <p className="text-xs text-white/55 truncate">
                      {e.genre || e.performer_category || e.instrument || "Performer"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default FindEntertainers;
