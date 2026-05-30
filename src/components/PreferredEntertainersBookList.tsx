import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Music, Users } from "lucide-react";
import { CreateBookingDialog } from "@/components/venue/CreateBookingDialog";

interface PreferredEntertainer {
  user_id: string;
  name: string | null;
  stage_name: string | null;
  genre: string | null;
  photo_urls: string[] | null;
}

export const PreferredEntertainersBookList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [entertainers, setEntertainers] = useState<PreferredEntertainer[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;

        const { data: venue } = await supabase
          .from("venues")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (!venue) {
          setLoading(false);
          return;
        }
        setVenueId(venue.id);

        const { data: prefs } = await supabase
          .from("venue_preferred_entertainers")
          .select("entertainer_id")
          .eq("venue_id", venue.id);

        const ids = (prefs || []).map((p) => p.entertainer_id);
        if (ids.length === 0) {
          setEntertainers([]);
          setLoading(false);
          return;
        }

        const [{ data: profiles }, { data: artists }] = await Promise.all([
          supabase.from("profiles").select("id, name, photo_urls").in("id", ids),
          supabase.from("artist_profiles").select("user_id, stage_name, genre").in("user_id", ids),
        ]);

        const artistMap = new Map((artists || []).map((a) => [a.user_id, a]));
        const merged: PreferredEntertainer[] = (profiles || []).map((p) => {
          const a = artistMap.get(p.id);
          return {
            user_id: p.id,
            name: p.name,
            photo_urls: p.photo_urls,
            stage_name: a?.stage_name ?? null,
            genre: a?.genre ?? null,
          };
        });
        setEntertainers(merged);
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const handleBook = (id: string) => {
    setSelectedId(id);
    setShowDialog(true);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading your preferred entertainers...</div>;
  }

  if (!venueId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Set up your venue to start booking entertainers.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Your Preferred Entertainers</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/entertainers")}>
          Browse all
        </Button>
      </div>

      {entertainers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center space-y-3">
            <Music className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              You haven't added any preferred entertainers yet.
            </p>
            <Button size="sm" onClick={() => navigate("/entertainers")}>
              Find Entertainment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {entertainers.map((e) => (
            <Card key={e.user_id} className="border-border/50 overflow-hidden hover:border-primary/30 transition-colors">
              <div className="relative aspect-square bg-gradient-to-br from-primary/20 to-secondary/20">
                {e.photo_urls?.[0] ? (
                  <img
                    src={e.photo_urls[0]}
                    alt={e.name || "Entertainer"}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <h3 className="font-semibold text-sm truncate">
                  {e.stage_name || e.name || "Unknown"}
                </h3>
                {e.genre && (
                  <p className="text-xs text-muted-foreground truncate mb-2">{e.genre}</p>
                )}
                <Button
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => handleBook(e.user_id)}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Book
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {venueId && (
        <CreateBookingDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          venueId={venueId}
          preSelectedEntertainerId={selectedId}
          onSuccess={() => {
            setShowDialog(false);
            toast({
              title: "Booking Request Sent",
              description: "The entertainer will be notified and can accept or decline.",
            });
          }}
        />
      )}
    </div>
  );
};
