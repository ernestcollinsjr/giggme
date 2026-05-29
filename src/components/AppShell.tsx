import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, HelpCircle, ChevronDown } from "lucide-react";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";

type UserRole = AppRole | null;

interface AppShellProps {
  userRole: UserRole;
  children: ReactNode;
}

/**
 * AppShell wraps dashboard pages with a desktop sidebar layout (lg+),
 * while preserving the existing mobile experience (TopNav + BottomNav).
 *
 * On mobile (< lg), children are rendered as-is with their existing
 * TopNav/BottomNav (those nav components hide themselves at lg+).
 */
export function AppShell({ userRole, children }: AppShellProps) {
  const navigate = useNavigate();
  const roleLabel =
    userRole === "super_admin"
      ? "Super Admin"
      : userRole === "booking_manager"
      ? "Booking Mgr"
      : userRole === "admin"
      ? "Admin"
      : userRole === "entertainer"
      ? "Entertainer"
      : "Member";

  const [profile, setProfile] = useState<{ name: string | null; photo_urls: string[] | null }>({ name: null, photo_urls: null });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("name, photo_urls")
        .eq("id", user.id)
        .maybeSingle();
      if (active && data) setProfile(data as any);
    })();
    return () => { active = false; };
  }, []);

  const displayName = profile.name || roleLabel;
  const avatarSrc = profile.photo_urls?.[0];
  const initials = (profile.name || roleLabel)
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Mobile: pass-through, BottomNav and TopNav inside children handle nav */}
      <div className="lg:hidden">{children}</div>

      {/* Desktop: sidebar + topbar shell */}
      <div className="hidden lg:block">
        <SidebarProvider defaultOpen>
          <div className="min-h-screen flex w-full bg-background">
            <AppSidebar userRole={userRole} />
            <div className="flex-1 flex flex-col min-w-0">
              <header className="sticky top-0 z-40 h-16 border-b border-border/60 bg-background/80 backdrop-blur-xl">
                <div className="h-full flex items-center justify-between gap-4 px-6">
                  <div className="flex items-center gap-3">
                    <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                  </div>
                  <div className="flex-1 max-w-xl">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search anything..."
                        className="pl-9 h-9 bg-muted/40 border-border/60 focus-visible:ring-primary/40"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <NotificationBell />
                    <button
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => navigate("/messages")}
                      aria-label="Help"
                    >
                      <HelpCircle className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => navigate("/profile-setup")}
                      className="flex items-center gap-2 px-2 h-9 rounded-lg border border-border/60 hover:bg-muted transition-colors text-sm"
                    >
                      <Avatar className="h-7 w-7">
                        {avatarSrc && <AvatarImage src={avatarSrc} alt={displayName} />}
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials || "U"}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium max-w-[140px] truncate">{displayName}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </header>
              <main className="flex-1 min-w-0">{children}</main>
            </div>
          </div>
        </SidebarProvider>
      </div>
    </>
  );
}
