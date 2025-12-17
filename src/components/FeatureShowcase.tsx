import { useState, useEffect } from "react";
import { Camera, Calendar, Bell, ListMusic, MapPin, Users, Music, MessageSquare } from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "Capture Moments",
    description: "Document your performances",
    color: "from-blue-500 to-blue-600",
    bgGlow: "shadow-blue-500/50",
  },
  {
    icon: Calendar,
    title: "Smart Calendar",
    description: "Schedule all your gigs",
    color: "from-orange-500 to-orange-600",
    bgGlow: "shadow-orange-500/50",
  },
  {
    icon: Bell,
    title: "Push Notifications",
    description: "Never miss an update",
    color: "from-green-500 to-green-600",
    bgGlow: "shadow-green-500/50",
  },
  {
    icon: ListMusic,
    title: "Setlist Manager",
    description: "Organize your songs",
    color: "from-purple-500 to-purple-600",
    bgGlow: "shadow-purple-500/50",
  },
  {
    icon: MapPin,
    title: "Location Tracking",
    description: "Find your bandmates",
    color: "from-red-500 to-red-600",
    bgGlow: "shadow-red-500/50",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Coordinate your band",
    color: "from-cyan-500 to-cyan-600",
    bgGlow: "shadow-cyan-500/50",
  },
  {
    icon: Music,
    title: "Artist Profile",
    description: "Showcase your talent",
    color: "from-pink-500 to-pink-600",
    bgGlow: "shadow-pink-500/50",
  },
  {
    icon: MessageSquare,
    title: "Band Chat",
    description: "Stay connected",
    color: "from-indigo-500 to-indigo-600",
    bgGlow: "shadow-indigo-500/50",
  },
];

export const FeatureShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [visibleCards, setVisibleCards] = useState<number[]>([0, 1, 2, 3]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFlashing(true);
      
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % features.length);
        setVisibleCards((prev) => {
          const newCards = prev.map((i) => (i + 1) % features.length);
          return newCards;
        });
        setIsFlashing(false);
      }, 200);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-4 py-16 overflow-hidden">
      {/* Main animated showcase */}
      <div className="relative h-[300px] md:h-[280px]">
        {/* Background glow effect */}
        <div 
          className={`absolute inset-0 bg-gradient-to-r ${features[activeIndex].color} opacity-5 rounded-3xl blur-3xl transition-all duration-500`}
        />
        
        {/* Floating cards grid */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {visibleCards.map((featureIndex, position) => {
            const feature = features[featureIndex];
            const Icon = feature.icon;
            const isCenter = position === 1 || position === 2;
            
            return (
              <div
                key={`${featureIndex}-${position}`}
                className={`
                  relative bg-card border border-border/50 rounded-xl p-5 
                  transition-all duration-500 ease-out
                  ${isFlashing ? 'animate-flash scale-95 opacity-0' : 'opacity-100'}
                  ${isCenter ? 'md:scale-105 z-10' : 'scale-100'}
                  hover:scale-105 hover:-translate-y-2
                  shadow-lg ${feature.bgGlow} hover:shadow-xl
                `}
                style={{
                  animationDelay: `${position * 100}ms`,
                }}
              >
                {/* Pulse ring effect */}
                <div className={`
                  absolute -inset-1 bg-gradient-to-r ${feature.color} rounded-xl opacity-0
                  ${isCenter && !isFlashing ? 'animate-pulse-ring' : ''}
                `} />
                
                {/* Card content */}
                <div className="relative">
                  <div className={`
                    w-12 h-12 rounded-full bg-gradient-to-br ${feature.color} 
                    flex items-center justify-center mb-3
                    ${!isFlashing ? 'animate-bounce-subtle' : ''}
                  `}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-base mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>

                {/* Sparkle effects */}
                {isCenter && !isFlashing && (
                  <>
                    <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-sparkle" />
                    <div className="absolute bottom-4 right-4 w-1.5 h-1.5 bg-secondary rounded-full animate-sparkle" style={{ animationDelay: '0.3s' }} />
                    <div className="absolute top-1/2 left-2 w-1 h-1 bg-accent rounded-full animate-sparkle" style={{ animationDelay: '0.6s' }} />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {features.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setActiveIndex(index);
                setVisibleCards([
                  index,
                  (index + 1) % features.length,
                  (index + 2) % features.length,
                  (index + 3) % features.length,
                ]);
              }}
              className={`
                h-2 rounded-full transition-all duration-300
                ${activeIndex === index 
                  ? 'w-8 bg-primary' 
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }
              `}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
