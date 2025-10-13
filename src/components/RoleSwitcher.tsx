import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

type UserRole = "band_leader" | "band_member" | "booking_manager";

interface RoleSwitcherProps {
  currentRole: UserRole | null;
  onRoleChange: () => void;
}

const RoleSwitcher = ({ currentRole, onRoleChange }: RoleSwitcherProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const roles: { value: UserRole; label: string; description: string }[] = [
    { value: "band_leader", label: "Band Leader", description: "Manage your band and bookings" },
    { value: "band_member", label: "Band Member", description: "Join bands and gigs" },
    { value: "booking_manager", label: "Booking Manager", description: "Book bands for venues" },
  ];

  const handleRoleChange = async (newRole: UserRole) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update the role in user_roles table
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Role updated",
        description: `Switched to ${roles.find(r => r.value === newRole)?.label}`,
      });

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
      <CardContent className="grid gap-2">
        {roles.map((role) => (
          <Button
            key={role.value}
            variant={currentRole === role.value ? "default" : "outline"}
            onClick={() => handleRoleChange(role.value)}
            disabled={loading || currentRole === role.value}
            className="justify-start"
          >
            <div className="text-left">
              <div className="font-semibold">{role.label}</div>
              <div className="text-xs opacity-80">{role.description}</div>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
};

export default RoleSwitcher;
