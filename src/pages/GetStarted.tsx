import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Star,
  User,
  Mail,
  Lock,
  Clock,
  MapPin,
  DollarSign,
  Users,
  Shield,
  Headphones,
  CheckCircle2,
  Search,
  LayoutDashboard,
  Calendar,
  MessageSquare,
  BarChart3,
  Settings,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .regex(/[0-9]/, "Include a number")
    .regex(/[A-Z]/, "Include an uppercase letter"),
});

const GetStarted = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasNumber = /[0-9]/.test(password);
  const hasUpper = /[A-Z]/.test(password);

  const handleOAuth = async (provider: "google" | "apple") => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Sign-in failed",
        description: err.message ?? "Please try again.",
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = signupSchema.parse({ name, email, password });
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { name: data.name, role: "booking_manager" },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;

      if (
        signUpData.user &&
        Array.isArray(signUpData.user.identities) &&
        signUpData.user.identities.length === 0
      ) {
        toast({
          variant: "destructive",
          title: "Email already in use",
          description: "An account with this email already exists. Please sign in.",
        });
        return;
      }

      toast({
        title: "Account created!",
        description: "Welcome to GiggMe. Let's set up your profile.",
      });
      navigate("/profile-setup");
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: err.errors[0].message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Signup failed",
          description: err.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 md:px-10 py-5">
        <Link to="/" className="flex items-center">
          <img src={logo} alt="GiggMe" className="h-10 w-auto object-contain" />
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-muted-foreground">
            Already have an account?
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/auth")}
            className="rounded-lg"
          >
            Sign In
          </Button>
        </div>
      </header>

      <main className="px-4 md:px-10 pb-10 max-w-7xl mx-auto">
        {/* Two-column hero */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Signup card */}
          <section className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur p-6 md:p-10">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">
              Let's Get{" "}
              <span className="bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
                You Started
              </span>
            </h1>
            <p className="mt-3 text-muted-foreground max-w-md">
              Create your account and start managing your entertainment teams like a pro.
            </p>

            <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm">
              <Star className="h-4 w-4 text-brand-gold fill-brand-gold" />
              <span className="font-medium">14-Day Free Trial</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">No credit card required</span>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl justify-center gap-3"
                onClick={() => handleOAuth("google")}
              >
                <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.2 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.2 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.7 13-4.6l-6-5c-2 1.4-4.4 2.1-7 2.1-5.3 0-9.7-3.1-11.4-7.6l-6.5 5c3.3 5.7 9.8 10.1 17.9 10.1z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4 5.3l6 5c-.4.4 6.5-4.7 6.5-14.3 0-1.2-.1-2.4-.4-3.5z" />
                </svg>
                Continue with Google
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl justify-center gap-3"
                onClick={() => handleOAuth("apple")}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16.365 1.43c0 1.14-.46 2.22-1.22 3.01-.78.8-2.07 1.43-3.11 1.35-.12-1.09.43-2.23 1.18-3 .83-.86 2.23-1.5 3.15-1.36zM20.5 17.13c-.55 1.28-.82 1.86-1.53 2.99-.99 1.58-2.39 3.55-4.12 3.57-1.54.02-1.93-1-4.02-.99-2.09.01-2.53 1.01-4.07.99-1.74-.02-3.06-1.81-4.05-3.39C.36 16.6-.45 11.34 1.74 7.97c1.55-2.38 4-3.78 6.31-3.78 2.36 0 3.84 1.29 5.79 1.29 1.89 0 3.04-1.29 5.77-1.29 2.06 0 4.24 1.12 5.79 3.06-5.09 2.79-4.26 10.06.1 9.88z" />
                </svg>
                Continue with Apple
              </Button>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">OR</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="pl-10 h-12 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 h-12 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 pr-10 h-12 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <ul className="text-sm space-y-1.5">
                {[
                  { ok: hasMinLength, label: "At least 8 characters" },
                  { ok: hasNumber, label: "Include a number" },
                  { ok: hasUpper, label: "Include an uppercase letter" },
                ].map((r) => (
                  <li
                    key={r.label}
                    className={`flex items-center gap-2 ${r.ok ? "text-emerald-400" : "text-muted-foreground"}`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {r.label}
                  </li>
                ))}
              </ul>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-semibold"
              >
                {loading ? "Creating account..." : (
                  <>
                    Start My Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By creating an account, you agree to our{" "}
                <a className="underline">Terms of Service</a> and{" "}
                <a className="underline">Privacy Policy</a>.
              </p>
            </form>
          </section>

          {/* Right: Mockup + bullets */}
          <section className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold">
                See{" "}
                <span className="bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
                  GiggMe
                </span>{" "}
                in action
              </h2>
              <p className="text-muted-foreground mt-1">
                Everything you need to run successful events.
              </p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur p-4 md:p-5">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <img src={logo} alt="GiggMe" className="h-6 w-auto" />
                </div>
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-4 pt-4">
                <nav className="text-sm space-y-1">
                  {[
                    { i: LayoutDashboard, l: "Dashboard", active: true },
                    { i: Calendar, l: "Gigs" },
                    { i: Users, l: "My Roster" },
                    { i: Clock, l: "Schedule" },
                    { i: MessageSquare, l: "Messages", badge: 3 },
                    { i: DollarSign, l: "Payments" },
                    { i: BarChart3, l: "Reports" },
                    { i: Settings, l: "Settings" },
                  ].map((n) => (
                    <div
                      key={n.l}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg ${n.active ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                    >
                      <div className="flex items-center gap-2">
                        <n.i className="h-4 w-4" />
                        <span>{n.l}</span>
                      </div>
                      {n.badge && (
                        <span className="text-[10px] bg-orange-500 text-white rounded-full px-1.5">
                          {n.badge}
                        </span>
                      )}
                    </div>
                  ))}
                </nav>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Upcoming Gigs</h3>
                    <span className="text-xs px-2 py-1 rounded-md border border-border/60">
                      View Calendar
                    </span>
                  </div>
                  <div className="rounded-xl border border-border/50 p-3 flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-violet-600/30 shrink-0" />
                    <div className="flex-1 text-sm">
                      <div className="text-[10px] text-muted-foreground tracking-wide">SAT, MAY 25</div>
                      <div className="font-semibold">Saturday Jazz Night</div>
                      <div className="text-muted-foreground text-xs">
                        The Blue Note · Tampa, FL
                      </div>
                      <div className="text-muted-foreground text-xs">8:00 PM – 11:00 PM</div>
                    </div>
                    <span className="self-start text-[10px] px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400">
                      Confirmed
                    </span>
                  </div>
                  <div className="rounded-xl border border-border/50">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-[10px] text-muted-foreground border-b border-border/40">
                      <span>My Roster</span>
                      <span>STATUS</span>
                      <span>ETA</span>
                    </div>
                    {[
                      { n: "Sarah Williams", r: "Vocalist", s: "Confirmed", sc: "emerald", e: "12 min away" },
                      { n: "Marcus Jones", r: "Drummer", s: "Arrived", sc: "emerald", e: "On site" },
                      { n: "James Carter", r: "Bassist", s: "Not Responded", sc: "orange", e: "25 min away" },
                    ].map((p) => (
                      <div key={p.n} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-muted" />
                          <div>
                            <div className="font-medium">{p.n}</div>
                            <div className="text-muted-foreground text-[10px]">{p.r}</div>
                          </div>
                        </div>
                        <span className={`text-[10px] ${p.sc === "emerald" ? "text-emerald-400" : "text-brand-gold"}`}>
                          {p.s}
                        </span>
                        <span className="text-muted-foreground text-[10px]">{p.e}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/50 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">Arrival Tracking</span>
                        <span className="text-emerald-400">● Live</span>
                      </div>
                      <div className="mt-2 h-20 rounded-lg bg-gradient-to-br from-background to-muted/40 flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-emerald-400" />
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/50 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">Payment Status</span>
                        <span className="text-muted-foreground">$2,850 / $3,400</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">3 of 4 Paid</div>
                      <div className="mt-2 space-y-1 text-[10px]">
                        {[
                          ["Sarah Williams", "Paid", "emerald"],
                          ["Marcus Jones", "Paid", "emerald"],
                          ["James Carter", "Pending", "orange"],
                          ["Venue Fee", "Paid", "emerald"],
                        ].map(([n, s, c]) => (
                          <div key={n} className="flex justify-between">
                            <span>{n}</span>
                            <span className={c === "emerald" ? "text-emerald-400" : "text-brand-gold"}>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { i: Clock, c: "bg-violet-500/15 text-violet-400", t: "Save Hours Every Week", d: "Automate reminders, confirmations, and updates." },
                { i: MapPin, c: "bg-emerald-500/15 text-emerald-400", t: "Know Exactly What's Happening", d: "Live tracking and real-time updates keep you in control." },
                { i: DollarSign, c: "bg-orange-500/15 text-brand-gold", t: "Get Paid on Time", d: "Track payments and never miss a detail." },
                { i: Users, c: "bg-fuchsia-500/15 text-fuchsia-400", t: "Built for Entertainment Professionals", d: "Trusted by managers, band leaders, and booking agents." },
              ].map((f) => (
                <div key={f.t} className="flex gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${f.c}`}>
                    <f.i className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{f.t}</h4>
                    <p className="text-sm text-muted-foreground">{f.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Trust band */}
        <section className="mt-8 rounded-2xl border border-border/50 bg-card/40 backdrop-blur p-6 md:p-10">
          <div className="text-center">
            <h3 className="text-xl md:text-2xl font-bold">Trusted by Entertainment Professionals</h3>
            <p className="text-muted-foreground mt-1">
              Join thousands of managers and teams who trust GiggMe.
            </p>
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-6 items-center justify-items-center opacity-70 text-muted-foreground text-sm tracking-wide">
            <span className="font-serif text-lg">Hard Rock</span>
            <span className="font-serif text-lg">Four Seasons</span>
            <span className="font-serif text-lg">The Ritz-Carlton</span>
            <span className="font-serif text-lg">Yamaha</span>
            <span className="font-serif text-lg">Marriott</span>
          </div>
          <div className="my-6 h-px bg-border/60" />
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { i: Shield, c: "bg-violet-500/15 text-violet-400", t: "Secure & Private", d: "Your data is encrypted and never shared." },
              { i: Headphones, c: "bg-cyan-500/15 text-cyan-400", t: "24/7 Support", d: "We're here to help you every step of the way." },
              { i: Check, c: "bg-emerald-500/15 text-emerald-400", t: "Cancel Anytime", d: "No commitments. Cancel at any time." },
            ].map((f) => (
              <div key={f.t} className="flex gap-4">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${f.c}`}>
                  <f.i className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold">{f.t}</h4>
                  <p className="text-sm text-muted-foreground">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default GetStarted;
