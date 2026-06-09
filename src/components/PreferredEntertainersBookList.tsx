import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Music, Users, Heart } from "lucide-react";

interface Entertainer {
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
  const [entertainers, setEntertainers] = useState<Entertainer[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const { data: favRows } = await supabase
            .from("favorite_performers")
            .select("performer_id")
            .eq("user_id", user.id);
          setFavoriteIds(new Set((favRows || []).map((r: any) => r.performer_id)));
        }
        const { data, error } = await supabase.rpc("get_public_performers");
        if (error) throw error;
        const rows: Entertainer[] = (data || []).map((r: any) => ({
          user_id: r.user_id,
          name: r.name,
          stage_name: r.stage_name,
          genre: r.genre,
          photo_urls: r.photo_urls,
        }));
        setEntertainers(rows);
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error loading entertainers", description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const toggleFavorite = async (performerId: string) => {
    if (!userId) {
      toast({ variant: "destructive", title: "Sign in required" });
      return;
    }
    setTogglingId(performerId);
    const isFav = favoriteIds.has(performerId);
    if (isFav) {
      const { error } = await supabase
        .from("favorite_performers")
        .delete()
        .eq("user_id", userId)
        .eq("performer_id", performerId);
      if (error) {
        toast({ variant: "destructive", title: "Failed", description: error.message });
      } else {
        setFavoriteIds((prev) => {
          const n = new Set(prev);
          n.delete(performerId);
          return n;
        });
      }
    } else {
      const { error } = await supabase
        .from("favorite_performers")
        .insert({ user_id: userId, performer_id: performerId });
      if (error && !error.message.includes("duplicate")) {
        toast({ variant: "destructive", title: "Failed", description: error.message });
      } else {
        setFavoriteIds((prev) => new Set(prev).add(performerId));
        toast({ title: "Added to favorites" });
      }
    }
    setTogglingId(null);
  };

  const handleBook = (id: string) => {
    navigate(`/artist-profile/${id}`);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading entertainers...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Book Entertainers</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/entertainers")}>
          Browse all
        </Button>
      </div>

      {entertainers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center space-y-3">
            <Music className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No entertainers available yet.</p>
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
    </div>
  );
};
