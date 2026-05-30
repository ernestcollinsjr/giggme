import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Music, Briefcase, Users, Eye, EyeOff, Star, Check, Building2, Crown, Search, Calendar, DollarSign, ShieldCheck, MessageCircle, Quote } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import heroVocalist from "@/assets/hero-performer-vocalist.jpg";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const signupSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(72),
  name: z.string().trim().min(1, { message: "Name is required" }).max(100),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
});

const newPasswordSchema = z.object({
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(72),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const ENTERTAINER_PLANS: Record<string, { priceId: string; label: string; price: string; description: string; trial: string }> = {
  entertainer_basic: {
    priceId: "price_1TcATOEPiAZgF8Me2TkOBbG0",
    label: "Basic Profile",
    price: "$8.99",
    description: "Upload your profile, get listed in the entertainer directory, and receive booking inquiries.",
    trial: "7-day free trial",
  },
  entertainer_featured: {
    priceId: "price_1TcATsEPiAZgF8MeuJY76UlD",
    label: "Featured Entertainer",
    price: "$13.99",
    description: "Prime placement at the front of the site, featured badge, and priority in search results.",
    trial: "7-day free trial",
  },
};

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const planParam = searchParams.get("plan");
  const entertainerPlan = planParam && ENTERTAINER_PLANS[planParam] ? ENTERTAINER_PLANS[planParam] : null;
  const safeRedirect = redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : null;
  const postAuthPath = safeRedirect || "/dashboard";
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"booking_manager" | "entertainer" | "booking_manager" | "artist" | "booking_manager">(entertainerPlan ? "artist" : "booking_manager");
  const [venuePricingType, setVenuePricingType] = useState<"subscription" | "one_time">("subscription");
  
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Check if user is coming from password reset email
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsResettingPassword(true);
      }
    });
  }, []);

  const redirectToEntertainerCheckout = async () => {
    try {
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: entertainerPlan!.priceId },
      });
      if (checkoutError) throw checkoutError;
      if (checkoutData?.url) {
        toast({ title: "Redirecting to checkout..." });
        window.location.href = checkoutData.url;
        return true;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast({ variant: "destructive", title: "Checkout failed", description: "Please try again from your profile." });
    }
    return false;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = loginSchema.parse({
        email: loginEmail,
        password: loginPassword,
      });

      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) throw error;

      toast({ title: "Welcome back!", description: "You've successfully logged in." });

      if (entertainerPlan) {
        const ok = await redirectToEntertainerCheckout();
        if (ok) return;
      }

      navigate(postAuthPath);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({ variant: "destructive", title: "Validation Error", description: error.errors[0].message });
      } else {
        toast({ variant: "destructive", title: "Login failed", description: error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validatedData = signupSchema.parse({
        email: signupEmail,
        password: signupPassword,
        name: signupName,
      });

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          data: {
            name: validatedData.name,
            role: role,
            venue_pricing_type: role === "booking_manager" ? venuePricingType : undefined,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // Supabase returns a user with empty identities when the email is already registered
      if (signUpData.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
        toast({
          variant: "destructive",
          title: "Email already in use",
          description: "An account with this email already exists. Please log in instead.",
        });
        return;
      }

      // For entertainer plans coming from /find-entertainers, redirect to checkout
      if (entertainerPlan) {
        let session = signUpData.session;
        if (!session) {
          // Try to sign in immediately (works when auto-confirm is on)
          const { data: signInData } = await supabase.auth.signInWithPassword({
            email: validatedData.email,
            password: validatedData.password,
          });
          session = signInData?.session ?? null;
        }
        if (session) {
          const ok = await redirectToEntertainerCheckout();
          if (ok) return;
        } else {
          toast({
            title: "Check your email",
            description: "Confirm your email, then sign in to complete payment.",
          });
          return;
        }
      }

      // For venue owners, redirect to checkout
      if (role === "booking_manager" && signUpData.session) {
        const priceId = venuePricingType === "subscription" 
          ? "price_1Sj4nrEPiAZgF8MeCOUpkIfg" // $26/mo subscription
          : "price_1Sj4o1EPiAZgF8MeVAfYLZ1h"; // $49 one-time
        
        try {
          const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
            body: { priceId },
          });

          if (checkoutError) throw checkoutError;

          if (checkoutData?.url) {
            toast({
              title: "Account created!",
              description: "Redirecting to checkout...",
            });
            window.location.href = checkoutData.url;
            return;
          }
        } catch (checkoutErr) {
          console.error("Checkout error:", checkoutErr);
          // If checkout fails, still navigate to profile setup
          toast({
            title: "Account created!",
            description: "Welcome to GiggMe. You can complete payment later.",
          });
          navigate("/profile-setup");
          return;
        }
      }

      toast({
        title: "Account created!",
        description: "Welcome to GiggMe. Complete your profile to get started.",
      });
      
      navigate("/profile-setup");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: error.errors[0].message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Signup failed",
          description: error.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = resetPasswordSchema.parse({
        email: resetEmail,
      });

      const { error } = await supabase.auth.resetPasswordForEmail(validatedData.email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast({
        title: "Reset email sent!",
        description: "Check your inbox for password reset instructions.",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: error.errors[0].message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Reset failed",
          description: error.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = newPasswordSchema.parse({
        password: newPassword,
        confirmPassword: confirmPassword,
      });

      const { error } = await supabase.auth.updateUser({
        password: validatedData.password,
      });

      if (error) throw error;

      toast({
        title: "Password updated!",
        description: "Your password has been successfully changed.",
      });
      
      setIsResettingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
      navigate(postAuthPath);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: error.errors[0].message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Update failed",
          description: error.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const isSignupMode = searchParams.get("mode") === "signup";
  if (entertainerPlan && isSignupMode && !isResettingPassword) {
    const selectedKey = planParam as "entertainer_basic" | "entertainer_featured";
    const setPlan = (key: "entertainer_basic" | "entertainer_featured") => {
      const params = new URLSearchParams(searchParams);
      params.set("plan", key);
      params.set("mode", "signup");
      navigate(`/auth?${params.toString()}`, { replace: true });
    };

    return (
      <div className="min-h-screen bg-[hsl(230_35%_7%)] text-white overflow-x-hidden">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-fuchsia-500/20 blur-[140px]" />
        </div>

        {/* Header */}
        <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="GiggMe" className="h-16 sm:h-20 w-auto object-contain" />
          </Link>
          <p className="text-sm text-white/70">
            Already have an account?{" "}
            <Link to="/auth" className="text-fuchsia-400 hover:text-fuchsia-300 font-semibold">
              Log in
            </Link>
          </p>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid lg:grid-cols-2 gap-10">
          {/* LEFT: Marketing */}
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 border border-violet-400/30">
              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
              <span className="text-xs font-semibold tracking-wide text-white/90">
                FOR PERFORMERS & ENTERTAINERS
              </span>
            </div>
            <h1 className="mt-6 text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
              Get Discovered.
              <br />
              Get Hired.
              <br />
              Do What You{" "}
              <span className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                Love.
              </span>
            </h1>
            <p className="mt-5 text-white/65 text-base max-w-md leading-relaxed">
              Join thousands of performers who are getting booked for concerts, restaurants, private events, and more.
            </p>

            <div className="mt-8 space-y-5">
              {[
                { icon: Search, color: "bg-violet-500/15 text-violet-300 border-violet-400/30", title: "Get Discovered", desc: "Be seen by booking managers and event planners." },
                { icon: Calendar, color: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30", title: "Get Booked", desc: "Receive booking inquiries for events near you." },
                { icon: DollarSign, color: "bg-amber-500/15 text-amber-300 border-amber-400/30", title: "Get Paid", desc: "Do what you love and get paid for it." },
              ].map((b) => {
                const I = b.icon;
                return (
                  <div key={b.title} className="flex items-start gap-4">
                    <div className={`h-11 w-11 rounded-xl border flex items-center justify-center ${b.color}`}>
                      <I className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{b.title}</p>
                      <p className="text-sm text-white/60">{b.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Testimonial */}
            <div className="mt-10 relative rounded-2xl overflow-hidden border border-white/10 max-w-md">
              <img src={heroVocalist} alt="" className="w-full h-72 object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-5">
                <Quote className="h-5 w-5 text-fuchsia-400 mb-1" />
                <div className="flex items-center gap-0.5 text-amber-400 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-white/90 italic">
                  "GiggMe helped me get booked 3 shows in my first week. Highly recommend!"
                </p>
                <p className="mt-2 text-xs font-semibold text-white">Sophia Vale <span className="text-white/50 font-normal">· Vocalist</span></p>
              </div>
            </div>
          </div>

          {/* RIGHT: Signup card */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8">
            <h2 className="text-3xl font-bold text-white">Create Your Account</h2>
            <p className="mt-1 text-sm text-white/60">Start your 7-day free trial. Cancel anytime.</p>

            {/* Step 1: Plans */}
            <div className="mt-7">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-6 w-6 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-200 text-xs font-bold flex items-center justify-center">1</span>
                <span className="text-xs font-bold tracking-wider text-violet-300">CHOOSE YOUR PLAN</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {/* Basic */}
                <button
                  type="button"
                  onClick={() => setPlan("entertainer_basic")}
                  className={`relative text-left rounded-2xl border p-4 transition-all ${
                    selectedKey === "entertainer_basic"
                      ? "border-violet-400 bg-violet-500/10 shadow-[0_0_0_2px_hsl(270_90%_60%/0.25)]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  {selectedKey === "entertainer_basic" && (
                    <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-violet-500 flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  <div className="h-11 w-11 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center">
                    <Music className="h-5 w-5 text-violet-300" />
                  </div>
                  <p className="mt-3 font-semibold text-white">Basic Profile</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">$8.99</span>
                    <span className="text-sm text-white/60">/mo</span>
                  </div>
                  <span className="mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-violet-500/30 text-violet-100">
                    7-DAY FREE TRIAL
                  </span>
                  <p className="mt-3 text-xs text-white/65 leading-relaxed">
                    Upload your profile, get listed in the entertainer directory, and receive booking inquiries.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-xs text-white/75">
                    {["Create your profile", "Upload photos & videos", "List your genres & skills", "Get discovered by agents", "Receive booking inquiries"].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-violet-300 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>

                {/* Featured */}
                <button
                  type="button"
                  onClick={() => setPlan("entertainer_featured")}
                  className={`relative text-left rounded-2xl border p-4 transition-all ${
                    selectedKey === "entertainer_featured"
                      ? "border-amber-400 bg-amber-500/10 shadow-[0_0_0_2px_hsl(45_90%_60%/0.25)]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  {selectedKey === "entertainer_featured" && (
                    <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  <div className="h-11 w-11 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
                    <Crown className="h-5 w-5 text-amber-300" />
                  </div>
                  <p className="mt-3 font-semibold text-white">Featured Performer</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">$14</span>
                    <span className="text-sm text-white/60">/mo</span>
                  </div>
                  <span className="mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-amber-500/30 text-amber-100">
                    7-DAY FREE TRIAL
                  </span>
                  <p className="mt-3 text-xs text-white/65 leading-relaxed">
                    Everything in Basic, plus priority placement and more ways to get booked.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-xs text-white/75">
                    {["Everything in Basic", "Priority placement in search", "Featured badge on profile", "Pushed to the front for prime opportunities", "Direct message with managers", "24/7 account support"].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              </div>
            </div>

            {/* Step 2: Account */}
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-6 w-6 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-200 text-xs font-bold flex items-center justify-center">2</span>
                <span className="text-xs font-bold tracking-wider text-violet-300">CREATE YOUR ACCOUNT</span>
              </div>

              <form onSubmit={handleSignup} className="space-y-3">
                <Input
                  type="text"
                  placeholder="Full Name"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  required
                  className="h-12 bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:ring-violet-500"
                />
                <Input
                  type="email"
                  placeholder="Email Address"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                  className="h-12 bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:ring-violet-500"
                />
                <div className="relative">
                  <Input
                    type={showSignupPassword ? "text" : "password"}
                    placeholder="Password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 pr-10 bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:ring-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full h-13 py-3.5 text-base font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 hover:opacity-95 shadow-[0_10px_40px_-10px_rgba(236,72,153,0.6)]"
                >
                  {loading ? "Creating account..." : "Start My 7-Day Free Trial"}
                </Button>

                <p className="flex items-center justify-center gap-2 text-xs text-white/55">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure payments. Cancel anytime.
                </p>
              </form>

              <p className="mt-6 text-center text-xs text-white/50">
                By creating an account, you agree to our{" "}
                <a href="#" className="text-violet-300 hover:underline">Terms of Service</a> and{" "}
                <a href="#" className="text-violet-300 hover:underline">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom trust strip */}
        <div className="border-t border-white/5 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: ShieldCheck, color: "text-violet-300 bg-violet-500/15 border-violet-400/30", title: "Secure & Safe", desc: "Your data is protected with industry-leading security." },
              { icon: Star, color: "text-pink-300 bg-pink-500/15 border-pink-400/30", title: "No Long-Term Contracts", desc: "Cancel anytime. No hidden fees." },
              { icon: Users, color: "text-amber-300 bg-amber-500/15 border-amber-400/30", title: "Trusted by Pros", desc: "Used by thousands of performers and entertainers." },
              { icon: MessageCircle, color: "text-cyan-300 bg-cyan-500/15 border-cyan-400/30", title: "24/7 Support", desc: "We're here to help you succeed." },
            ].map((b) => {
              const I = b.icon;
              return (
                <div key={b.title} className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl border flex items-center justify-center ${b.color}`}>
                    <I className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{b.title}</p>
                    <p className="text-xs text-white/55">{b.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/10">
      <Link 
        to="/" 
        className="absolute top-4 left-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back
      </Link>
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <img src={logo} alt="GiggMe" className="mx-auto h-40 w-auto object-contain mb-2" />
          <CardDescription>Connect groups and managers for seamless gig management</CardDescription>
        </CardHeader>
        
        <CardContent>
          {isResettingPassword ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">Set New Password</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your new password below
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          ) : (
            <Tabs defaultValue={searchParams.get("mode") === "signup" ? "signup" : "login"} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              {showForgotPassword ? (
                <div className="space-y-4">
                  {resetEmailSent ? (
                    <div className="text-center space-y-4 py-6">
                      <div className="text-5xl">📧</div>
                      <h3 className="text-lg font-semibold">Check your email</h3>
                      <p className="text-sm text-muted-foreground">
                        We've sent password reset instructions to {resetEmail}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setResetEmailSent(false);
                          setResetEmail("");
                        }}
                        className="w-full"
                      >
                        Back to Login
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Email</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="your@email.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Enter your email and we'll send you a reset link
                        </p>
                      </div>
                      
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Sending..." : "Send Reset Link"}
                      </Button>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowForgotPassword(false)}
                        className="w-full"
                      >
                        Back to Login
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="your@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Password</Label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Logging in..." : "Login"}
                  </Button>
                </form>
              )}
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Choose Your Plan</Label>
                  {entertainerPlan ? (
                    <div className="relative rounded-xl border-2 border-primary bg-primary/5 shadow-md p-4">
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-primary text-primary-foreground">
                          <Music className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{entertainerPlan.label}</h3>
                            <div className="text-right">
                              <span className="font-bold text-primary">{entertainerPlan.price}</span>
                              <span className="text-xs text-muted-foreground">/mo</span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{entertainerPlan.description}</p>
                          <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {entertainerPlan.trial}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {/* Band Manager Card */}
                    <div
                      onClick={() => setRole("booking_manager")}
                      className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-lg ${
                        role === "booking_manager"
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {role === "booking_manager" && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          role === "booking_manager" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                        }`}>
                          <Users className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">Group Manager</h3>
                              <Star className="h-4 w-4 text-brand-gold fill-brand-gold" />
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-primary">$14</span>
                              <span className="text-xs text-muted-foreground">/mo</span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Manage your group, schedule gigs, coordinate with venues, and keep your team organized.
                          </p>
                          <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            7-day free trial
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Booking Agent Card */}
                    <div
                      onClick={() => setRole("booking_manager")}
                      className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-lg ${
                        role === "booking_manager"
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {role === "booking_manager" && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          role === "booking_manager" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-secondary-foreground"
                        }`}>
                          <Briefcase className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Booking Agent</h3>
                            <div className="text-right">
                              <span className="font-bold text-primary">$26</span>
                              <span className="text-xs text-muted-foreground">/mo</span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Book entertainers, manage rosters, check availability, and handle client requests.
                          </p>
                          <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            7-day free trial
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Musicians/Entertainers Card */}
                    <div
                      onClick={() => setRole("artist")}
                      className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-lg ${
                        role === "artist"
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {role === "artist" && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          role === "artist" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                        }`}>
                          <Music className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Musicians / Entertainers</h3>
                            <div className="text-right">
                              <span className="font-bold text-primary">$10.99</span>
                              <span className="text-xs text-muted-foreground">/mo</span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Showcase your talent, get booked for gigs, manage your schedule, and grow your career.
                          </p>
                          <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            14-day free trial
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Venue Owner Card */}
                    <div
                      onClick={() => setRole("booking_manager")}
                      className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-lg ${
                        role === "booking_manager"
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {role === "booking_manager" && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          role === "booking_manager" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          <Building2 className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Venue Owner</h3>
                            <div className="text-right">
                              {venuePricingType === "subscription" ? (
                                <>
                                  <span className="font-bold text-primary">$26</span>
                                  <span className="text-xs text-muted-foreground">/mo</span>
                                </>
                              ) : (
                                <span className="font-bold text-primary">$49</span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Manage your venue, book entertainers, schedule events, and streamline bookings.
                          </p>
                          
                          {/* Pricing Toggle */}
                          {role === "booking_manager" && (
                            <div className="mt-3 p-2 bg-muted/50 rounded-lg" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setVenuePricingType("subscription")}
                                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                                    venuePricingType === "subscription"
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "bg-background text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  <div className="flex flex-col items-center">
                                    <span>$26/mo</span>
                                    <span className="text-xs opacity-75">14-day trial</span>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setVenuePricingType("one_time")}
                                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                                    venuePricingType === "one_time"
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "bg-background text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  <div className="flex flex-col items-center">
                                    <span>$49</span>
                                    <span className="text-xs opacity-75">One-time</span>
                                  </div>
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {role !== "booking_manager" && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                14-day free trial
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                or $49 one-time
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Your name"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
