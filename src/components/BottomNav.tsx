import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, User, MessageCircle, Briefcase, Calendar as CalendarIcon } from "lucide-react";
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
        .single();
      
      setUserRole(roleData?.role || null);
      fetchUnreadCount(user.id);

      // Subscribe to message changes
      const channel = supabase
        .channel("nav-messages")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages" },
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

  const fetchUnreadCount = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, read_by");

      if (error) throw error;

      const unread = (data || []).filter(
        (m: any) => !(m.read_by || []).includes(uid)
      ).length;

      setUnreadCount(unread);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: User, label: "Profile", path: "/profile-setup" },
    { icon: MessageCircle, label: "Chat", path: "/chat", badge: unreadCount },
    { 
      icon: userRole === "tour_manager" ? CalendarIcon : Briefcase, 
      label: userRole === "tour_manager" ? "Tours" : "Bookings", 
      path: userRole === "tour_manager" ? "/tours" : "/bookings" 
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
