import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Music } from "lucide-react";

interface BandInvitation {
  id: string;
  band_id: string;
  email: string;
  status: string;
  expires_at: string;
  role: "member" | "entertainer";
  bands: {
    name: string;
    description: string | null;
  };
}

const BandInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<BandInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndFetchInvite = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to accept this invitation.",
        });
        navigate(`/auth?redirect=/band-invite/${token}`);
        return;
      }

      await fetchInvitation();
    };

    checkAuthAndFetchInvite();
  }, [token, navigate, toast]);

  const fetchInvitation = async () => {
    try {
      const { data, error } = await supabase
        .rpc("get_invitation_by_token", { _token: token as string });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError("Invitation not found.");
        return;
      }

      if (row.status === "accepted") {
        setError("This invitation has already been accepted.");
        return;
      }

      if (row.status === "expired" || new Date(row.expires_at) < new Date()) {
        setError("This invitation has expired.");
        return;
      }

      setInvitation({
        id: row.id,
        band_id: row.band_id,
        email: row.email,
        status: row.status,
        expires_at: row.expires_at,
        role: ((row as any).role === "entertainer" ? "entertainer" : "member"),
        bands: { name: row.band_name, description: row.band_description },
      });
    } catch (err: any) {
      console.error("Error fetching invitation:", err);
      setError("Unable to load invitation details.");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!invitation) return;

    setAccepting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      
      if (!user) {
        toast({
          variant: "destructive",
          title: "Not authenticated",
          description: "Please log in to accept this invitation.",
        });
        navigate(`/auth?redirect=/band-invite/${token}`);
        return;
      }

      // Update invitation status with acceptance timestamp
      const { error: updateError } = await supabase
        .from("band_invitations")
        .update({ 
          status: "accepted",
          accepted_at: new Date().toISOString()
        })
        .eq("id", invitation.id);

      if (updateError) throw updateError;

      // Auto-fill the member's band_name on their profile if not already set
      try {
        const bandName = (invitation as any).bands?.name;
        if (bandName) {
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("band_name")
            .eq("id", user.id)
            .maybeSingle();
          if (!existingProfile?.band_name) {
            await supabase
              .from("profiles")
              .update({ band_name: bandName })
              .eq("id", user.id);
          }
        }
      } catch (e) {
        console.error("Failed to set band_name on profile:", e);
      }
      // Assign the role the Booking Manager chose at invite time, and remove
      // any other roles so the invitee can't pick something else.
      try {
        await supabase.from("user_roles").delete().eq("user_id", user.id);
        await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role: invitation.role as any });
      } catch (e) {
        console.error("Failed to assign invited role:", e);
      }


      // Notify band leader via edge function (fire and forget)
      supabase.functions.invoke("notify-invitation-accepted", {
        body: {
          invitationId: invitation.id,
          acceptedByName: user.user_metadata?.name || "",
          acceptedByEmail: user.email || "",
        },
      }).catch((err) => {
        console.error("Failed to send notification to band leader:", err);
      });

      toast({
        title: "Success!",
        description: `You've accepted the invitation to ${invitation.bands.name}! The band leader will assign you to the band.`,
      });

      navigate("/dashboard");
    } catch (err: any) {
      console.error("Error accepting invitation:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to accept invitation. Please try again.",
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Music className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate("/dashboard")} 
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Music className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Group Member</CardTitle>
          <CardDescription>
            You've been invited to join a band
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">{invitation.bands.name}</h3>
            {invitation.bands.description && (
              <p className="text-sm text-muted-foreground">
                {invitation.bands.description}
              </p>
            )}
          </div>
          
          <div className="pt-4 space-y-2">
            <Button 
              onClick={handleAcceptInvitation} 
              disabled={accepting}
              className="w-full"
            >
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                "Accept Invitation"
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate("/dashboard")}
              className="w-full"
            >
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BandInvite;
