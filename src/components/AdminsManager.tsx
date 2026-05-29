import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Trash2, UserPlus } from "lucide-react";

interface AdminRow {
  id: string;
  admin_user_id: string;
  created_at: string;
  email?: string;
  name?: string;
}

export const AdminsManager = ({ bookingManagerId }: { bookingManagerId: string }) => {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("booking_manager_admins")
      .select("id, admin_user_id, created_at")
      .eq("booking_manager_id", bookingManagerId);
    if (error) return;
    const rows = data ?? [];
    if (rows.length === 0) {
      setAdmins([]);
      return;
    }
    const ids = rows.map((r) => r.admin_user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, name")
      .in("id", ids);
    setAdmins(
      rows.map((r) => {
        const p = profiles?.find((pp) => pp.id === r.admin_user_id);
        return { ...r, email: p?.email, name: p?.name };
      })
    );
  };

  useEffect(() => {
    if (bookingManagerId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingManagerId]);

  const addAdmin = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      if (pErr || !prof) {
        toast({ title: "User not found", description: "They need to sign up first.", variant: "destructive" });
        return;
      }
      const { error: rErr } = await supabase.from("user_roles").upsert(
        { user_id: prof.id, role: "admin" as any },
        { onConflict: "user_id,role" }
      );
      if (rErr) throw rErr;
      const { error: aErr } = await supabase
        .from("booking_manager_admins")
        .insert({ booking_manager_id: bookingManagerId, admin_user_id: prof.id });
      if (aErr) throw aErr;
      setEmail("");
      toast({ title: "Admin added", description: "They can now help manage your roster." });
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't add admin", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const removeAdmin = async (id: string) => {
    const { error } = await supabase.from("booking_manager_admins").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    await load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" /> Admins
        </CardTitle>
        <CardDescription>
          Grant trusted users access to help manage your roster. Admins can edit your roster, groups,
          and gigs but cannot delete your account or change billing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-email">Add admin by email</Label>
          <div className="flex gap-2">
            <Input
              id="admin-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button onClick={addAdmin} disabled={loading} className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admins yet.</p>
          ) : (
            admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.name || a.email || a.admin_user_id}</p>
                  {a.email && <p className="text-xs text-muted-foreground truncate">{a.email}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeAdmin(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
