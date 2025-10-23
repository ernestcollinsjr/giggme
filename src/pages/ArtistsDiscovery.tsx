import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, MapPin, Calendar, DollarSign, Youtube, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ArtistWithProfile {
  id: string;
  stage_name: string | null;
  genre: string | null;
  years_experience: number | null;
  availability: string | null;
  rate_range: string | null;
  youtube_videos: Array<{ url: string; title: string }>;
  profile: {
    name: string;
    bio: string | null;
    photo_urls: string[];
  };
}

const ArtistsDiscovery = () => {
  const navigate = useNavigate();
  const [artists, setArtists] = useState<ArtistWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchArtists();
  }, []);

  const fetchArtists = async () => {
    try {
      const { data, error } = await supabase
        .from("artist_profiles")
        .select(`
          *,
          profile:profiles!artist_profiles_user_id_fkey (
            name,
            bio,
            photo_urls
          )
        `);

      if (error) throw error;
      setArtists(data as any);
    } catch (error: any) {
      console.error("Error fetching artists:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredArtists = artists.filter((artist) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      artist.profile.name.toLowerCase().includes(searchLower) ||
      artist.stage_name?.toLowerCase().includes(searchLower) ||
      artist.genre?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading artists...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Discover Artists & Musicians
          </h1>
          <p className="text-muted-foreground mb-6">
            Find talented artists and musicians for your next event
          </p>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, stage name, or genre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredArtists.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No artists found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArtists.map((artist) => (
              <Card key={artist.id} className="hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={artist.profile.photo_urls?.[0]} />
                      <AvatarFallback>{artist.profile.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle>{artist.stage_name || artist.profile.name}</CardTitle>
                      {artist.stage_name && (
                        <p className="text-sm text-muted-foreground">{artist.profile.name}</p>
                      )}
                      {artist.genre && (
                        <Badge variant="secondary" className="mt-2">
                          <Music className="h-3 w-3 mr-1" />
                          {artist.genre}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="line-clamp-3">
                    {artist.profile.bio || "No bio available"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {artist.years_experience && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{artist.years_experience} years experience</span>
                    </div>
                  )}

                  {artist.availability && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{artist.availability}</span>
                    </div>
                  )}

                  {artist.rate_range && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>{artist.rate_range}</span>
                    </div>
                  )}

                  {artist.youtube_videos && artist.youtube_videos.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Youtube className="h-4 w-4 text-red-500" />
                      <span>{artist.youtube_videos.length} performance video(s)</span>
                    </div>
                  )}

                  <Button variant="outline" className="w-full mt-4">
                    View Full Profile
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ArtistsDiscovery;
