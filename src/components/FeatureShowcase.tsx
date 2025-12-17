import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Camera, Calendar, Bell, ListMusic, MapPin, Users, Music, MessageSquare,
  Play, Pause, ChevronLeft, ChevronRight, Volume2, VolumeX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const features = [
  {
    icon: Camera,
    title: "Capture Moments",
    description: "Document your performances",
    narration: "Capture every moment of your gigs, rehearsals, and performances with our built-in media tools.",
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-500",
  },
  {
    icon: Calendar,
    title: "Smart Calendar",
    description: "Schedule all your gigs",
    narration: "Keep track of all your upcoming gigs and rehearsals with our smart calendar system.",
    color: "from-orange-500 to-orange-600",
    bgColor: "bg-orange-500",
  },
  {
    icon: Bell,
    title: "Push Notifications",
    description: "Never miss an update",
    narration: "Stay informed with instant push notifications for gig updates and band messages.",
    color: "from-green-500 to-green-600",
    bgColor: "bg-green-500",
  },
  {
    icon: ListMusic,
    title: "Setlist Manager",
    description: "Organize your songs",
    narration: "Create and manage your setlists with ease. Drag, drop, and organize your songs perfectly.",
    color: "from-purple-500 to-purple-600",
    bgColor: "bg-purple-500",
  },
  {
    icon: MapPin,
    title: "Location Tracking",
    description: "Find your bandmates",
    narration: "Know where your performers are before the gig to assure timely arrivals.",
    color: "from-red-500 to-red-600",
    bgColor: "bg-red-500",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Coordinate your band",
    narration: "Manage your entire team in one place. Assign roles, track availability, and collaborate.",
    color: "from-cyan-500 to-cyan-600",
    bgColor: "bg-cyan-500",
  },
  {
    icon: Music,
    title: "Artist Profile",
    description: "Showcase your talent",
    narration: "Build your professional profile and showcase your talent to booking managers.",
    color: "from-pink-500 to-pink-600",
    bgColor: "bg-pink-500",
  },
  {
    icon: MessageSquare,
    title: "Band Chat",
    description: "Stay connected",
    narration: "Keep your band connected with real-time messaging and group conversations.",
    color: "from-indigo-500 to-indigo-600",
    bgColor: "bg-indigo-500",
  },
  {
    icon: Users,
    title: "Quick Callouts",
    description: "Replace performers instantly",
    narration: "Manage callouts and replace performers with one click of a button. Never scramble to find a sub again.",
    color: "from-amber-500 to-amber-600",
    bgColor: "bg-amber-500",
  },
];

export const FeatureShowcase = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasMountedRef = useRef(false);

  // Stop audio function
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsNarrating(false);
  }, []);

  // Speak function
  const speak = useCallback(async (text: string) => {
    if (!text || isMuted) return;
    
    stopAudio();

    try {
      const { data, error } = await supabase.functions.invoke("text-to-speech", {
        body: { text, voice: "nova" },
      });

      if (error || !data?.audioContent) {
        console.error("TTS error:", error);
        return;
      }

      const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsNarrating(false);
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
      };
      
      audio.onerror = () => {
        setIsNarrating(false);
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
      };

      setIsNarrating(true);
      await audio.play();
    } catch (error) {
      console.error("TTS error:", error);
      setIsNarrating(false);
    }
  }, [isMuted, stopAudio]);

  const goToStep = useCallback((step: number) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    stopAudio();
    
    setTimeout(() => {
      setCurrentStep(step);
      setIsAnimating(false);
      
      if (!isMuted && isPlaying) {
        speak(features[step].narration);
      }
    }, 300);
  }, [isAnimating, isMuted, isPlaying, speak, stopAudio]);

  const nextStep = useCallback(() => {
    const next = (currentStep + 1) % features.length;
    goToStep(next);
  }, [currentStep, goToStep]);

  const prevStep = useCallback(() => {
    const prev = currentStep === 0 ? features.length - 1 : currentStep - 1;
    goToStep(prev);
  }, [currentStep, goToStep]);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying || isAnimating || isNarrating) return;
    
    const delay = isMuted ? 4000 : 2000;
    const timeout = setTimeout(nextStep, delay);
    return () => clearTimeout(timeout);
  }, [isPlaying, nextStep, isNarrating, isMuted, isAnimating, currentStep]);

  // Speak on mount
  useEffect(() => {
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;
    
    if (!isMuted) {
      speak(features[0].narration);
    }
  }, [isMuted, speak]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const currentFeature = features[currentStep];
  const Icon = currentFeature.icon;

  return (
    <section className="max-w-6xl mx-auto px-4 py-16 overflow-hidden">
      {/* Main Showcase Area */}
      <div className="relative">
        {/* Background glow */}
        <div 
          className={`absolute inset-0 bg-gradient-to-r ${currentFeature.color} opacity-5 rounded-3xl blur-3xl transition-all duration-700`}
        />

        {/* Feature Display */}
        <div className="relative bg-card border border-border/50 rounded-2xl p-8 md:p-12 shadow-2xl">
          {/* Top Controls */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Feature Tour</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {currentStep + 1} / {features.length}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (!isMuted) {
                    stopAudio();
                  }
                  setIsMuted(!isMuted);
                }}
                className="h-8 w-8"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className={`h-4 w-4 ${isNarrating ? 'text-primary animate-pulse' : ''}`} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (isPlaying) {
                    stopAudio();
                  }
                  setIsPlaying(!isPlaying);
                }}
                className="h-8 w-8"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Icon Display */}
            <div 
              className={`
                relative flex-shrink-0
                transition-all duration-500 ease-out
                ${isAnimating ? 'opacity-0 scale-75 -translate-y-4' : 'opacity-100 scale-100 translate-y-0'}
              `}
            >
              <div className={`
                w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-br ${currentFeature.color}
                flex items-center justify-center shadow-2xl
                animate-bounce-subtle
              `}>
                <Icon className="h-16 w-16 md:h-20 md:w-20 text-white" />
              </div>
              
              {/* Floating particles */}
              <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-primary/60 animate-sparkle" />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-secondary/60 animate-sparkle" style={{ animationDelay: '0.5s' }} />
              <div className="absolute top-1/2 -right-3 w-2 h-2 rounded-full bg-accent/60 animate-sparkle" style={{ animationDelay: '1s' }} />
            </div>

            {/* Text Content */}
            <div 
              className={`
                flex-1 text-center md:text-left
                transition-all duration-500 ease-out delay-100
                ${isAnimating ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'}
              `}
            >
              <h3 className="text-2xl md:text-3xl font-bold mb-3">{currentFeature.title}</h3>
              <p className="text-lg text-muted-foreground mb-4">{currentFeature.description}</p>
              <p className="text-sm text-muted-foreground/80 leading-relaxed max-w-md">
                {currentFeature.narration}
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-10">
            <Button
              variant="outline"
              size="sm"
              onClick={prevStep}
              disabled={isAnimating}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {/* Step Indicators */}
            <div className="flex items-center gap-2">
              {features.map((feature, index) => {
                const StepIcon = feature.icon;
                const isActive = index === currentStep;
                const isPast = index < currentStep;
                
                return (
                  <button
                    key={index}
                    onClick={() => goToStep(index)}
                    disabled={isAnimating}
                    className={`
                      relative group transition-all duration-300
                      ${isActive ? 'scale-125' : 'hover:scale-110'}
                    `}
                  >
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      transition-all duration-300
                      ${isActive 
                        ? `bg-gradient-to-br ${feature.color} shadow-lg` 
                        : isPast 
                          ? 'bg-primary/20' 
                          : 'bg-muted hover:bg-muted-foreground/20'
                      }
                    `}>
                      <StepIcon className={`
                        h-3.5 w-3.5 transition-colors duration-300
                        ${isActive ? 'text-white' : isPast ? 'text-primary' : 'text-muted-foreground'}
                      `} />
                    </div>
                    
                    {/* Active indicator ring */}
                    {isActive && (
                      <div className={`
                        absolute inset-0 rounded-full border-2 border-primary/50
                        animate-ping opacity-75
                      `} />
                    )}
                  </button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={nextStep}
              disabled={isAnimating}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="mt-6 h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r ${currentFeature.color} transition-all duration-300`}
              style={{ width: `${((currentStep + 1) / features.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
