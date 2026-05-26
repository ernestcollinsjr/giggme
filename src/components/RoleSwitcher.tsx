import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Music, Briefcase, Crown, Star, Users, RefreshCw, Calendar, Shield } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UserRole = "band_leader" | "band_member" | "booking_manager" | "artist" | "tour_manager" | "super_admin";

interface RoleSwitcherProps {
  currentRole: UserRole | null;
  onRoleChange: () => void;
}

const RoleSwitcher = ({ currentRole, onRoleChange }: RoleSwitcherProps) => {
  const [loading, setLoading] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Band members cannot change their own role - only Band Leaders and Booking Managers can assign roles
  const canSwitchRole = currentRole !== "band_member";

  const roles = [
    {
      value: "super_admin" as UserRole, 
      label: "Super Admin", 
      description: "Full control over the entire site, all users, and all settings",
      icon: Shield,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      badge: { icon: Star, text: "Admin Role", color: "text-red-600" }
    },
    {
      value: "band_leader" as UserRole, 
      label: "Band Leaders", 
      description: "Lead your band, manage your group, and connect with booking managers to secure gigs",
      icon: Crown,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      badge: { icon: Star, text: "Premium Role", color: "text-primary" }
    },
    { 
      value: "booking_manager" as UserRole, 
      label: "Booking Managers", 
      description: "Discover talented bands, track their locations, and manage your roster all in one place",
      icon: Briefcase,
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
      badge: { icon: Star, text: "Premium Role", color: "text-accent" }
    },
    { 
      value: "tour_manager" as UserRole, 
      label: "Tour/Road Managers", 
      description: "Manage tours and coordinate with tour crew members efficiently",
      icon: Calendar,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      badge: { icon: Star, text: "Premium Role", color: "text-orange-600" }
    },
    { 
      value: "artist" as UserRole, 
      label: "Artist/Musician", 
      description: "Showcase your talent, build your portfolio, and get discovered by booking managers",
      icon: Music,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      badge: { icon: Star, text: "Premium Role", color: "text-purple-600" }
    },
  ];

  const handleRoleChange = async (newRole: UserRole) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      // Delete existing role and insert new one
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user.id);

      const { error } = await supabase
        .from("user_roles")
        .insert({ 
          user_id: user.id,
          role: newRole 
        });

      if (error) throw error;

      toast({
        title: "Role updated",
        description: `Switched to ${roles.find(r => r.value === newRole)?.label}`,
      });

      // Refresh the page to show role-specific features
      onRoleChange();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to switch role",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!canSwitchRole) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p className="text-sm">Your role is assigned by your Band Leader or Booking Manager.</p>
      </div>
    );
  }

  const selectedRoleDetails = pendingRole ? roles.find(r => r.value === pendingRole) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {roles.map((role) => {
          const Icon = role.icon;
          const BadgeIcon = role.badge.icon;
          const isCurrentRole = currentRole === role.value;
          
          return (
            <Card 
              key={role.value}
              className={`border-border/50 shadow hover:shadow-lg transition-all cursor-pointer hover:scale-[1.02] ${
                isCurrentRole ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => !loading && !isCurrentRole && setPendingRole(role.value)}
            >
              <CardContent className="pt-4 pb-3 px-3">
                <div className={`w-10 h-10 rounded-full ${role.iconBg} flex items-center justify-center mb-3`}>
                  <Icon className={`h-5 w-5 ${role.iconColor}`} />
                </div>
                <h3 className="text-sm font-semibold mb-1.5 leading-tight">{role.label}</h3>
                <p className="text-muted-foreground mb-3 text-xs leading-tight line-clamp-2">
                  {role.description}
                </p>
                <div className={`flex items-center gap-1.5 text-xs ${role.badge.color}`}>
                  <BadgeIcon className="h-3 w-3 flex-shrink-0" />
                  <span className="font-medium truncate">{role.badge.text}</span>
                </div>
                {isCurrentRole && (
                  <div className="mt-2 text-center">
                    <span className="text-xs font-semibold text-primary">Current</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!pendingRole} onOpenChange={(open) => !open && setPendingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {selectedRoleDetails?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will change your role from <strong>{roles.find(r => r.value === currentRole)?.label || "None"}</strong> to <strong>{selectedRoleDetails?.label}</strong>. 
              Your available features and dashboard will update to reflect your new role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              disabled={loading}
              onClick={() => {
                if (pendingRole) {
                  handleRoleChange(pendingRole);
                  setPendingRole(null);
                }
              }}
            >
              {loading ? "Switching..." : "Confirm Switch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RoleSwitcher;
