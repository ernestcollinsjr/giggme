import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, MessageCircle, Briefcase, Calendar as CalendarIcon, Music, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

/**
 * BottomNav - Fixed bottom navigation component
 * 
 * IMPORTANT HEIGHT DOCUMENTATION:
 * - Total height: 5rem (80px) = h-16 (64px) + safe-area-inset-bottom padding
 * - This height is used in PageContainer's `withBottomNav` prop calculation
 * - If you change the height here, you MUST also update:
 *   1. src/components/PageContainer.tsx - the 5rem value in h-[calc(100dvh-5rem)]
 * 
 * @see PageContainer for the layout component that accounts for this height
 */
const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [allowedMemberIds, setAllowedMemberIds] = useState<string[]>([]);

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
      
      const role = roleData?.role || null;
      setUserRole(role);
      
      // Fetch associated members based on role
      let memberIds: string[] = [];
      if (role === "band_leader") {
        const { data: bands } = await supabase
          .from("bands")
          .select("id")
          .eq("band_leader_id", user.id);
        
        if (bands && bands.length > 0) {
          const bandIds = bands.map(b => b.id);
          const { data: members } = await supabase
            .from("band_members")
            .select("member_id")
            .in("band_id", bandIds);
          
          if (members) {
            memberIds = members.map(m => m.member_id);
          }
        }
      } else if (role === "booking_manager") {
        const { data: managedArtists } = await supabase
          .from("booking_manager_artists")
          .select("artist_id")
          .eq("booking_manager_id", user.id);
        
        if (managedArtists) {
          memberIds = managedArtists.map(a => a.artist_id);
        }
      }
      setAllowedMemberIds(memberIds);
      fetchUnreadCount(user.id, role, memberIds);

      // Subscribe to message changes with unique channel name
      const channel = supabase
        .channel("nav-messages-" + user.id)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          () => {
            fetchUnreadCount(user.id, role, memberIds);
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          () => {
            fetchUnreadCount(user.id, role, memberIds);
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
      fetchUnreadCount(userId, userRole, allowedMemberIds);
    }
  }, [location.pathname, userId, userRole, allowedMemberIds]);

  const fetchUnreadCount = async (uid: string, role: string | null, memberIds: string[]) => {
    try {
      // For band_leader/booking_manager: ONLY count messages from their assigned members
      const isRestrictedRole = role === "band_leader" || role === "booking_manager";
      
      // Only fetch messages relevant to this user (group messages OR messages where user is sender/recipient)
      const { data, error } = await supabase
        .from("messages")
        .select("id, read_by, sender_id, recipient_id, is_group_message");

      if (error) throw error;

      const relevantMessages = (data || []).filter((m: any) => {
        // Check if this message is relevant to the user
        const isRelevant = m.is_group_message || m.sender_id === uid || m.recipient_id === uid;
        if (!isRelevant) return false;
        
        // For restricted roles, only count messages from/to allowed members
        if (isRestrictedRole) {
          if (m.is_group_message) return false; // No group chat for restricted roles
          const otherParticipant = m.sender_id === uid ? m.recipient_id : m.sender_id;
          return memberIds.includes(otherParticipant);
        }
        
        return true;
      });

      const unread = relevantMessages.filter((m: any) => {
        // Check if unread (user not in read_by array) and user is not the sender
        const readByArray = m.read_by || [];
        return m.sender_id !== uid && !readByArray.includes(uid);
      });

      setUnreadCount(unread.length);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  // Route to role-appropriate dashboard
  const dashboardPath = userRole === "booking_manager" ? "/booking-manager" : "/dashboard";
  
  const navItems = [
    { icon: Home, label: "Dashboard", path: dashboardPath },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg pb-[env(safe-area-inset-bottom)]">
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
