import { useNavigate, useLocation } from "react-router-dom";
import { Home, User, MessageCircle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: User, label: "Profile", path: "/profile-setup" },
    { icon: MessageCircle, label: "Chat", path: "/chat" },
    { icon: Calendar, label: "Bookings", path: "/bookings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg">
      <div className="flex items-center justify-around h-16 max-w-4xl mx-auto px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
