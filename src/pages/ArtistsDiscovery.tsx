import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Music, MapPin, Calendar, DollarSign, Youtube, Search, Filter } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface ArtistWithProfile {
  id: string;
  user_id: string;
  stage_name: string | null;
  genre: string | null;
  genres?: string[] | null;
  instrument?: string | null;
  performer_category?: string | null;
  years_experience: number | null;
  availability: string | null;
  rate_range: string | null;
  youtube_videos: Array<{ url: string; title: string }>;
  venues?: string[];
  profile: {
    name: string;
    bio: string | null;
    photo_urls: string[];
  };
}

const ArtistsDiscovery = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [artists, setArtists] = useState<ArtistWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchArtists();
  }, []);

  // Update URL when search term changes
  useEffect(() => {
    if (searchTerm) {
      setSearchParams({ search: searchTerm });
    } else {
      setSearchParams({});
    }
  }, [searchTerm, setSearchParams]);

  const fetchArtists = async () => {
    try {
      const [{ data, error }, { data: venuesData }] = await Promise.all([
        (supabase as any).rpc("get_public_performers"),
        (supabase as any).rpc("get_performer_venues"),
      ]);

      if (error) throw error;

      const venuesMap = new Map<string, string[]>();
      (venuesData || []).forEach((row: any) => {
        venuesMap.set(row.user_id, row.venues || []);
      });

      const combined = (data || []).map((performer: any) => ({
        id: performer.user_id,
        user_id: performer.user_id,
        stage_name: performer.stage_name || null,
        genre: performer.genre || performer.genres?.[0] || performer.instrument || null,
        genres: performer.genres || [],
        instrument: performer.instrument || null,
        performer_category: performer.performer_category || null,
        years_experience: performer.years_experience ?? null,
        availability: performer.availability || null,
        rate_range: performer.rate_range || (
          performer.preferred_pay
            ? `$${performer.preferred_pay}${performer.preferred_pay_hours ? ` / ${performer.preferred_pay_hours}hr` : ""}`
            : null
        ),
        youtube_videos: performer.youtube_videos || [],
        venues: venuesMap.get(performer.user_id) || [],
        profile: {
          name: performer.name || "Unknown",
          bio: performer.bio || null,
          photo_urls: performer.photo_urls || [],
        },
      }));

      setArtists(combined as unknown as ArtistWithProfile[]);
    } catch (error: any) {
      console.error("Error fetching artists:", error);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique genres from artists
  const genres = useMemo(() => {
    const genreSet = new Set<string>();
    artists.forEach((artist) => {
      if (artist.genre) {
        genreSet.add(artist.genre);
      }
    });
    return Array.from(genreSet).sort();
  }, [artists]);

  const filteredArtists = artists.filter((artist) => {
    const searchLower = searchTerm.toLowerCase();
    const genreText = artist.genres?.join(" ").toLowerCase() || "";
    const venueText = artist.venues?.join(" ").toLowerCase() || "";
    const matchesSearch =
      artist.profile.name.toLowerCase().includes(searchLower) ||
      artist.stage_name?.toLowerCase().includes(searchLower) ||
      artist.genre?.toLowerCase().includes(searchLower) ||
      artist.instrument?.toLowerCase().includes(searchLower) ||
      artist.performer_category?.toLowerCase().includes(searchLower) ||
      genreText.includes(searchLower) ||
      venueText.includes(searchLower);
    
    const matchesGenre = selectedGenre === "all" || artist.genre === selectedGenre;
    
    return matchesSearch && matchesGenre;
  });

  // Suggestions for autocomplete (show when typing and has results)
  const suggestions = useMemo(() => {
    if (!searchTerm || searchTerm.length < 1) return [];
    return filteredArtists.slice(0, 6); // Limit to 6 suggestions
  }, [searchTerm, filteredArtists]);

  const handleSelectArtist = (artist: ArtistWithProfile) => {
    setSearchTerm(artist.profile.name);
    setShowSuggestions(false);
  };

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

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md" ref={searchContainerRef}>
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Search by name, stage name, or genre..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setShowSuggestions(false);
                  }
                }}
                className="pl-10"
              />
              
              {/* Autocomplete dropdown */}
              {showSuggestions && searchTerm && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-lg">
                  <Command className="rounded-md">
                    <CommandList>
                      <CommandGroup heading="Suggestions">
                        {suggestions.map((artist) => (
                          <CommandItem
                            key={artist.id}
                            onSelect={() => handleSelectArtist(artist)}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={artist.profile.photo_urls?.[0]} />
                                <AvatarFallback className="text-xs">
                                  {artist.profile.name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{artist.profile.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {artist.genre || "Artist"}
                                </p>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
            
            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {genres.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    {genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredArtists.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No artists found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredArtists.map((artist) => (
              <Card key={artist.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarImage src={artist.profile.photo_urls?.[0]} />
                      <AvatarFallback className="text-xs">{artist.profile.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm truncate">{artist.stage_name || artist.profile.name}</CardTitle>
                      {artist.stage_name && (
                        <p className="text-xs text-muted-foreground truncate">{artist.profile.name}</p>
                      )}
                    </div>
                  </div>
                  {artist.genre && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-fit">
                      <Music className="h-2.5 w-2.5 mr-0.5" />
                      {artist.genre}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-1">
                  {artist.years_experience && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{artist.years_experience}yr exp</span>
                    </div>
                  )}

                  {artist.rate_range && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      <span className="truncate">{artist.rate_range}</span>
                    </div>
                  )}

                  {artist.youtube_videos && artist.youtube_videos.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Youtube className="h-3 w-3 text-red-500" />
                      <span>{artist.youtube_videos.length} video(s)</span>
                    </div>
                  )}

                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full mt-2 text-xs h-7"
                    onClick={() => navigate(`/artist-profile/${artist.user_id}`)}
                  >
                    View Profile
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
