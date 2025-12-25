import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TopNavProps {
  userRole: "band_leader" | "band_member" | "booking_manager" | "artist" | "tour_manager" | "venue_owner" | "super_admin";
}

export const TopNav = ({ userRole }: TopNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const bandLeaderLinks = [
    { path: "/dashboard", label: "Dashboard", icon: Home },
    { path: "/bookings", label: "Gigs", icon: Calendar },
    { path: "/rehearsals", label: "Rehearsals", icon: Music },
    { path: "/setlist", label: "Setlists", icon: ListMusic },
    { path: "/chat", label: "Messages", icon: MessageSquare },
  ];

  const bookingManagerLinks = [
    { path: "/dashboard", label: "Dashboard", icon: Home },
    { path: "/booking-manager", label: "Roster", icon: Briefcase },
    { path: "/artists", label: "Discover", icon: Search },
    { path: "/chat", label: "Messages", icon: MessageSquare },
  ];

  const artistLinks = [
    { path: "/dashboard", label: "Dashboard", icon: Home },
    { path: "/artist-profile", label: "My Profile", icon: User },
    { path: "/artists", label: "Browse Artists", icon: Users },
    { path: "/chat", label: "Messages", icon: MessageSquare },
  ];

  const tourManagerLinks = [
    { path: "/dashboard", label: "Dashboard", icon: Home },
    { path: "/tours", label: "Tours", icon: MapPin },
    { path: "/chat", label: "Messages", icon: MessageSquare },
  ];

  const venueOwnerLinks = [
    { path: "/venue-dashboard", label: "Dashboard", icon: Home },
    { path: "/entertainers", label: "Find Entertainment", icon: Search },
    { path: "/chat", label: "Messages", icon: MessageSquare },
  ];

  const superAdminLinks = [
    { path: "/dashboard", label: "Dashboard", icon: Home },
    { path: "/admin", label: "Admin", icon: Shield },
    { path: "/bookings", label: "Gigs", icon: Calendar },
    { path: "/chat", label: "Messages", icon: MessageSquare },
  ];

  const getLinks = () => {
    switch (userRole) {
      case "super_admin":
        return superAdminLinks;
      case "band_leader":
        return bandLeaderLinks;
      case "booking_manager":
        return bookingManagerLinks;
      case "artist":
        return artistLinks;
      case "tour_manager":
        return tourManagerLinks;
      case "venue_owner":
        return venueOwnerLinks;
      default:
        return [{ path: "/dashboard", label: "Dashboard", icon: Home }];
    }
  };

  const links = getLinks();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link to="/" className="flex items-center gap-2 mr-6 hover:opacity-80 transition-opacity">
          <div className="bg-primary rounded-lg p-1.5">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg hidden sm:inline">GigMe</span>
        </Link>
        <div className="flex gap-1 md:gap-2">
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
        </div>
      </div>
    </nav>
  );
};
