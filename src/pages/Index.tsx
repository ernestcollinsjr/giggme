import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FeatureShowcase } from "@/components/FeatureShowcase";
import { AnimatedTutorial, TutorialStep } from "@/components/tutorials/AnimatedTutorial";
import { Music, Briefcase, Star, Users, Crown, Mic, Check, ArrowRight, Moon, Sun, Calendar, MapPin, ListMusic } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate("/dashboard");
      }
    };
    
    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Music className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-primary">GigMe</span>
          </div>
          <nav className="hidden md:flex items-center gap-4">
            <button onClick={() => navigate("/pricing")} className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </button>
            <button onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </button>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="relative p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute top-2 left-2 h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>
            <Button onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-muted transition-colors relative"
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 top-2 left-2" />
            </button>
            <Button onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Music className="h-4 w-4" />
              For Music Teams
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              <span className="text-foreground">Gig Management</span>
              <br />
              <span className="text-primary">Made Simple</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Setlists, scheduling gigs, track your artist, organizing your band, get booked with agents, free to get started.
            </p>
            <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8 py-6 gap-2">
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Free to get started
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Unlimited team members
              </div>
            </div>
          </div>
          <div className="hidden md:flex justify-center">
            <div className="relative">
              <div className="w-64 h-[420px] bg-card border border-border/50 rounded-3xl shadow-2xl p-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                    <Music className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm font-medium">GigMe</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Upcoming Gig</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs">🎸</span>
                    </div>
                    <span className="text-sm">Rock The House</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                      <span className="text-xs">🎤</span>
                    </div>
                    <span className="text-sm">Jazz Night</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                      <span className="text-xs">🎹</span>
                    </div>
                    <span className="text-sm">Piano Lounge</span>
                  </div>
                </div>
              </div>
              <div className="absolute -right-8 top-12 w-48 bg-card border border-border/50 rounded-xl shadow-xl p-3">
                <p className="text-xs font-medium mb-2">Setlist</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="text-primary">●</span> My Girl
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary">●</span> Ain't No Mountain
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary">●</span> Superstition
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <FeatureShowcase />

      {/* Animated Tutorial Section */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">How It Works</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          See how GigMe streamlines your music workflow in just a few simple steps.
        </p>
        <AnimatedTutorial
          id="getting-started"
          steps={[
            {
              title: "Create Your Gig",
              description: "Set up your next performance with venue details, times, and all the info your band needs.",
              visual: (
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <div className="w-64 h-48 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 flex items-center justify-center">
                      <Calendar className="h-20 w-20 text-primary animate-pulse" />
                    </div>
                    <div className="absolute -right-4 -bottom-4 bg-card border border-border rounded-lg p-3 shadow-lg">
                      <p className="text-xs font-medium">Dec 21, 2024</p>
                      <p className="text-xs text-muted-foreground">8:00 PM</p>
                    </div>
                  </div>
                </div>
              ),
              narration: "First, create your gig by adding the venue, date, and performance details."
            },
            {
              title: "Invite Your Band",
              description: "Add band members and crew. They'll receive notifications and can confirm their availability.",
              visual: (
                <div className="flex items-center justify-center">
                  <div className="flex -space-x-4">
                    {[Crown, Music, Mic, Users].map((Icon, i) => (
                      <div 
                        key={i}
                        className="w-16 h-16 rounded-full bg-gradient-to-br from-secondary/30 to-secondary/10 border-2 border-background flex items-center justify-center shadow-lg"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      >
                        <Icon className="h-7 w-7 text-secondary" />
                      </div>
                    ))}
                  </div>
                </div>
              ),
              narration: "Invite your band members and crew. They'll get instant notifications."
            },
            {
              title: "Track Everyone",
              description: "See where your team members are on gig day with real-time location sharing.",
              visual: (
                <div className="flex items-center justify-center">
                  <div className="relative w-64 h-48 bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl border border-accent/30 overflow-hidden">
                    <MapPin className="absolute top-8 left-12 h-8 w-8 text-primary animate-bounce" />
                    <MapPin className="absolute top-16 right-16 h-6 w-6 text-secondary animate-bounce" style={{ animationDelay: "0.2s" }} />
                    <MapPin className="absolute bottom-12 left-1/2 h-7 w-7 text-accent animate-bounce" style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
              ),
              narration: "Track your team's location in real-time on gig day."
            },
            {
              title: "Manage Your Setlist",
              description: "Organize your songs, add lyrics, and share with your band for a flawless performance.",
              visual: (
                <div className="flex items-center justify-center">
                  <div className="bg-card border border-border rounded-xl p-4 shadow-lg w-56">
                    <div className="flex items-center gap-2 mb-3">
                      <ListMusic className="h-5 w-5 text-primary" />
                      <span className="font-medium text-sm">Tonight's Setlist</span>
                    </div>
                    <div className="space-y-2">
                      {["My Girl", "Superstition", "Ain't No Mountain"].map((song, i) => (
                        <div key={song} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-lg">
                          <span className="text-primary font-medium">{i + 1}.</span>
                          <span>{song}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ),
              narration: "Organize your setlist with songs and lyrics for a perfect show."
            }
          ]}
          onComplete={(id) => console.log(`Tutorial ${id} completed`)}
        />
      </section>

      {/* Role Cards Section */}
      <section className="max-w-6xl mx-auto px-4 py-16 border-t border-border/40">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Built for Everyone in Music</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Whether you're leading a band, playing in one, or booking talent – GigMe has you covered.
        </p>
        <div className="grid md:grid-cols-4 gap-6">
          <div 
            className="bg-card border border-border/50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-105"
            onClick={() => navigate("/pricing")}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Crown className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Band Leaders</h3>
            <p className="text-muted-foreground mb-4">
              Lead your band, manage your group, and connect with booking managers to secure gigs
            </p>
            <div className="flex items-center gap-2 text-sm text-primary">
              <Star className="h-4 w-4" />
              <span className="font-medium">Premium Role</span>
            </div>
          </div>

          <div 
            className="bg-card border border-border/50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-105"
            onClick={() => navigate("/pricing")}
          >
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
              <Music className="h-6 w-6 text-secondary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Band Members</h3>
            <p className="text-muted-foreground mb-4">
              Share your location, showcase your instrument skills, and stay connected with your band
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Free Forever</span>
            </div>
          </div>

          <div 
            className="bg-card border border-border/50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-105"
            onClick={() => navigate("/pricing")}
          >
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Mic className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Artist/Musician</h3>
            <p className="text-muted-foreground mb-4">
              Showcase your talent, build your portfolio, and connect with bands and venues
            </p>
            <div className="flex items-center gap-2 text-sm text-accent">
              <Star className="h-4 w-4" />
              <span className="font-medium">Premium Role</span>
            </div>
          </div>

          <div 
            className="bg-card border border-border/50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-105"
            onClick={() => navigate("/pricing")}
          >
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Briefcase className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Booking Manager</h3>
            <p className="text-muted-foreground mb-4">
              Discover talented bands, track their locations, and manage your roster all in one place
            </p>
            <div className="flex items-center gap-2 text-sm text-accent">
              <Star className="h-4 w-4" />
              <span className="font-medium">Premium Role</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="bg-gradient-to-br from-primary/5 to-secondary/5 border border-border/50 rounded-xl p-8 text-center shadow-lg">
          <Star className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-bold mb-4">Ready to transform your gig management?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join GigMe today and experience seamless connections between band leaders, band members, artists/musicians, and booking managers
          </p>
          <Button size="lg" onClick={() => navigate("/auth")}>
            Sign Up Now
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
