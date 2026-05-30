import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Music, 
  Heart,
  Calendar,
  Filter,
  ArrowLeft
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateBookingDialog } from "@/components/venue/CreateBookingDialog";

interface Entertainer {
  id: string;
  user_id: string;
  stage_name: string | null;
  genre: string | null;
  availability: string | null;
  rate_range: string | null;
  years_experience: number | null;
  profile?: {
    name: string;
    photo_urls: string[];
    bio: string | null;
  };
  isPreferred?: boolean;
}

const EntertainerMarketplace = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entertainers, setEntertainers] = useState<Entertainer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [venueId, setVenueId] = useState<string | null>(null);
  const [preferredIds, setPreferredIds] = useState<Set<string>>(new Set());
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [selectedEntertainerId, setSelectedEntertainerId] = useState<string | null>(null);

  const genres = ["Jazz", "Rock", "Pop", "Country", "Blues", "R&B", "Classical", "Folk", "Hip Hop", "Electronic"];

  useEffect(() => {
    fetchEntertainers();
  }, []);

  const fetchEntertainers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      
      // Fetch venue for this owner
      if (user) {
        const { data: venueData } = await supabase
          .from("venues")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();
        
        if (venueData) {
          setVenueId(venueData.id);
          
          // Fetch preferred entertainers
          const { data: preferredData } = await supabase
            .from("venue_preferred_entertainers")
            .select("entertainer_id")
            .eq("venue_id", venueData.id);
          
          if (preferredData) {
            setPreferredIds(new Set(preferredData.map(p => p.entertainer_id)));
          }
        }
      }

      // Fetch all artist profiles
      const { data: artistData } = await supabase
        .from("artist_profiles")
        .select("*");

      if (artistData) {
        // Fetch profiles separately
        const userIds = artistData.map(a => a.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, photo_urls, bio")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enriched = artistData.map(a => ({
          ...a,
          profile: profileMap.get(a.user_id),
          isPreferred: preferredIds.has(a.user_id)
        }));

        setEntertainers(enriched as Entertainer[]);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePreferred = async (entertainerId: string) => {
    if (!venueId) {
      toast({
        variant: "destructive",
        title: "Setup Required",
        description: "Please set up your venue first.",
      });
      return;
    }

    const isCurrentlyPreferred = preferredIds.has(entertainerId);

    try {
      if (isCurrentlyPreferred) {
        await supabase
          .from("venue_preferred_entertainers")
          .delete()
          .eq("venue_id", venueId)
          .eq("entertainer_id", entertainerId);
        
        setPreferredIds(prev => {
          const next = new Set(prev);
          next.delete(entertainerId);
          return next;
        });
        
        toast({
          title: "Removed from favorites",
          description: "Entertainer removed from your preferred list.",
        });
      } else {
        await supabase
          .from("venue_preferred_entertainers")
          .insert({
            venue_id: venueId,
            entertainer_id: entertainerId,
          });
        
        setPreferredIds(prev => new Set([...prev, entertainerId]));
        
        toast({
          title: "Added to favorites",
          description: "Entertainer added to your preferred list.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleBook = (entertainerId: string) => {
    setSelectedEntertainerId(entertainerId);
    setShowBookingDialog(true);
  };

  const filteredEntertainers = entertainers.filter(e => {
    const matchesSearch = 
      (e.profile?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       e.stage_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       e.genre?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesGenre = genreFilter === "all" || e.genre?.toLowerCase() === genreFilter.toLowerCase();
    
    return matchesSearch && matchesGenre;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading entertainers...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav userRole="booking_manager" />
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold mb-2">Find Entertainment</h1>
          <p className="text-muted-foreground">
            Browse talented performers and add them to your venue's preferred list
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, stage name, or genre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={genreFilter} onValueChange={setGenreFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              {genres.map(genre => (
                <SelectItem key={genre} value={genre.toLowerCase()}>{genre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Entertainers Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredEntertainers.length === 0 ? (
            <Card className="col-span-full border-dashed">
              <CardContent className="py-12 text-center">
                <Music className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Entertainers Found</h3>
                <p className="text-muted-foreground text-sm">
                  Try adjusting your search or filters
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredEntertainers.map((entertainer) => (
              <Card key={entertainer.id} className="border-border/50 overflow-hidden hover:border-primary/30 transition-colors">
                <div className="relative aspect-square bg-gradient-to-br from-primary/20 to-secondary/20">
                  {entertainer.profile?.photo_urls?.[0] ? (
                    <img 
                      src={entertainer.profile.photo_urls[0]}
                      alt={entertainer.profile.name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <button
                    onClick={() => togglePreferred(entertainer.user_id)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                  >
                    {preferredIds.has(entertainer.user_id) ? (
                      <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                    ) : (
                      <Heart className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-sm truncate">
                    {entertainer.stage_name || entertainer.profile?.name || "Unknown"}
                  </h3>
                  {entertainer.genre && (
                    <p className="text-xs text-muted-foreground truncate mb-2">{entertainer.genre}</p>
                  )}
                  <Button 
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={() => handleBook(entertainer.user_id)}
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Book
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

      </main>

      {venueId && (
        <CreateBookingDialog 
          open={showBookingDialog}
          onOpenChange={setShowBookingDialog}
          venueId={venueId}
          preSelectedEntertainerId={selectedEntertainerId}
          onSuccess={() => {
            setShowBookingDialog(false);
            toast({
              title: "Booking Request Sent",
              description: "The entertainer will be notified and can accept or decline.",
            });
          }}
        />
      )}
      
      <BottomNav />
    </div>
  );
};

export default EntertainerMarketplace;
