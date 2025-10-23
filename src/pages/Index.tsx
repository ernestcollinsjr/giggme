import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Music, Briefcase, MapPin, Star, Users, Crown, Mic } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary mb-6 shadow-lg">
            <Music className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent">
            GigMe
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Connect band leaders, band members, artists/musicians, and booking managers for seamless gig management
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="text-lg px-8 py-6"
            >
              Get Started
            </Button>
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="text-lg px-8 py-6"
            >
              Log In
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-16">
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
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
              <Mic className="h-6 w-6 text-purple-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Artist/Musician</h3>
            <p className="text-muted-foreground mb-4">
              Showcase your talent, build your portfolio, and connect with bands and venues
            </p>
            <div className="flex items-center gap-2 text-sm text-purple-500">
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
      </div>
    </div>
  );
};

export default Index;
