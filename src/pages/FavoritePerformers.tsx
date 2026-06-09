import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Eye, Star, MessageCircle, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FavRow {
  performer_id: string;
  profile: {
    id: string;
    name: string | null;
    photo_urls: string[] | null;
    performer_category: string | null;
    instrument: string | null;
    instrument_custom: string | null;
    is_singer: boolean | null;
    entertainer_categories: string[] | null;
  } | null;
  artist: { stage_name: string | null; genre: string | null } | null;
}

const FavoritePerformers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [favs, setFavs] = useState<FavRow[]>([]);
  

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data: rows, error } = await supabase
      .from("favorite_performers")
      .select("performer_id")
      .eq("user_id", user.id);
    if (error) {
      toast({ variant: "destructive", title: "Failed to load", description: error.message });
      setLoading(false);
      return;
    }
    const ids = (rows || []).map((r) => r.performer_id);
    if (ids.length === 0) {
      setFavs([]);
      setLoading(false);
      return;
    }
    const [{ data: profiles }, { data: artists }] = await Promise.all([
      supabase.from("profiles").select("id,name,photo_urls,performer_category,instrument,instrument_custom,is_singer,entertainer_categories").in("id", ids),
      supabase.from("artist_profiles").select("user_id,stage_name,genre").in("user_id", ids),
    ]);
    const merged: FavRow[] = ids.map((id) => ({
      performer_id: id,
      profile: (profiles || []).find((p: any) => p.id === id) || null,
      artist: ((artists || []).find((a: any) => a.user_id === id) as any) || null,
    }));
    setFavs(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (performerId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("favorite_performers")
      .delete()
      .eq("user_id", user.id)
      .eq("performer_id", performerId);
    if (error) {
      toast({ variant: "destructive", title: "Failed to remove", description: error.message });
      return;
    }
    setFavs((prev) => prev.filter((f) => f.performer_id !== performerId));
    toast({ title: "Removed from favorites" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-6 w-6 text-primary" />
            <Badge variant="secondary" className="uppercase tracking-wide text-[10px]">Your Shortlist</Badge>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Favorites
          </h1>
          <p className="text-muted-foreground">
            Your preferred performers — quickly review and book from your shortlist.
          </p>
        </div>

        {loading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Loading favorites...</CardContent></Card>
        ) : favs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground mb-2">No favorites yet</p>
              <p className="text-xs text-muted-foreground mb-4">Tap the heart on a performer's card to add them here.</p>
              <Button size="sm" onClick={() => navigate("/book-performers")}>Browse performers</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {favs.map((f) => {
              const p = f.profile;
              const a = f.artist;
              return (
                <Card key={f.performer_id} className="relative hover:shadow-lg transition-shadow">
                  <button
                    onClick={() => remove(f.performer_id)}
                    aria-label="Remove from favorites"
                    className="absolute top-2 right-2 z-10 rounded-full bg-background/80 backdrop-blur p-1.5 border border-border hover:bg-background"
                  >
                    <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                  </button>
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarImage src={p?.photo_urls?.[0]} />
                        <AvatarFallback className="text-xs">{p?.name?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm truncate">{a?.stage_name || p?.name || "Unknown"}</CardTitle>
                        {a?.stage_name && p?.name && (
                          <p className="text-xs text-muted-foreground truncate">{p.name}</p>
                        )}
                      </div>
                    </div>
                    {p?.entertainer_categories && p.entertainer_categories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.entertainer_categories.map((cat) => (
                          <Badge key={cat} variant="outline" className="text-[10px] px-1.5 py-0">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    )}

                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">

                    <div className="grid grid-cols-3 gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2 w-full justify-center"
                        onClick={() => navigate(`/artist-profile/${f.performer_id}`)}
                      >
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs h-7 px-2 w-full justify-center"
                        onClick={() => navigate(`/artist-profile/${f.performer_id}`)}
                      >
                        <Calendar className="h-3 w-3 mr-1" /> Book
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2 w-full inline-flex items-center justify-center gap-1"
                        onClick={() => navigate(`/messages?conversation=${f.performer_id}`)}
                      >
                        <MessageCircle className="h-3 w-3 shrink-0" />
                        <span>Msg</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritePerformers;
