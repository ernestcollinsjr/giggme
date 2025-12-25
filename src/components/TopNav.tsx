import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { 
  Home, 
  Calendar, 
  Music, 
  Users, 
  MessageSquare, 
  ListMusic,
  Briefcase,
  User,
  Search,
  MapPin,
  Zap,
  Shield,
  LogOut,
  Sun,
  Moon,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TopNavProps {
  userRole: "band_leader" | "band_member" | "booking_manager" | "artist" | "tour_manager" | "venue_owner" | "super_admin" | null;
}

export const TopNav = ({ userRole }: TopNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: error.message,
      });
    }
  };

  const bandLeaderLinks = [
    { path: "/bookings", label: "Gigs", icon: Calendar },
    { path: "/rehearsals", label: "Rehearsals", icon: Music },
    { path: "/setlist", label: "Setlists", icon: ListMusic },
    { path: "/notifications", label: "Alerts", icon: Bell },
  ];

  const bookingManagerLinks = [
    { path: "/booking-manager", label: "Roster", icon: Briefcase },
    { path: "/artists", label: "Discover", icon: Search },
    { path: "/notifications", label: "Alerts", icon: Bell },
  ];

  const artistLinks = [
    { path: "/artist-profile", label: "My Profile", icon: User },
    { path: "/artists", label: "Browse Artists", icon: Users },
    { path: "/notifications", label: "Notifications", icon: Bell },
  ];

  const tourManagerLinks = [
    { path: "/tours", label: "Tours", icon: MapPin },
    { path: "/notifications", label: "Alerts", icon: Bell },
  ];

  const venueOwnerLinks = [
    { path: "/venue-dashboard", label: "Dashboard", icon: Home },
    { path: "/entertainers", label: "Find Entertainment", icon: Search },
    { path: "/notifications", label: "Alerts", icon: Bell },
  ];

  const superAdminLinks = [
    { path: "/admin", label: "Admin", icon: Shield },
    { path: "/bookings", label: "Gigs", icon: Calendar },
    { path: "/notifications", label: "Alerts", icon: Bell },
  ];

  const bandMemberLinks = [
    { path: "/setlist", label: "Setlists", icon: ListMusic },
    { path: "/notifications", label: "Notifications", icon: Bell },
  ];

  const getLinks = () => {
    switch (userRole) {
      case "super_admin":
        return superAdminLinks;
      case "band_leader":
        return bandLeaderLinks;
      case "band_member":
        return bandMemberLinks;
      case "booking_manager":
        return bookingManagerLinks;
      case "artist":
        return artistLinks;
      case "tour_manager":
        return tourManagerLinks;
      case "venue_owner":
        return venueOwnerLinks;
      default:
        return [];
    }
  };

  const links = getLinks();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
        {/* Left side - Logo only */}
        <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="bg-primary rounded-lg p-1.5">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg hidden sm:inline">GigMe</span>
        </Link>
        
        {/* Right side - Nav links, Theme toggle, Profile & Logout */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="gap-2"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Button
                key={link.path}
                variant={isActive(link.path) ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate(link.path)}
                className={cn(
                  "gap-2 transition-all",
                  isActive(link.path) && "shadow-sm"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{link.label}</span>
              </Button>
            );
          })}
          <Button
            variant={isActive("/profile-setup") ? "default" : "ghost"}
            size="sm"
            onClick={() => navigate("/profile-setup")}
            className="gap-2"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </nav>
  );
};
