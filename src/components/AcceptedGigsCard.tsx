import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Calendar, MapPin, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AcceptedGig {
  id: string;
  isOwned: boolean;
  location_sharing_enabled: boolean;
  gig: {
    id: string;
    date: string;
    venue: string;
    notes: string | null;
    loading_time: string | null;
    sound_check_time: string | null;
  };
}

interface AcceptedGigsCardProps {
  userId: string;
}

export const AcceptedGigsCard = ({ userId }: AcceptedGigsCardProps) => {
  const [acceptedGigs, setAcceptedGigs] = useState<AcceptedGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;
    fetchAcceptedGigs();
  }, [userId]);

  const fetchAcceptedGigs = async () => {
    try {
      setErrorMessage(null);
      const [membersRes, ownedRes] = await Promise.all([
        supabase
          .from("gig_members")
          .select(`
            id,
            location_sharing_enabled,
            gigs!inner (
              id,
              date,
              venue,
              notes,
              loading_time,
              sound_check_time
            )
          `)
          .eq("member_id", userId)
          .eq("status", "accepted"),
        supabase
          .from("gigs")
          .select("id, date, venue, notes, loading_time, sound_check_time")
          .eq("user_id", userId)
          .in("status", ["confirmed"]),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (ownedRes.error) throw ownedRes.error;

      const memberGigs: AcceptedGig[] = (membersRes.data || []).map((item: any) => ({
        id: item.id,
        isOwned: false,
        location_sharing_enabled: item.location_sharing_enabled,
        gig: item.gigs,
      }));

      const ownedGigs: AcceptedGig[] = (ownedRes.data || []).map((g: any) => ({
        id: `owned-${g.id}`,
        isOwned: true,
        location_sharing_enabled: false,
        gig: g,
      }));

      // De-dupe in case the owner is also listed as a member
      const seen = new Set<string>();
      const combined = [...memberGigs, ...ownedGigs].filter((entry) => {
        if (seen.has(entry.gig.id)) return false;
        seen.add(entry.gig.id);
        return true;
      });

      combined.sort(
        (a, b) => new Date(a.gig.date).getTime() - new Date(b.gig.date).getTime()
      );

      setAcceptedGigs(combined);
    } catch (error: any) {
      console.error("Error fetching accepted gigs:", error);
      setErrorMessage(error?.message || "Unable to load accepted gigs.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLocationSharing = async (gigMemberId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("gig_members")
        .update({ location_sharing_enabled: !currentValue })
        .eq("id", gigMemberId);

      if (error) throw error;

      setAcceptedGigs(prev =>
        prev.map(gig =>
          gig.id === gigMemberId
            ? { ...gig, location_sharing_enabled: !currentValue }
            : gig
        )
      );

      toast({
        title: !currentValue ? "Location sharing enabled" : "Location sharing disabled",
        description: !currentValue
          ? "Your location will be shared starting 1 hour before the event."
          : "Your location will no longer be shared for this gig.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update location sharing",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <Card className="border-border/50 shadow-lg">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card className="border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Your Accepted Gigs
          </CardTitle>
          <CardDescription className="text-destructive">{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (acceptedGigs.length === 0) {
    return (
      <Card className="border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Your Accepted Gigs
          </CardTitle>
          <CardDescription>No accepted gigs are assigned to this account yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Your Accepted Gigs
        </CardTitle>
        <CardDescription>
          Enable location sharing to help the group leader coordinate arrival times
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {acceptedGigs.map((gig) => (
            <div key={gig.id} className="p-4 border rounded-lg bg-background">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(gig.gig.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <h4 className="font-semibold">{gig.gig.venue}</h4>
                  {gig.gig.notes && (
                    <p className="text-sm text-muted-foreground mt-1">{gig.gig.notes}</p>
                  )}
                  {(gig.gig.loading_time || gig.gig.sound_check_time) && (
                    <div className="flex gap-2 mt-2">
                      {gig.gig.loading_time && (
                        <Badge variant="outline" className="text-xs">
                          Load: {gig.gig.loading_time}
                        </Badge>
                      )}
                      {gig.gig.sound_check_time && (
                        <Badge variant="outline" className="text-xs">
                          Sound: {gig.gig.sound_check_time}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`location-${gig.id}`}
                    checked={gig.location_sharing_enabled}
                    onCheckedChange={() =>
                      handleToggleLocationSharing(gig.id, gig.location_sharing_enabled)
                    }
                  />
                  <Label htmlFor={`location-${gig.id}`} className="text-sm cursor-pointer">
                    Share Location
                  </Label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
