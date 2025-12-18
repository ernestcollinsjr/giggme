import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import restaurantsImg from "@/assets/slideshow-restaurants.jpg";
import clubsImg from "@/assets/slideshow-clubs.jpg";
import retirementImg from "@/assets/slideshow-retirement.jpg";
import recurringImg from "@/assets/slideshow-recurring.jpg";

const eventTypes = [
  {
    title: "Restaurants",
    image: restaurantsImg,
  },
  {
    title: "Clubs",
    image: clubsImg,
  },
  {
    title: "Retirement Homes",
    image: retirementImg,
  },
  {
    title: "Recurring Events",
    image: recurringImg,
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

  return (
    <section className="max-w-6xl mx-auto px-4 py-16">
      <div className="grid lg:grid-cols-2 gap-8 items-center">
        {/* Animated Slide Card */}
        <div 
          className="relative"
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
        >
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden transition-all duration-500 ease-in-out">
            {/* Background Image */}
            <img 
              src={currentEvent.image} 
              alt={currentEvent.title}
              className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

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
            From <span className="text-foreground font-semibold">intimate restaurant performances</span> to <span className="text-foreground font-semibold">high-energy club nights</span>, we connect talented entertainers with venues that need them most.
          </p>
          <p className="text-lg text-muted-foreground">
            Whether you are bringing joy to <span className="text-foreground font-semibold">retirement communities</span> or booking <span className="text-foreground font-semibold">recurring weekly gigs</span>, GigMe makes it simple to find the perfect match. Book something awesome®.
          </p>
        </div>
      </div>
    </section>
  );
};

export default EventTypesSlideshow;
