import { useState, useEffect, useCallback } from "react";
import { Cake, Building2, PartyPopper, Heart, Sparkles, Gift, ChevronLeft, ChevronRight } from "lucide-react";

const eventTypes = [
  {
    title: "Weddings",
    bgColor: "bg-gradient-to-br from-primary to-purple-600",
    icon: Heart,
    decorativeColor: "bg-secondary/80"
  },
  {
    title: "Corporate Events",
    bgColor: "bg-gradient-to-br from-blue-400 to-primary",
    icon: Building2,
    decorativeColor: "bg-primary"
  },
  {
    title: "Birthdays",
    bgColor: "bg-gradient-to-br from-amber-400 to-yellow-500",
    icon: Cake,
    decorativeColor: "bg-primary"
  },
  {
    title: "Holiday Parties",
    bgColor: "bg-gradient-to-br from-purple-300 to-primary",
    icon: PartyPopper,
    decorativeColor: "bg-primary"
  },
  {
    title: "Private Events",
    bgColor: "bg-gradient-to-br from-primary to-violet-600",
    icon: Sparkles,
    decorativeColor: "bg-secondary/60"
  },
  {
    title: "Special Occasions",
    bgColor: "bg-gradient-to-br from-purple-500 to-primary",
    icon: Gift,
    decorativeColor: "bg-amber-400"
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

  const currentEvent = eventTypes[currentIndex];
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
            {/* Decorative cloud/blob shape */}
            <div className={`absolute bottom-0 right-0 w-3/4 h-3/4 ${currentEvent.decorativeColor} rounded-tl-[100px] transition-all duration-500`}>
              <div className="absolute -top-16 -left-16 w-32 h-32 bg-inherit rounded-full" />
              <div className="absolute -top-8 left-16 w-24 h-24 bg-inherit rounded-full" />
            </div>
            
            {/* Event Icon */}
            <div className="absolute top-6 right-6 opacity-20">
              <Icon className="h-24 w-24 text-white" />
            </div>

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
