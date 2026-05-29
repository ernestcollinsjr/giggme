import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Copy, Trash2, UserPlus, RefreshCw, BarChart3, CheckCircle, Clock, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSoundPreference } from "@/hooks/useSoundPreference";

interface Invitation {
  id: string;
  email: string;
  recipient_name: string | null;
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
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
  const { playNotificationSound } = useSoundPreference();
  const [recipientName, setRecipientName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [allBands, setAllBands] = useState<Band[]>([]);
  const [showBandSelectDialog, setShowBandSelectDialog] = useState(false);
  const [selectedBandForMember, setSelectedBandForMember] = useState<string>("");
  const [selectedRoleForMember, setSelectedRoleForMember] = useState<"booking_manager" | "entertainer" | "booking_manager" | "artist" | "entertainer" | "booking_manager">("entertainer");
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [addingToBand, setAddingToBand] = useState(false);
  const [highlightedInvitationId, setHighlightedInvitationId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const previousInvitationsRef = useRef<Invitation[]>([]);

  useEffect(() => {
    fetchInvitations();
    fetchAllBands();

    // Subscribe to real-time changes on band_invitations
    const channel = supabase
      .channel(`band-invitations-${bandId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'band_invitations',
          filter: `band_id=eq.${bandId}`,
        },
        (payload) => {
          console.log('Real-time invitation update:', payload);
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bandId]);

  const handleRealtimeUpdate = async (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    // Fetch updated invitations
    await fetchInvitations();
    
    // Show toast and highlight for status changes
    if (eventType === 'UPDATE' && oldRecord?.status !== newRecord?.status) {
      const name = newRecord.recipient_name || newRecord.email;
      
      if (newRecord.status === 'accepted') {
        // Play notification sound
        playNotificationSound();
        
        toast({
          title: "🎉 Invitation Accepted!",
          description: `${name} has accepted your invitation.`,
        });
        setHighlightedInvitationId(newRecord.id);
        setTimeout(() => setHighlightedInvitationId(null), 3000);
      }
    } else if (eventType === 'INSERT') {
      const name = newRecord.recipient_name || newRecord.email;
      setHighlightedInvitationId(newRecord.id);
      setTimeout(() => setHighlightedInvitationId(null), 3000);
    }
  };

  const fetchAllBands = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
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

    const normalizedEmail = email.toLowerCase().trim();

    // Check if there's already an invitation for this email in this band
    const existingInvite = invitations.find(inv => inv.email.toLowerCase() === normalizedEmail);
    
    if (existingInvite) {
      // If there's an existing invite, resend it instead
      await resendInvitation({
        ...existingInvite,
        recipient_name: recipientName.trim() // Use the new name if provided
      });
      setRecipientName("");
      setEmail("");
      return;
    }

    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      console.log("Creating invitation with:", {
        band_id: bandId,
        email: normalizedEmail,
        invited_by: user.id,
      });

      // Create invitation
      const { data: invitation, error: inviteError } = await supabase
        .from("band_invitations")
        .insert({
          band_id: bandId,
          email: normalizedEmail,
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
          recipientEmail: normalizedEmail,
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
    setSelectedRoleForMember("entertainer"); // Default role
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

      // Set or update the user's role
      // First check if user already has a role
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id, role")
        .eq("user_id", profile.id)
        .single();

      if (existingRole) {
        // Update existing role if different
        if (existingRole.role !== selectedRoleForMember) {
          await supabase
            .from("user_roles")
            .update({ role: selectedRoleForMember })
            .eq("id", existingRole.id);
        }
      } else {
        // Insert new role
        await supabase
          .from("user_roles")
          .insert([{
            user_id: profile.id,
            role: selectedRoleForMember,
          }]);
      }

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
      setSelectedRoleForMember("entertainer");
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

  const resendInvitation = async (invite: Invitation) => {
    setResendingId(invite.id);
    
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      // Delete the old invitation
      await supabase
        .from("band_invitations")
        .delete()
        .eq("id", invite.id);

      // Create new invitation with same details
      const { data: newInvitation, error: inviteError } = await supabase
        .from("band_invitations")
        .insert({
          band_id: bandId,
          email: invite.email,
          recipient_name: invite.recipient_name,
          invited_by: user.id,
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Send email via edge function
      await supabase.functions.invoke("send-band-invite", {
        body: {
          recipientEmail: invite.email,
          recipientName: invite.recipient_name || "",
          bandName: bandName,
          inviteToken: newInvitation.token,
          bandLeaderName: profile?.name || "Band Leader",
        },
      });

      toast({
        title: "Invitation resent!",
        description: `A new invitation has been sent to ${invite.recipient_name || invite.email}`,
      });

      fetchInvitations();
    } catch (error: any) {
      console.error("Error resending invitation:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to resend invitation.",
      });
    } finally {
      setResendingId(null);
    }
  };

  const pendingInvitations = invitations.filter(inv => 
    inv.status === "pending" && new Date(inv.expires_at) > new Date()
  );
  const acceptedInvitations = invitations.filter(inv => inv.status === "accepted");
  const expiredInvitations = invitations.filter(inv => 
    inv.status === "pending" && new Date(inv.expires_at) <= new Date()
  );

  // Calculate statistics
  const totalSent = invitations.length;
  const totalAccepted = acceptedInvitations.length;
  const acceptanceRate = totalSent > 0 ? Math.round((totalAccepted / totalSent) * 100) : 0;
  
  // Calculate average response time for accepted invitations
  const getAverageResponseTime = () => {
    const invitationsWithTimestamp = acceptedInvitations.filter(inv => inv.accepted_at);
    
    if (invitationsWithTimestamp.length === 0) {
      // Fallback for invitations without accepted_at (legacy data)
      if (acceptedInvitations.length === 0) return null;
      return "—";
    }
    
    const totalMs = invitationsWithTimestamp.reduce((sum, inv) => {
      const created = new Date(inv.created_at);
      const accepted = new Date(inv.accepted_at!);
      return sum + (accepted.getTime() - created.getTime());
    }, 0);
    
    const avgMs = totalMs / invitationsWithTimestamp.length;
    const avgHours = avgMs / (1000 * 60 * 60);
    const avgDays = avgHours / 24;
    
    if (avgHours < 1) {
      return `${Math.round(avgMs / (1000 * 60))} min`;
    } else if (avgDays < 1) {
      return `${Math.round(avgHours)} hours`;
    } else {
      return `${avgDays.toFixed(1)} days`;
    }
  };

  const avgResponseTime = getAverageResponseTime();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Group Member</CardTitle>
        <CardDescription>
          Send email invitations to new band members
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invitation Statistics */}
        {totalSent > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <Send className="h-3.5 w-3.5" />
                <span className="text-xs font-medium uppercase tracking-wide">Sent</span>
              </div>
              <p className="text-2xl font-bold">{totalSent}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <CheckCircle className="h-3.5 w-3.5" />
                <span className="text-xs font-medium uppercase tracking-wide">Accepted</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{totalAccepted}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="text-xs font-medium uppercase tracking-wide">Rate</span>
              </div>
              <p className="text-2xl font-bold">{acceptanceRate}%</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs font-medium uppercase tracking-wide">Avg Time</span>
              </div>
              <p className="text-lg font-bold">{avgResponseTime || "—"}</p>
            </div>
          </div>
        )}

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
                    className={`flex items-center justify-between p-3 border rounded-lg bg-primary/5 transition-all duration-500 ${
                      highlightedInvitationId === invite.id 
                        ? 'ring-2 ring-primary ring-offset-2 animate-pulse bg-primary/20' 
                        : ''
                    }`}
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
                    className={`flex items-center justify-between p-3 border rounded-lg transition-all duration-500 ${
                      highlightedInvitationId === invite.id 
                        ? 'ring-2 ring-primary ring-offset-2 animate-pulse bg-primary/10' 
                        : ''
                    }`}
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
            ) : acceptedInvitations.length === 0 && expiredInvitations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No pending invitations
              </p>
            ) : null}

            {expiredInvitations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Expired Invitations</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  These invitations have expired. Click resend to send a new one.
                </p>
                {expiredInvitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 border rounded-lg border-dashed opacity-70"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{invite.recipient_name || invite.email}</p>
                      {invite.recipient_name && (
                        <p className="text-xs text-muted-foreground">{invite.email}</p>
                      )}
                      <p className="text-xs text-destructive">
                        Expired {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resendInvitation(invite)}
                        disabled={resendingId === invite.id}
                      >
                        {resendingId === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-1" />
                        )}
                        Resend
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
          </>
        )}
      </CardContent>

      {/* Band Selection Dialog */}
      <Dialog open={showBandSelectDialog} onOpenChange={setShowBandSelectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to Band</DialogTitle>
            <DialogDescription>
              Choose which band and role for {selectedInvitation?.recipient_name || selectedInvitation?.email}
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
            <div className="space-y-2">
              <Label>Assign Role</Label>
              <Select 
                value={selectedRoleForMember} 
                onValueChange={(value: "booking_manager" | "entertainer" | "booking_manager" | "artist" | "entertainer" | "booking_manager") => setSelectedRoleForMember(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entertainer">Band Member</SelectItem>
                  <SelectItem value="booking_manager">Band Leader</SelectItem>
                  <SelectItem value="artist">Entertainer</SelectItem>
                  <SelectItem value="entertainer">Tour Manager</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                You can change this role later if needed
              </p>
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
