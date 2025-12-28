import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, MessageCircle, Briefcase, Calendar as CalendarIcon, Music, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      
      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      
      setUserRole(roleData?.role || null);
      fetchUnreadCount(user.id);

      // Subscribe to message changes with unique channel name
      const channel = supabase
        .channel("nav-messages-" + user.id)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          () => {
            fetchUnreadCount(user.id);
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          () => {
            fetchUnreadCount(user.id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
  }, []);

  // Re-fetch unread count on route changes to catch any missed updates
  useEffect(() => {
    if (userId) {
      fetchUnreadCount(userId);
    }
  }, [location.pathname, userId]);

  const fetchUnreadCount = async (uid: string) => {
    try {
      // Only fetch messages relevant to this user (group messages OR messages where user is sender/recipient)
      const { data, error } = await supabase
        .from("messages")
        .select("id, read_by, sender_id, recipient_id, is_group_message");

      if (error) throw error;

      const unread = (data || []).filter((m: any) => {
        // Check if this message is relevant to the user
        const isRelevant = m.is_group_message || m.sender_id === uid || m.recipient_id === uid;
        // Check if unread (user not in read_by array)
        const isUnread = !(m.read_by || []).includes(uid);
        return isRelevant && isUnread;
      }).length;

      setUnreadCount(unread);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: MessageCircle, label: "Messages", path: "/messages", badge: unreadCount },
    { icon: Music, label: "My Gigs", path: "/bookings" },
    { 
      icon: PlusCircle, 
      label: "Book Gig", 
      path: userRole === "band_leader" || userRole === "super_admin" || userRole === "booking_manager" 
        ? "/booking-manager" 
        : "/bookings?new=true"
    },
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
                "flex flex-col items-center justify-center flex-1 h-full transition-colors relative",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5 mb-1" />
                {item.badge && item.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
