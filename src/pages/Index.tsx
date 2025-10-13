import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Music, Briefcase, MapPin, Calendar, Star } from "lucide-react";

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
            Connect bands and managers for seamless gig management
          </p>
          <Button 
            size="lg" 
            onClick={() => navigate("/auth")}
            className="text-lg px-8 py-6"
          >
            Get Started
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-card border border-border/50 rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Music className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">For Bands</h3>
            <p className="text-muted-foreground">
              Create your profile, share your location, and connect with managers to book your next gig
            </p>
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
              <Briefcase className="h-6 w-6 text-secondary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">For Managers</h3>
            <p className="text-muted-foreground">
              Discover talented bands, track their locations, and manage your roster all in one place
            </p>
          </div>

          <div className="bg-card border border-border/50 rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <MapPin className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-Time Updates</h3>
            <p className="text-muted-foreground">
              Share locations in real-time and stay connected with instant messaging
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary/5 to-secondary/5 border border-border/50 rounded-xl p-8 text-center shadow-lg">
          <Star className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-bold mb-4">Ready to transform your gig management?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join GigMe today and experience seamless connections between bands and managers
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
