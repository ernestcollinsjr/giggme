import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EventTypesSlideshow from "@/components/EventTypesSlideshow";
import { 
  Music, 
  Briefcase, 
  Star, 
  Users, 
  Crown, 
  Mic, 
  Search, 
  Moon, 
  Sun,
  Heart,
  Menu,
  Calendar,
  MapPin,
  Guitar,
  Headphones,
  Speaker
} from "lucide-react";

import heroSinger from "@/assets/hero-singer.jpg";
import heroDj from "@/assets/hero-dj.jpg";
import heroBand from "@/assets/hero-band.jpg";
import heroAcoustic from "@/assets/hero-acoustic.jpg";
import heroPianist from "@/assets/hero-pianist.jpg";
import heroSaxophone from "@/assets/hero-saxophone.jpg";
import heroViolinist from "@/assets/hero-violinist.jpg";
import heroDrummer from "@/assets/hero-drummer.jpg";
import heroJazzTrio from "@/assets/hero-jazz-trio.jpg";
import heroVocalist from "@/assets/hero-vocalist.jpg";
import heroMariachi from "@/assets/hero-mariachi.jpg";
import heroQuartet from "@/assets/hero-quartet.jpg";
import heroVirtualAssistant from "@/assets/hero-virtual-assistant.jpg";

const Index = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/artists?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/artists?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate("/dashboard");
      }
    };
    
    checkAuth();
  }, [navigate]);

  const categories = [
    {
      icon: Music,
      title: "Musical Acts",
      description: "Bands, DJs, Ensembles, Singers, Soloists, Wedding Musicians, and more",
      color: "text-primary"
    },
    {
      icon: Mic,
      title: "Artists & Performers",
      description: "Solo artists, Vocalists, Instrumentalists, Session musicians, and more",
      color: "text-secondary"
    },
    {
      icon: Speaker,
      title: "Sound & Production",
      description: "Sound engineers, Lighting crews, Production teams, and more",
      color: "text-green-500"
    }
  ];

  const heroImages = [
    { src: heroSinger, alt: "Singer performing at venue" },
    { src: heroDj, alt: "DJ at club event" },
    { src: heroBand, alt: "Live band at restaurant" },
    { src: heroAcoustic, alt: "Acoustic performance at retirement home" },
    { src: heroPianist, alt: "Pianist at upscale event" },
    { src: heroSaxophone, alt: "Saxophonist at jazz club" },
    { src: heroViolinist, alt: "Violinist at wedding reception" },
    { src: heroDrummer, alt: "Drummer performing on stage" },
    { src: heroJazzTrio, alt: "Jazz trio at upscale lounge" },
    { src: heroVocalist, alt: "Vocalist at corporate event" },
    { src: heroMariachi, alt: "Mariachi band at outdoor celebration" },
    { src: heroQuartet, alt: "String quartet at elegant gala" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Music className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary hidden sm:inline">GigMe</span>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search for entertainers" 
                className="pl-10 bg-muted/50 border-border/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
          </form>

          {/* Right Nav */}
          <nav className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-muted transition-colors relative"
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute top-2 left-2 h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>
            <button 
              onClick={() => navigate("/auth")}
              className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/auth")}
              className="hidden sm:flex"
            >
              List your services
            </Button>
            <Button 
              size="icon" 
              variant="outline"
              className="rounded-full"
            >
              <Heart className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              variant="outline"
              className="rounded-full md:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 min-h-[600px]">
            {/* Left Side - Virtual Assistant Image */}
            <div className="relative hidden lg:block">
              <img 
                src={heroVirtualAssistant} 
                alt="Virtual assistant booking gigs for clients"
                className="w-full h-full object-cover"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-primary/20" />
            </div>

            {/* Right Side - Content */}
            <div className="relative bg-primary px-6 py-12 lg:py-20 flex flex-col justify-center">
              {/* Decorative elements */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-20 right-10 w-32 h-32 border-2 border-primary-foreground/20 rounded-full" />
                <div className="absolute bottom-32 right-1/4 w-24 h-24 border-2 border-primary-foreground/20 rounded-full" />
                <svg className="absolute bottom-20 right-8 w-16 h-16 text-primary-foreground/20" viewBox="0 0 100 100">
                  <path d="M10,50 Q25,10 50,50 T90,50" stroke="currentColor" fill="none" strokeWidth="3"/>
                </svg>
              </div>
              
              <div className="relative z-10 max-w-lg">
                <p className="text-primary-foreground/80 text-sm mb-4 flex items-center gap-2">
                  <Star className="h-4 w-4 fill-current" />
                  Your personal booking assistant
                </p>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 leading-tight">
                  Let us book your entertainment
                </h1>
                <p className="text-primary-foreground/80 text-lg mb-8">
                  Our virtual assistant handles everything — finding talent, scheduling, and managing your recurring bookings automatically.
                </p>

                {/* Search Card */}
                <form onSubmit={handleSearch} className="bg-card rounded-xl p-5 shadow-2xl">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search for entertainers" 
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                    />
                  </div>
                  
                  <p className="text-sm font-medium text-muted-foreground mb-3">Browse categories</p>
                  
                  <div className="space-y-2">
                    {categories.map((category, index) => (
                      <button
                        key={index}
                        onClick={() => navigate("/auth")}
                        className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 ${category.color}`}>
                          <category.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className={`font-medium ${category.color}`}>{category.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{category.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Entertainer Slideshow Section */}
      <section className="py-8 bg-muted/30 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 mb-6">
          <h2 className="text-2xl font-bold text-center">Our Talented Entertainers</h2>
        </div>
        <div className="flex gap-4">
          <div className="animate-scroll-up flex flex-col gap-4">
            {[...heroImages, ...heroImages].map((img, index) => (
              <div key={`scroll1-${index}`} className="w-48 h-32 rounded-xl overflow-hidden shrink-0">
                <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div className="animate-scroll-down flex flex-col gap-4">
            {[...heroImages.slice().reverse(), ...heroImages.slice().reverse()].map((img, index) => (
              <div key={`scroll2-${index}`} className="w-48 h-32 rounded-xl overflow-hidden shrink-0">
                <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-muted-foreground text-lg">Book the best. Exceptional talent is just a few clicks away.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Browse and compare</h3>
              <p className="text-muted-foreground">
                Discover talented bands and artists in your area, compare their rates and availability.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Book securely</h3>
              <p className="text-muted-foreground">
                GigMe ensures secure connections, amazing service, and hassle-free coordination.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Enjoy your event</h3>
              <p className="text-muted-foreground">
                Watch your special moment spring to life with professional talent!
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Start planning
            </Button>
          </div>
        </div>
      </section>

      {/* Event Types Slideshow Section */}
      <EventTypesSlideshow />

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="bg-primary rounded-2xl p-8 md:p-12 text-center">
          <Star className="h-12 w-12 mx-auto mb-4 text-primary-foreground" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-primary-foreground">Ready to transform your gig management?</h2>
          <p className="text-primary-foreground/80 mb-6 max-w-2xl mx-auto">
            Join GigMe today and experience seamless connections between band leaders, band members, artists/musicians, and booking managers
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => navigate("/auth")}
          >
            Sign Up Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Music className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-primary">GigMe</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <button onClick={() => navigate("/pricing")} className="hover:text-foreground transition-colors">
                Pricing
              </button>
              <button onClick={() => navigate("/auth")} className="hover:text-foreground transition-colors">
                Sign In
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 GigMe. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
