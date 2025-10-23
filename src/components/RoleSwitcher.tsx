import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Music, Briefcase, Crown, Star, Users, RefreshCw } from "lucide-react";

type UserRole = "band_leader" | "band_member" | "booking_manager" | "artist";

interface RoleSwitcherProps {
  currentRole: UserRole | null;
  onRoleChange: () => void;
}

const RoleSwitcher = ({ currentRole, onRoleChange }: RoleSwitcherProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const roles = [
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
      value: "band_member" as UserRole, 
      label: "Band Members", 
      description: "Share your location, showcase your instrument skills, and stay connected with your band",
      icon: Music,
      iconBg: "bg-secondary/10",
      iconColor: "text-secondary",
      badge: { icon: Users, text: "Free Forever", color: "text-muted-foreground" }
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
      const { data: { user } } = await supabase.auth.getUser();
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

  return (
    <div className="space-y-6">
      <Card className="border-dashed border-2 border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Test Different Roles
          </CardTitle>
          <CardDescription>
            Switch roles to test different features (Development Tool)
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {roles.map((role) => {
          const Icon = role.icon;
          const BadgeIcon = role.badge.icon;
          const isCurrentRole = currentRole === role.value;
          
          return (
            <Card 
              key={role.value}
              className={`border-border/50 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-105 ${
                isCurrentRole ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => !loading && !isCurrentRole && handleRoleChange(role.value)}
            >
              <CardContent className="pt-6">
                <div className={`w-12 h-12 rounded-full ${role.iconBg} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${role.iconColor}`} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{role.label}</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {role.description}
                </p>
                <div className={`flex items-center gap-2 text-sm ${role.badge.color}`}>
                  <BadgeIcon className="h-4 w-4" />
                  <span className="font-medium">{role.badge.text}</span>
                </div>
                {isCurrentRole && (
                  <div className="mt-4 text-center">
                    <span className="text-xs font-semibold text-primary">Current Role</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default RoleSwitcher;
