import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle } from "lucide-react";

interface InviteData {
  tour_id: string;
  email: string;
  tours: {
    name: string;
    description: string | null;
  };
}

export default function TourInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    checkInvite();
  }, [token]);

  const checkInvite = async () => {
    try {
      const { data, error } = await supabase
        .from("tour_invitations")
        .select("tour_id, email, tours(name, description)")
        .eq("invite_token", token)
        .eq("status", "pending")
        .single();

      if (error || !data) {
        toast({
          title: "Invalid Invitation",
          description: "This invitation link is invalid or has expired.",
          variant: "destructive"
        });
        navigate("/auth");
        return;
      }

      setInvite(data as InviteData);
    } catch (error) {
      console.error("Error checking invite:", error);
      toast({
        title: "Error",
        description: "Failed to load invitation",
        variant: "destructive"
      });
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!invite || !token) return;

    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in or create an account to accept this invitation.",
        });
        navigate("/auth", { state: { inviteToken: token } });
        return;
      }

      // Add crew member
      const { error: crewError } = await supabase
        .from("tour_crew_members")
        .insert({
          tour_id: invite.tour_id,
          crew_member_id: user.id,
          status: "accepted"
        });

      if (crewError) throw crewError;

      // Update invitation status
      const { error: inviteError } = await supabase
        .from("tour_invitations")
        .update({ status: "accepted" })
        .eq("invite_token", token);

      if (inviteError) throw inviteError;

      toast({
        title: "Success",
        description: `You've joined ${invite.tours.name}!`
      });

      navigate("/dashboard");
    } catch (error) {
      console.error("Error accepting invite:", error);
      toast({
        title: "Error",
        description: "Failed to accept invitation",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!invite) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>Tour Invitation</CardTitle>
          <CardDescription>
            You've been invited to join a tour
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-lg mb-2">{invite.tours.name}</h3>
            {invite.tours.description && (
              <p className="text-muted-foreground">{invite.tours.description}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button 
              className="flex-1" 
              onClick={handleAccept}
              disabled={processing}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {processing ? "Joining..." : "Accept Invitation"}
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => navigate("/auth")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Decline
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            By accepting, you'll be able to view tour details and receive updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
