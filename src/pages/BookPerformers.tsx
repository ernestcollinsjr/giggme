import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music, Search, Filter, Sparkles, UserPlus, Eye, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FeaturedEntertainer {
  user_id: string;
  name: string;
  bio: string | null;
  photo_urls: string[] | null;
  performer_category: string | null;
  stage_name: string | null;
  genre: string | null;
  instrument: string | null;
  entertainer_categories: string[] | null;
}

const BookPerformers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entertainers, setEntertainers] = useState<FeaturedEntertainer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [myRosterIds, setMyRosterIds] = useState<Set<string>>(new Set());
  const [bmId, setBmId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [togglingFavId, setTogglingFavId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      // Resolve booking_manager id (self if BM, otherwise parent BM if admin).
      if (user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const roleSet = new Set((roles || []).map((r: any) => r.role));
        let resolvedBmId: string | null = null;
        if (roleSet.has("booking_manager") || roleSet.has("super_admin")) {
          resolvedBmId = user.id;
        } else if (roleSet.has("admin")) {
          const { data: bma } = await supabase
            .from("booking_manager_admins")
            .select("booking_manager_id")
            .eq("admin_user_id", user.id)
            .maybeSingle();
          resolvedBmId = bma?.booking_manager_id ?? null;
        }
        setBmId(resolvedBmId);

        if (resolvedBmId) {
          const { data: existing } = await supabase
            .from("booking_manager_artists")
            .select("artist_id")
            .eq("booking_manager_id", resolvedBmId);
          setMyRosterIds(new Set((existing || []).map((r: any) => r.artist_id)));
        }
      }

      const { data, error } = await supabase.rpc("get_featured_entertainers");
      if (error) {
        toast({ variant: "destructive", title: "Failed to load", description: error.message });
      } else {
        setEntertainers((data as FeaturedEntertainer[]) || []);
      }
      setLoading(false);
    })();
  }, [toast]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    entertainers.forEach((e) => {
      if (e.performer_category) set.add(e.performer_category);
      (e.entertainer_categories || []).forEach((c) => c && set.add(c));
    });
    return Array.from(set).sort();
  }, [entertainers]);

  const filtered = entertainers.filter((e) => {
    const q = searchTerm.trim().toLowerCase();
    const hay = [
      e.name,
      e.stage_name,
      e.genre,
      e.instrument,
      e.performer_category,
      ...(e.entertainer_categories || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !q || hay.includes(q);
    const matchesCat =
      selectedCategory === "all" ||
      e.performer_category === selectedCategory ||
      (e.entertainer_categories || []).includes(selectedCategory);
    return matchesSearch && matchesCat;
  });

  const addToRoster = async (artistId: string) => {
    if (!bmId) {
      toast({ variant: "destructive", title: "Not allowed", description: "Only booking managers can add to a roster." });
      return;
    }
    setAddingId(artistId);
    const { error } = await supabase
      .from("booking_manager_artists")
      .insert({ booking_manager_id: bmId, artist_id: artistId });
    if (error && !error.message.includes("duplicate")) {
      toast({ variant: "destructive", title: "Failed to add", description: error.message });
    } else {
      setMyRosterIds((prev) => new Set(prev).add(artistId));
      toast({ title: "Added to your roster" });
    }
    setAddingId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <Badge variant="secondary" className="uppercase tracking-wide text-[10px]">Featured Talent</Badge>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Book Performers
          </h1>
          <p className="text-muted-foreground mb-6">
            Book entertainers from your preferred list and track responses.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Search by name, genre, or instrument..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Loading performers...</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-2">No featured performers found</p>
              <p className="text-xs text-muted-foreground">Subscribed entertainers will appear here as they join.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((e) => {
              const inRoster = myRosterIds.has(e.user_id);
              return (
                <Card key={e.user_id} className="relative hover:shadow-lg transition-shadow">
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarImage src={e.photo_urls?.[0]} />
                        <AvatarFallback className="text-xs">{e.name?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm truncate">{e.stage_name || e.name}</CardTitle>
                        {e.stage_name && (
                          <p className="text-xs text-muted-foreground truncate">{e.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {e.performer_category && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{e.performer_category}</Badge>
                      )}
                      {e.genre && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          <Music className="h-2.5 w-2.5 mr-0.5" />
                          {e.genre}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    {e.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{e.bio}</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-7"
                      onClick={() => navigate(`/artist-profile/${e.user_id}`)}
                    >
                      <Eye className="h-3 w-3 mr-1" /> View Profile
                    </Button>
                    {bmId && (
                      <Button
                        size="sm"
                        className="w-full text-xs h-7"
                        disabled={inRoster || addingId === e.user_id}
                        onClick={() => addToRoster(e.user_id)}
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        {inRoster ? "On Roster" : addingId === e.user_id ? "Adding..." : "Add to Roster"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    </div>
  );
};

export default BookPerformers;
