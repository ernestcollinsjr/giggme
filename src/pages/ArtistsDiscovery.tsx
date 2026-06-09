import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Music, MapPin, Calendar, DollarSign, Youtube, Search, Filter, Users, X, Send, Sparkles, Eye, MessageCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { normalizeRole } from "@/lib/roles";

interface ArtistWithProfile {
  id: string;
  user_id: string;
  stage_name: string | null;
  genre: string | null;
  genres?: string[] | null;
  instrument?: string | null;
  performer_category?: string | null;
  entertainer_categories?: string[] | null;
  years_experience: number | null;
  availability: string | null;
  rate_range: string | null;
  youtube_videos: Array<{ url: string; title: string }>;
  venues?: string[];
  is_pending?: boolean;
  email?: string | null;
  expires_at?: string | null;
  profile: {
    name: string;
    bio: string | null;
    photo_urls: string[];
  };
}

const ArtistsDiscovery = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [artists, setArtists] = useState<ArtistWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Group cover request
  const [canManageRoster, setCanManageRoster] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [coverVenue, setCoverVenue] = useState("");
  const [coverDate, setCoverDate] = useState("");
  const [coverTime, setCoverTime] = useState("");
  const [coverMessage, setCoverMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (data || []).map((r: any) => normalizeRole(r.role));
      setCanManageRoster(roles.some((r) => r === "booking_manager" || r === "admin" || r === "super_admin"));
    })();
  }, []);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleSendGroupRequest = async () => {
    if (selectedIds.size === 0 || !coverMessage.trim()) {
      toast({ variant: "destructive", title: "Message required", description: "Add a message and select at least one performer." });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-replacement-request", {
        body: {
          performer_ids: Array.from(selectedIds),
          message: coverMessage.trim(),
          venue: coverVenue.trim() || null,
          event_date: coverDate || null,
          event_time: coverTime || null,
        },
      });
      if (error) throw error;
      toast({
        title: "Cover request sent",
        description: `Sent to ${data?.recipients ?? selectedIds.size} performer(s). They have 30 minutes to respond.`,
      });
      setDialogOpen(false);
      setCoverMessage(""); setCoverVenue(""); setCoverDate(""); setCoverTime("");
      exitSelectionMode();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to send", description: e.message });
    } finally {
      setSending(false);
    }
  };


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
        (supabase as any).rpc("get_my_performers"),
        (supabase as any).rpc("get_performer_venues"),
      ]);

      if (error) throw error;

      const venuesMap = new Map<string, string[]>();
      (venuesData || []).forEach((row: any) => {
        venuesMap.set(row.user_id, row.venues || []);
      });

      const userIds = (data || []).map((p: any) => p.user_id).filter(Boolean);
      let categoriesMap = new Map<string, string[]>();
      if (userIds.length > 0) {
        const { data: catRows } = await supabase
          .from("profiles")
          .select("id, entertainer_categories")
          .in("id", userIds);
        (catRows || []).forEach((row: any) => {
          categoriesMap.set(row.id, row.entertainer_categories || []);
        });
      }

      const combined = (data || []).map((performer: any) => ({
        id: performer.user_id,
        user_id: performer.user_id,
        stage_name: performer.stage_name || null,
        genre: performer.genre || performer.genres?.[0] || performer.instrument || null,
        genres: performer.genres || [],
        instrument: performer.instrument || null,
        performer_category: performer.performer_category || null,
        entertainer_categories: categoriesMap.get(performer.user_id) || null,
        years_experience: performer.years_experience ?? null,
        availability: performer.availability || null,
        rate_range: performer.rate_range || (
          performer.preferred_pay
            ? `$${performer.preferred_pay}${performer.preferred_pay_hours ? ` / ${performer.preferred_pay_hours}hr` : ""}`
            : null
        ),
        youtube_videos: performer.youtube_videos || [],
        venues: venuesMap.get(performer.user_id) || [],
        is_pending: !!performer.is_pending,
        email: performer.email || null,
        expires_at: performer.expires_at || null,
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
    const searchLower = searchTerm.trim().toLowerCase();
    const haystack = [
      artist.profile.name,
      artist.stage_name,
      artist.genre,
      artist.instrument,
      artist.performer_category,
      ...(artist.genres || []),
      ...(artist.venues || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    let matchesSearch = !searchLower || haystack.includes(searchLower);

    // Fuzzy fallback: also match if the search term overlaps any meaningful
    // word in the haystack (e.g. "Donatellos" should still find "Donatello").
    if (!matchesSearch && searchLower.length >= 4) {
      const tokens = haystack.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
      matchesSearch = tokens.some(
        (t) => searchLower.includes(t) || t.includes(searchLower.slice(0, Math.max(4, searchLower.length - 2)))
      );
    }

    const matchesGenre = selectedGenre === "all" || artist.genre === selectedGenre;

    return matchesSearch && matchesGenre;
  });

  // Suggestions for autocomplete (show when typing and has results)
  const suggestions = useMemo(() => {
    if (!searchTerm || searchTerm.length < 1) return [];
    return filteredArtists.slice(0, 6); // Limit to 6 suggestions
  }, [searchTerm, filteredArtists]);

  const handleSelectArtist = (artist: ArtistWithProfile) => {
    setShowSuggestions(false);
    navigate(`/artist-profile/${artist.user_id}`);
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
            My Roster
          </h1>
          <p className="text-muted-foreground mb-6">
            Browse and manage the performers on your roster
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md" ref={searchContainerRef}>
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Search by name, genre, or venue..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (suggestions.length > 0) {
                      handleSelectArtist(suggestions[0]);
                    } else if (filteredArtists.length > 0) {
                      handleSelectArtist(filteredArtists[0]);
                    }
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

            {canManageRoster && (
              selectionMode ? (
                <Button variant="outline" onClick={exitSelectionMode}>
                  <X className="h-4 w-4 mr-2" /> Cancel ({selectedIds.size})
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setSelectionMode(true)}>
                  <Users className="h-4 w-4 mr-2" /> Find Replacement
                </Button>
              )
            )}
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
            {filteredArtists.map((artist) => {
              const isSelectable = selectionMode && !artist.is_pending;
              const isSelected = selectedIds.has(artist.user_id);
              return (
              <Card
                key={artist.id}
                onClick={isSelectable ? () => toggleSelected(artist.user_id) : undefined}
                className={`relative hover:shadow-lg transition-shadow ${artist.is_pending ? "opacity-90 border-dashed" : ""} ${isSelectable ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-primary" : ""}`}
              >
                {selectionMode && !artist.is_pending && (
                  <div
                    className="absolute top-2 right-2 z-10 bg-background rounded p-0.5 shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelected(artist.user_id)}
                    />
                  </div>
                )}
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarImage src={artist.profile.photo_urls?.[0]} />
                      <AvatarFallback className="text-xs">{artist.profile.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm truncate">{artist.stage_name || artist.profile.name}</CardTitle>
                      {artist.is_pending && artist.email ? (
                        <p className="text-xs text-muted-foreground truncate">{artist.email}</p>
                      ) : artist.stage_name ? (
                        <p className="text-xs text-muted-foreground truncate">{artist.profile.name}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {artist.is_pending && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 w-fit border-amber-500 text-amber-600">
                        Invited
                      </Badge>
                    )}
                    {artist.entertainer_categories && artist.entertainer_categories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {artist.entertainer_categories.map((cat) => (
                          <Badge key={cat} variant="secondary" className="text-[10px] px-1.5 py-0 w-fit">
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
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

                  {artist.is_pending ? (
                    <div className="mt-2 space-y-0.5">
                      <p className="text-[11px] text-muted-foreground italic">
                        Awaiting invitation acceptance
                      </p>
                      {artist.expires_at && (
                        <p className="text-[10px] text-amber-600">
                          Expires {new Date(artist.expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-2 w-full justify-center"
                          onClick={(e) => { e.stopPropagation(); navigate(`/artist-profile/${artist.user_id}`); }}
                        >
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-2 w-full inline-flex items-center justify-center gap-1"
                          onClick={(e) => { e.stopPropagation(); navigate(`/messages?conversation=${artist.user_id}`); }}
                        >
                          <MessageCircle className="h-3 w-3 shrink-0" />
                          <span>Msg</span>
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        className="text-xs h-7 px-2 w-full justify-center"
                        onClick={(e) => { e.stopPropagation(); navigate(`/artist-profile/${artist.user_id}`); }}
                      >
                        <Calendar className="h-3 w-3 mr-1" /> Book
                      </Button>
                    </>
                  )}

                </CardContent>
              </Card>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </div>
      </div>

      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-background border shadow-lg rounded-full px-4 py-2 flex items-center gap-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Send Group Message
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-black/60 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>Send Cover Request</DialogTitle>
            <DialogDescription>
              Group message to {selectedIds.size} performer(s). Each has 30 minutes to accept or decline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cover-venue">Venue (optional)</Label>
              <Input id="cover-venue" value={coverVenue} onChange={(e) => setCoverVenue(e.target.value)} placeholder="e.g. The Blue Note" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="cover-date">Date</Label>
                <Input id="cover-date" type="date" value={coverDate} onChange={(e) => setCoverDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cover-time">Time</Label>
                <Input id="cover-time" type="time" value={coverTime} onChange={(e) => setCoverTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cover-msg">Message *</Label>
              <Textarea
                id="cover-msg"
                rows={4}
                value={coverMessage}
                onChange={(e) => setCoverMessage(e.target.value)}
                placeholder="Performer cancelled — need a cover. Pay is $X. Reply ASAP."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={sending}>Cancel</Button>
            <Button onClick={handleSendGroupRequest} disabled={sending || !coverMessage.trim()}>
              {sending ? "Sending..." : `Send to ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default ArtistsDiscovery;
