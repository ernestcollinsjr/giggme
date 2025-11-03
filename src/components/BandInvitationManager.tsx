import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Copy, Trash2 } from "lucide-react";

interface Invitation {
  id: string;
  email: string;
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
}

interface BandInvitationManagerProps {
  bandId: string;
  bandName: string;
}

export const BandInvitationManager = ({ bandId, bandName }: BandInvitationManagerProps) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvitations();
  }, [bandId]);

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from("band_invitations")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error: any) {
      console.error("Error fetching invitations:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load invitations.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter an email address.",
      });
      return;
    }

    setSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      console.log("Creating invitation with:", {
        band_id: bandId,
        email: email.toLowerCase().trim(),
        invited_by: user.id,
      });

      // Create invitation
      const { data: invitation, error: inviteError } = await supabase
        .from("band_invitations")
        .insert({
          band_id: bandId,
          email: email.toLowerCase().trim(),
          invited_by: user.id,
        })
        .select()
        .single();

      console.log("Insert result:", { invitation, error: inviteError });

      if (inviteError) {
        console.error("Full invitation error:", inviteError);
        throw inviteError;
      }

      // Send email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-band-invite", {
        body: {
          recipientEmail: email.toLowerCase().trim(),
          bandName: bandName,
          inviteToken: invitation.token,
          bandLeaderName: profile?.name || "Band Leader",
        },
      });

      if (emailError) throw emailError;

      toast({
        title: "Invitation sent!",
        description: `An invitation has been sent to ${email}`,
      });

      setEmail("");
      fetchInvitations();
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send invitation.",
      });
    } finally {
      setSending(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/band-invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: "Copied!",
      description: "Invitation link copied to clipboard.",
    });
  };

  const deleteInvitation = async (id: string) => {
    try {
      const { error } = await supabase
        .from("band_invitations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Invitation deleted",
        description: "The invitation has been removed.",
      });

      fetchInvitations();
    } catch (error: any) {
      console.error("Error deleting invitation:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete invitation.",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Band Members</CardTitle>
        <CardDescription>
          Send email invitations to new band members
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSendInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="member@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
              />
              <Button type="submit" disabled={sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </form>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : invitations.length > 0 ? (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Pending Invitations</h4>
            {invitations.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.status === "accepted" ? "Accepted" : "Pending"} • 
                    Expires {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyInviteLink(invite.token)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteInvitation(invite.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No pending invitations
          </p>
        )}
      </CardContent>
    </Card>
  );
};
