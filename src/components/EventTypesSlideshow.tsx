import { useState, useEffect, useCallback } from "react";
import { UtensilsCrossed, Music2, Heart, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

const eventTypes = [
  {
    title: "Restaurants",
    bgColor: "bg-gradient-to-br from-orange-400 via-red-400 to-pink-500",
    icon: UtensilsCrossed,
    decorativeColor: "bg-amber-300",
    accentColor: "bg-yellow-400"
  },
  {
    title: "Clubs",
    bgColor: "bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-500",
    icon: Music2,
    decorativeColor: "bg-cyan-400",
    accentColor: "bg-pink-400"
  },
  {
    title: "Retirement Homes",
    bgColor: "bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500",
    icon: Heart,
    decorativeColor: "bg-yellow-300",
    accentColor: "bg-orange-400"
  },
  {
    title: "Recurring Events",
    bgColor: "bg-gradient-to-br from-pink-500 via-rose-500 to-red-500",
    icon: CalendarClock,
    decorativeColor: "bg-purple-400",
    accentColor: "bg-yellow-400"
  }
];

const EventTypesSlideshow = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % eventTypes.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + eventTypes.length) % eventTypes.length);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      nextSlide();
    }, 3000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, nextSlide]);

  // Safety check to ensure index is within bounds
  const safeIndex = currentIndex >= eventTypes.length ? 0 : currentIndex;
  const currentEvent = eventTypes[safeIndex];
  const Icon = currentEvent.icon;

  return (
    <section className="max-w-6xl mx-auto px-4 py-16">
      <div className="grid lg:grid-cols-2 gap-8 items-center">
        {/* Animated Slide Card */}
        <div 
          className="relative"
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
        >
          <div 
            className={`relative aspect-[4/3] rounded-2xl overflow-hidden ${currentEvent.bgColor} transition-all duration-500 ease-in-out`}
          >
            {/* Decorative blob shapes */}
            <div className={`absolute bottom-0 right-0 w-3/4 h-3/4 ${currentEvent.decorativeColor} rounded-tl-[120px] transition-all duration-700`}>
              <div className="absolute -top-20 -left-20 w-40 h-40 bg-inherit rounded-full" />
              <div className="absolute -top-10 left-20 w-28 h-28 bg-inherit rounded-full" />
            </div>
            
            {/* Additional accent shape */}
            <div className={`absolute top-8 left-8 w-20 h-20 ${currentEvent.accentColor} rounded-full opacity-80 transition-all duration-700`} />
            <div className={`absolute top-20 left-24 w-12 h-12 ${currentEvent.accentColor} rounded-full opacity-60 transition-all duration-700`} />
            
            {/* Event Icon */}
            <div className="absolute top-6 right-6 opacity-30">
              <Icon className="h-28 w-28 text-white drop-shadow-lg" />
            </div>

            {/* Sparkle decorations */}
            <div className="absolute top-1/4 right-1/4 w-3 h-3 bg-white rounded-full opacity-60 animate-pulse" />
            <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-white rounded-full opacity-40 animate-pulse" style={{ animationDelay: '0.5s' }} />
            <div className="absolute bottom-1/3 left-1/4 w-2 h-2 bg-white rounded-full opacity-50 animate-pulse" style={{ animationDelay: '1s' }} />

            {/* Title */}
            <div className="absolute bottom-8 left-8 z-10">
              <h3 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                {currentEvent.title}
              </h3>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-2">
              {eventTypes.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentIndex 
                      ? "bg-primary w-6" 
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={prevSlide}
                className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextSlide}
                className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="bg-secondary/10 rounded-2xl p-8 lg:p-10">
          <p className="text-lg text-muted-foreground mb-4">
            With us, <span className="text-foreground font-semibold">planners have the confidence to bring their events to life</span>, while entertainers and event professionals enjoy quality leads and more opportunities to do what they love.
          </p>
          <p className="text-lg text-muted-foreground">
            When booking is easy, everyone can focus on what really matters — <span className="text-foreground font-semibold">crafting experiences that leave a lasting impression on guests</span>. Book something awesome®.
          </p>
        </div>
      </div>
    </section>
  );
};

export default EventTypesSlideshow;
