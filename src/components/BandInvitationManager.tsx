import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Copy, Trash2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Invitation {
  id: string;
  email: string;
  recipient_name: string | null;
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
}

interface Band {
  id: string;
  name: string;
}

interface BandInvitationManagerProps {
  bandId: string;
  bandName: string;
}

export const BandInvitationManager = ({ bandId, bandName }: BandInvitationManagerProps) => {
  const { toast } = useToast();
  const [recipientName, setRecipientName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [allBands, setAllBands] = useState<Band[]>([]);
  const [showBandSelectDialog, setShowBandSelectDialog] = useState(false);
  const [selectedBandForMember, setSelectedBandForMember] = useState<string>("");
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [addingToBand, setAddingToBand] = useState(false);

  useEffect(() => {
    fetchInvitations();
    fetchAllBands();
  }, [bandId]);

  const fetchAllBands = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("bands")
        .select("id, name")
        .eq("band_leader_id", user.id)
        .order("name");

      if (error) throw error;
      setAllBands(data || []);
    } catch (error: any) {
      console.error("Error fetching bands:", error);
    }
  };

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

    if (!recipientName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter the recipient's name.",
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
          recipient_name: recipientName.trim(),
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
          recipientName: recipientName.trim(),
          bandName: bandName,
          inviteToken: invitation.token,
          bandLeaderName: profile?.name || "Band Leader",
        },
      });

      if (emailError) throw emailError;

      toast({
        title: "Invitation sent!",
        description: `An invitation has been sent to ${recipientName.trim()}`,
      });

      setRecipientName("");
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

  const openBandSelectDialog = (invitation: Invitation) => {
    setSelectedInvitation(invitation);
    setSelectedBandForMember(bandId); // Default to current band
    setShowBandSelectDialog(true);
  };

  const addToBandWithSelection = async () => {
    if (!selectedInvitation || !selectedBandForMember) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a band.",
      });
      return;
    }

    setAddingToBand(true);

    try {
      // Find the user by email
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", selectedInvitation.email.toLowerCase())
        .single();

      if (!profile) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "User not found. They may need to sign up first.",
        });
        return;
      }

      // Add user to the selected band
      const { error: memberError } = await supabase
        .from("band_members")
        .insert({
          band_id: selectedBandForMember,
          member_id: profile.id,
        });

      if (memberError) throw memberError;

      // Delete the invitation
      await deleteInvitation(selectedInvitation.id);

      const selectedBand = allBands.find(b => b.id === selectedBandForMember);
      toast({
        title: "Member added!",
        description: `${selectedInvitation.email} has been added to ${selectedBand?.name || 'the band'}.`,
      });

      setShowBandSelectDialog(false);
      setSelectedInvitation(null);
      setSelectedBandForMember("");
    } catch (error: any) {
      console.error("Error adding member:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add member to band.",
      });
    } finally {
      setAddingToBand(false);
    }
  };

  const pendingInvitations = invitations.filter(inv => inv.status === "pending");
  const acceptedInvitations = invitations.filter(inv => inv.status === "accepted");

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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipient-name">Recipient Name</Label>
              <Input
                id="recipient-name"
                type="text"
                placeholder="John Smith"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                disabled={sending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="member@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
              />
            </div>
          </div>
          <Button type="submit" disabled={sending} className="w-full sm:w-auto">
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Send Invitation
          </Button>
        </form>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {acceptedInvitations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Accepted Invitations</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Add these members to your band
                </p>
                {acceptedInvitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-primary/5"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{invite.recipient_name || invite.email}</p>
                      {invite.recipient_name && (
                        <p className="text-xs text-muted-foreground">{invite.email}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Accepted • Waiting to be added to band
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => openBandSelectDialog(invite)}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add to Band
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
            )}

            {pendingInvitations.length > 0 ? (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Pending Invitations</h4>
                {pendingInvitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{invite.recipient_name || invite.email}</p>
                      {invite.recipient_name && (
                        <p className="text-xs text-muted-foreground">{invite.email}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Pending • Expires {new Date(invite.expires_at).toLocaleDateString()}
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
            ) : acceptedInvitations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No pending invitations
              </p>
            ) : null}
          </>
        )}
      </CardContent>

      {/* Band Selection Dialog */}
      <Dialog open={showBandSelectDialog} onOpenChange={setShowBandSelectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Band</DialogTitle>
            <DialogDescription>
              Choose which band to add {selectedInvitation?.email} to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Select Band</Label>
              <Select 
                value={selectedBandForMember} 
                onValueChange={setSelectedBandForMember}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a band" />
                </SelectTrigger>
                <SelectContent>
                  {allBands.map((band) => (
                    <SelectItem key={band.id} value={band.id}>
                      {band.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowBandSelectDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={addToBandWithSelection}
                disabled={!selectedBandForMember || addingToBand}
              >
                {addingToBand ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Add to Band
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
