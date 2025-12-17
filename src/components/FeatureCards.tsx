import { useState, useEffect } from "react";
import { Play, Plus, Bell, Calendar } from "lucide-react";

const FeatureCards = () => {
  const [cursorPosition, setCursorPosition] = useState({ x: 50, y: 50 });
  const [activeChat, setActiveChat] = useState(0);
  const [highlightedDates, setHighlightedDates] = useState([15, 22]);

  // Animate cursor in Push Notifications card
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorPosition(prev => ({
        x: 30 + Math.random() * 40,
        y: 40 + Math.random() * 30
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Animate chat messages
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveChat(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      {/* Benefits row */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-12 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-xs">✓</span>
          </div>
          Free to get started
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-xs">✓</span>
          </div>
          No credit card required
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-xs">✓</span>
          </div>
          Unlimited team members
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-xs">✓</span>
          </div>
          Stay organized and connected
        </div>
      </div>

      {/* 4 Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Setlist Builder Card */}
        <div className="bg-card rounded-2xl p-5 shadow-lg border border-border/50 hover:shadow-xl transition-all duration-300">
          <h3 className="text-sm font-semibold mb-4 text-foreground">Setlist Builder</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2.5 bg-primary rounded-lg text-primary-foreground">
              <div className="w-7 h-7 rounded bg-primary-foreground/20 flex items-center justify-center">
                <Play className="h-3.5 w-3.5 fill-current" />
              </div>
              <span className="text-sm font-medium">Amazing Grace</span>
            </div>
            <div className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
              <span className="w-7 h-7 flex items-center justify-center text-sm font-medium text-muted-foreground">2</span>
              <span className="text-sm">How Great Is Our God</span>
            </div>
            <div className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
              <span className="w-7 h-7 flex items-center justify-center text-sm font-medium text-muted-foreground">3</span>
              <span className="text-sm">Goodness of God</span>
            </div>
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2 pl-2">
              <Plus className="h-4 w-4" />
              Add Song
            </button>
          </div>
        </div>

        {/* Push Notifications Card */}
        <div className="bg-card rounded-2xl p-5 shadow-lg border border-border/50 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
          <h3 className="text-sm font-semibold mb-4 text-foreground">Push Notifications</h3>
          <div className="h-40 relative flex items-center justify-center">
            <Bell className="h-12 w-12 text-muted-foreground/30" />
            {/* Animated cursor */}
            <div 
              className="absolute w-6 h-8 transition-all duration-1000 ease-in-out"
              style={{ 
                left: `${cursorPosition.x}%`, 
                top: `${cursorPosition.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="text-foreground drop-shadow-lg">
                <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.79a.5.5 0 0 0-.85.42Z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Team Chat Card */}
        <div className="bg-card rounded-2xl p-5 shadow-lg border border-border/50 hover:shadow-xl transition-all duration-300">
          <h3 className="text-sm font-semibold mb-4 text-foreground">Team Chat</h3>
          <div className="space-y-3">
            <div className={`flex items-start gap-2 transition-all duration-300 ${activeChat === 0 ? 'opacity-100' : 'opacity-60'}`}>
              <div className="w-6 h-6 rounded-full bg-red-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-500">Sarah</p>
                <p className="text-xs text-muted-foreground">Ready for practice!</p>
              </div>
            </div>
            <div className={`flex items-start gap-2 transition-all duration-300 ${activeChat === 1 ? 'opacity-100' : 'opacity-60'}`}>
              <div className="w-6 h-6 rounded-full bg-orange-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-orange-500">Mike</p>
                <p className="text-xs text-muted-foreground">Can we run song 2 first?</p>
              </div>
            </div>
            <div className={`transition-all duration-500 ${activeChat === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
              <button className="bg-primary text-primary-foreground text-xs px-4 py-2 rounded-lg font-medium">
                Sure, starting now!
              </button>
            </div>
          </div>
        </div>

        {/* Event Scheduling Card */}
        <div className="bg-card rounded-2xl p-5 shadow-lg border border-border/50 hover:shadow-xl transition-all duration-300">
          <h3 className="text-sm font-semibold mb-4 text-foreground">Event Scheduling</h3>
          {/* Mini Calendar */}
          <div className="text-xs">
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <span key={i} className="text-muted-foreground font-medium">{day}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                <span 
                  key={day} 
                  className={`w-6 h-6 flex items-center justify-center rounded-full transition-all duration-300 ${
                    highlightedDates.includes(day) 
                      ? 'bg-primary text-primary-foreground font-medium' 
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>
          </div>
          {/* Upcoming Event */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              Upcoming Event
            </div>
            <p className="text-sm font-medium">Sunday Service</p>
            <p className="text-xs text-muted-foreground">Dec 22 • 10:00 AM</p>
            <div className="flex items-center gap-1 mt-2">
              <div className="w-4 h-4 rounded-full bg-red-400 border-2 border-card" />
              <div className="w-4 h-4 rounded-full bg-blue-400 border-2 border-card -ml-2" />
              <div className="w-4 h-4 rounded-full bg-green-400 border-2 border-card -ml-2" />
              <span className="text-xs text-muted-foreground ml-1">+5 attending</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom tagline */}
      <h2 className="text-2xl md:text-3xl font-bold text-center mt-16">
        Everything you need to lead your team
      </h2>
    </section>
  );
};

export default FeatureCards;
