import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Music, Briefcase, Users, Eye, EyeOff, Star, Check, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
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

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const safeRedirect = redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : null;
  const postAuthPath = safeRedirect || "/dashboard";
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"band_leader" | "band_member" | "booking_manager" | "artist" | "venue_owner">("band_leader");
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validatedData = loginSchema.parse({
        email: loginEmail,
        password: loginPassword,
      });

      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });
      
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
          title: "Login failed",
          description: error.message,
        });
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
            venue_pricing_type: role === "venue_owner" ? venuePricingType : undefined,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // For venue owners, redirect to checkout
      if (role === "venue_owner" && signUpData.session) {
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
            description: "Welcome to GigMe. You can complete payment later.",
          });
          navigate("/profile-setup");
          return;
        }
      }

      toast({
        title: "Account created!",
        description: "Welcome to GigMe. Complete your profile to get started.",
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/10">
      <Link 
        to="/" 
        className="absolute top-4 left-4 flex items-center hover:opacity-80 transition-opacity"
      >
        <img src={logo} alt="GiggMe" className="h-24 w-auto object-contain" />
      </Link>
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <img src={logo} alt="GiggMe" className="mx-auto h-40 w-auto object-contain mb-2" />
          <CardDescription>Connect bands and managers for seamless gig management</CardDescription>
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
            <Tabs defaultValue="login" className="w-full">
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
                  <div className="grid grid-cols-1 gap-3">
                    {/* Band Manager Card */}
                    <div
                      onClick={() => setRole("band_leader")}
                      className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-lg ${
                        role === "band_leader"
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {role === "band_leader" && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          role === "band_leader" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                        }`}>
                          <Users className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">Band Manager</h3>
                              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-primary">$14</span>
                              <span className="text-xs text-muted-foreground">/mo</span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Manage your band, schedule gigs, coordinate with venues, and keep your team organized.
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
                      onClick={() => setRole("venue_owner")}
                      className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-lg ${
                        role === "venue_owner"
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {role === "venue_owner" && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          role === "venue_owner" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
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
                          {role === "venue_owner" && (
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
                          
                          {role !== "venue_owner" && (
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
