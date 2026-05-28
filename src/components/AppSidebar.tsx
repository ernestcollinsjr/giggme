import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Calendar,
  Music,
  Briefcase,
  MessageSquare,
  Users,
  Inbox,
  Settings,
  BarChart3,
  ListMusic,
  MapPin,
  Search,
  Shield,
  LogOut,
  HelpCircle,
  CreditCard,
} from "lucide-react";
import logo from "@/assets/logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type UserRole =
  | "band_leader"
  | "band_member"
  | "booking_manager"
  | "artist"
  | "tour_manager"
  | "venue_owner"
  | "super_admin"
  | null;

interface AppSidebarProps {
  userRole: UserRole;
}

export function AppSidebar({ userRole }: AppSidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const dashboardPath =
    userRole === "booking_manager"
      ? "/booking-manager"
      : userRole === "venue_owner"
      ? "/venue-dashboard"
      : userRole === "artist"
      ? "/entertainer-dashboard"
      : "/dashboard";

  const baseItems = [
    { title: "Dashboard", url: dashboardPath, icon: Home },
    { title: "Bookings", url: "/bookings", icon: Calendar },
  ];

  const roleItems: { title: string; url: string; icon: any }[] = [];
  if (userRole === "booking_manager" || userRole === "super_admin") {
    roleItems.push({ title: "Payment Scheduler", url: "/booking-manager?tab=payments", icon: CreditCard });
    roleItems.push({ title: "Booking Requests", url: "/booking-manager", icon: Inbox });
    roleItems.push({ title: "Performers", url: "/artists", icon: Users });
  }
  if (userRole === "band_leader" || userRole === "super_admin") {
    roleItems.push({ title: "Setlists", url: "/setlist", icon: ListMusic });
    roleItems.push({ title: "Tours", url: "/tours", icon: MapPin });
  }
  if (userRole === "venue_owner") {
    roleItems.push({ title: "Find Talent", url: "/entertainers", icon: Search });
  }
  if (userRole === "super_admin") {
    roleItems.push({ title: "Admin", url: "/admin", icon: Shield });
  }

  const utilityItems = [
    { title: "Inbox", url: "/messages", icon: MessageSquare },
    { title: "Calendar", url: "/bookings", icon: Calendar },
    { title: "Reports", url: "/notifications", icon: BarChart3 },
    { title: "Settings", url: "/profile-setup", icon: Settings },
  ];

  const items = [...baseItems, ...roleItems, ...utilityItems];

  const isActive = (url: string) => pathname === url.split("?")[0];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="GiggMe" className="h-9 w-auto object-contain" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title + item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                  >
                    <NavLink to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-3">
        {!collapsed && (
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3 text-center">
            <HelpCircle className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs font-semibold text-sidebar-foreground">Need Help?</p>
            <p className="text-[11px] text-sidebar-foreground/70 mt-0.5">
              We're here 24/7 to help you succeed.
            </p>
            <Button
              size="sm"
              className="mt-2 w-full bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500 text-white border-0 h-8 text-xs"
              onClick={() => navigate("/messages")}
            >
              Contact Support
            </Button>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2 text-sm">Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
