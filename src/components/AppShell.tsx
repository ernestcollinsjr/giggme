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

type UserRole =
  | "band_leader"
  | "band_member"
  | "booking_manager"
  | "artist"
  | "tour_manager"
  | "venue_owner"
  | "super_admin"
  | null;

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
      ? "Admin"
      : userRole === "booking_manager"
      ? "Booking Mgr"
      : userRole === "band_leader"
      ? "Band Leader"
      : userRole === "venue_owner"
      ? "Venue"
      : userRole === "artist"
      ? "Artist"
      : "Member";

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
                      className="flex items-center gap-2 px-3 h-9 rounded-lg border border-border/60 hover:bg-muted transition-colors text-sm"
                    >
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500" />
                      <span className="font-medium">{roleLabel}</span>
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
