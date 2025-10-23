import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Users, Copy, Check } from "lucide-react";
import { format } from "date-fns";

interface Tour {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface CrewMember {
  id: string;
  crew_member_id: string;
  status: string;
  role_title: string | null;
  profiles: {
    name: string;
    email: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  invite_token: string;
  created_at: string;
}

export default function TourDetail() {
  const { tourId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tour, setTour] = useState<Tour | null>(null);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setAuthReady(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthReady(!!session);
      if (session && tourId) {
        fetchTourData();
      }
    });
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (tourId && authReady) {
      fetchTourData();
    }
  }, [tourId, authReady]);

  const fetchTourData = async () => {
    try {
      const [tourResult, crewResult, invitesResult] = await Promise.all([
        supabase.from("tours").select("*").eq("id", tourId).maybeSingle(),
        supabase
          .from("tour_crew_members")
          .select(`
            *,
            profiles(name, email)
          `)
          .eq("tour_id", tourId),
        supabase
          .from("tour_invitations")
          .select("*")
          .eq("tour_id", tourId)
          .eq("status", "pending")
      ]);

      if (tourResult.error) throw tourResult.error;
      setTour(tourResult.data);
      setCrewMembers((crewResult.data || []) as any);
      setInvitations(invitesResult.data || []);
    } catch (error) {
      console.error("Error fetching tour data:", error);
      toast({
        title: "Error",
        description: "Failed to load tour details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !tourId || !tour) return;

    try {
      const inviteToken = crypto.randomUUID();
      
      const { error } = await supabase
        .from("tour_invitations")
        .insert({
          tour_id: tourId,
          tour_manager_id: user.id,
          email: inviteEmail,
          invite_token: inviteToken
        });

      if (error) throw error;

      // Get user profile for manager name
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      // Send invitation email
      const { error: emailError } = await supabase.functions.invoke("send-tour-invite", {
        body: {
          recipientEmail: inviteEmail,
          tourName: tour.name,
          inviteToken: inviteToken,
          tourManagerName: profile?.name || "Tour Manager"
        }
      });

      if (emailError) {
        console.error("Error sending invitation email:", emailError);
        toast({
          title: "Invitation Created",
          description: `Invitation created for ${inviteEmail}, but email sending failed. You can copy and share the link below.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Invitation Sent",
          description: `Invitation email sent to ${inviteEmail}`
        });
      }

      setDialogOpen(false);
      setInviteEmail("");
      fetchTourData();
    } catch (error) {
      console.error("Error sending invite:", error);
      toast({
        title: "Error",
        description: "Failed to create invitation",
        variant: "destructive"
      });
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/tour-invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast({
      title: "Link Copied",
      description: "Invitation link copied to clipboard"
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="container mx-auto p-6">
        <p>Tour not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Button variant="ghost" onClick={() => navigate("/tours")} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Tours
      </Button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{tour.name}</h1>
          {tour.description && (
            <p className="text-muted-foreground">{tour.description}</p>
          )}
          {tour.start_date && (
            <p className="text-sm text-muted-foreground mt-2">
              {format(new Date(tour.start_date), "MMM d, yyyy")}
              {tour.end_date && ` - ${format(new Date(tour.end_date), "MMM d, yyyy")}`}
            </p>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Mail className="mr-2 h-4 w-4" />
              Invite Crew Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Crew Member</DialogTitle>
              <DialogDescription>
                Enter the email address of the crew member you want to invite
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="crew@example.com"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Invite Link</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Crew Members ({crewMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {crewMembers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No crew members yet. Send invitations to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {crewMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{member.profiles.name}</p>
                      <p className="text-sm text-muted-foreground">{member.profiles.email}</p>
                      {member.role_title && (
                        <p className="text-xs text-muted-foreground mt-1">{member.role_title}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      member.status === 'accepted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {member.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invitations ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No pending invitations
              </p>
            ) : (
              <div className="space-y-3">
                {invitations.map((invite) => (
                  <div key={invite.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{invite.email}</p>
                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => copyInviteLink(invite.invite_token)}
                    >
                      {copiedToken === invite.invite_token ? (
                        <>
                          <Check className="mr-2 h-3 w-3" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-3 w-3" />
                          Copy Invite Link
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
