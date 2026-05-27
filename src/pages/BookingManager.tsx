import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BookingManagerClientLocations } from "@/components/BookingManagerClientLocations";
import { UpcomingGigLocationTracker } from "@/components/UpcomingGigLocationTracker";

import { AvailabilityRequestManager } from "@/components/AvailabilityRequestManager";
import { AvailabilityRequestResults } from "@/components/AvailabilityRequestResults";
import { useToast } from "@/hooks/use-toast";
import { TopNav } from "@/components/TopNav";
import { 
  Music, 
  Users as UsersIcon, 
  Calendar as CalendarIcon, 
  MessageSquare,
  Plus,
  X,
  Search,
  ArrowLeft,
  UserPlus,
  CalendarCheck,
  Mail,
  Bell
} from "lucide-react";
import { BandInvitationManager } from "@/components/BandInvitationManager";
import { ArtistAvailabilityManager } from "@/components/ArtistAvailabilityManager";
import { ScheduledRemindersManager } from "@/components/ScheduledRemindersManager";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessagesChat } from "@/components/MessagesChat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Profile {
  id: string;
  name: string;
  instrument: string | null;
  photo_urls: string[] | null;
  email: string;
}

interface Band {
  id: string;
  name: string;
  description: string | null;
  band_leader_id: string;
  leader_name?: string;
  member_count?: number;
}

interface ManagedBand extends Band {
  added_at: string;
}

interface ManagedArtist {
  id: string;
  artist_id: string;
  group_type: string;
  notes: string | null;
  created_at: string;
  profile: Profile;
}

export default function BookingManager() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [availableBands, setAvailableBands] = useState<Band[]>([]);
  const [managedBands, setManagedBands] = useState<ManagedBand[]>([]);
  const [managedArtists, setManagedArtists] = useState<ManagedArtist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [gigRequestDialogOpen, setGigRequestDialogOpen] = useState(false);
  const [individualSmsOpen, setIndividualSmsOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [groupMessage, setGroupMessage] = useState("");
  const [gigRequestMessage, setGigRequestMessage] = useState("");
  const [selectedBandForAvailability, setSelectedBandForAvailability] = useState<string>("");
  const [viewingResponsesForRequest, setViewingResponsesForRequest] = useState<string | null>(null);
  const [addArtistDialogOpen, setAddArtistDialogOpen] = useState(false);
  const [selectedArtistToAdd, setSelectedArtistToAdd] = useState<Profile | null>(null);
  const [artistGroupType, setArtistGroupType] = useState("solo");
  const [bookTalentOpen, setBookTalentOpen] = useState(false);
  const [bookTalentSearch, setBookTalentSearch] = useState("");

  useEffect(() => {
    checkRole();
    fetchManagedBands();
    fetchManagedArtists();
    fetchAvailableBands();
    fetchProfiles();
  }, []);

  const checkRole = async () => {
    const { waitForUser } = await import("@/lib/requireAuth");
    const user = await waitForUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    // Allow booking_manager and super_admin to access this page
    if (roleData?.role !== "booking_manager" && roleData?.role !== "super_admin") {
      navigate("/dashboard");
    }
  };

  const fetchManagedBands = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) return;

      const { data, error } = await supabase
        .from("booking_manager_bands")
        .select(`
          band_id,
          created_at,
          bands!inner (
            id,
            name,
            description,
            band_leader_id,
            profiles!bands_band_leader_id_fkey (name)
          )
        `)
        .eq("booking_manager_id", user.id);

      if (error) throw error;

      const formatted = data?.map((item: any) => ({
        id: item.bands.id,
        name: item.bands.name,
        description: item.bands.description,
        band_leader_id: item.bands.band_leader_id,
        leader_name: item.bands.profiles?.name,
        added_at: item.created_at,
      })) || [];

      setManagedBands(formatted);
    } catch (error: any) {
      console.error("Error fetching managed bands:", error);
    }
  };

  const fetchManagedArtists = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) return;

      const { data, error } = await supabase
        .from("booking_manager_artists")
        .select("*")
        .eq("booking_manager_id", user.id);

      if (error) throw error;

      // Fetch profile data for each artist
      const artistIds = data?.map(a => a.artist_id) || [];
      if (artistIds.length === 0) {
        setManagedArtists([]);
        return;
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, instrument, photo_urls, email")
        .in("id", artistIds);

      const formatted = data?.map((item: any) => ({
        ...item,
        profile: profilesData?.find(p => p.id === item.artist_id) || {
          id: item.artist_id,
          name: "Unknown",
          instrument: null,
          photo_urls: null,
          email: "",
        },
      })) || [];

      setManagedArtists(formatted);
    } catch (error: any) {
      console.error("Error fetching managed artists:", error);
    }
  };

  const fetchAvailableBands = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) return;

      // Get all bands that this manager doesn't manage yet
      const { data: managedBandIds } = await supabase
        .from("booking_manager_bands")
        .select("band_id")
        .eq("booking_manager_id", user.id);

      const excludeIds = managedBandIds?.map(b => b.band_id) || [];

      const query = supabase
        .from("bands")
        .select(`
          id,
          name,
          description,
          band_leader_id,
          profiles!bands_band_leader_id_fkey (name)
        `)
        .order("name");

      if (excludeIds.length > 0) {
        query.not("id", "in", `(${excludeIds.join(",")})`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formatted = data?.map((band: any) => ({
        ...band,
        leader_name: band.profiles?.name,
      })) || [];

      setAvailableBands(formatted);
    } catch (error: any) {
      console.error("Error fetching available bands:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, instrument, photo_urls, email")
        .order("name");

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      console.error("Error fetching profiles:", error);
    }
  };

  const addBandToRoster = async (bandId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) return;

      const { error } = await supabase
        .from("booking_manager_bands")
        .insert({
          booking_manager_id: user.id,
          band_id: bandId,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Band added to your roster",
      });

      fetchManagedBands();
      fetchAvailableBands();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeBandFromRoster = async (bandId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) return;

      const { error } = await supabase
        .from("booking_manager_bands")
        .delete()
        .eq("booking_manager_id", user.id)
        .eq("band_id", bandId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Band removed from your roster",
      });

      fetchManagedBands();
      fetchAvailableBands();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addArtistToRoster = async () => {
    if (!selectedArtistToAdd) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) return;

      const { error } = await supabase
        .from("booking_manager_artists")
        .insert({
          booking_manager_id: user.id,
          artist_id: selectedArtistToAdd.id,
          group_type: artistGroupType,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${selectedArtistToAdd.name} added to your roster`,
      });

      setAddArtistDialogOpen(false);
      setSelectedArtistToAdd(null);
      setArtistGroupType("solo");
      fetchManagedArtists();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeArtistFromRoster = async (artistId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) return;

      const { error } = await supabase
        .from("booking_manager_artists")
        .delete()
        .eq("booking_manager_id", user.id)
        .eq("artist_id", artistId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Artist removed from your roster",
      });

      fetchManagedArtists();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const sendGroupMessage = async () => {
    if (!groupMessage.trim()) return;

    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) return;

      await supabase.functions.invoke("send-manager-sms", {
        body: {
          message: groupMessage,
          recipient_ids: profiles.map(p => p.id),
        },
      });

      toast({
        title: "Success",
        description: "Group message sent to all artists",
      });

      setGroupMessage("");
      setSmsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send messages",
        variant: "destructive",
      });
    }
  };

  const filteredProfiles = profiles.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const managedArtistIds = managedArtists.map(a => a.artist_id);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <TopNav userRole="booking_manager" />
      <div className="p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
            <Button variant="ghost" onClick={() => navigate("/dashboard")} className="self-start">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">Booking Manager</h1>
              <p className="text-sm text-muted-foreground truncate">Manage your roster and discover new talent</p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button onClick={() => navigate("/schedule-reminder?type=custom")} variant="outline" size="sm" className="gap-1 text-xs sm:text-sm">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Schedule</span> Reminder
            </Button>
            <Button onClick={() => setBookTalentOpen(true)} variant="default" size="sm" className="gap-1 text-xs sm:text-sm">
              <CalendarIcon className="h-4 w-4" />
              Book Talent
            </Button>
            <Button onClick={() => navigate("/artists")} size="sm" variant="secondary" className="gap-1 text-xs sm:text-sm">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span> Talent
            </Button>
          </div>
        </div>

        {/* Managed Artists (Solo, Duo, Trio) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              My Artists ({managedArtists.length} Solo/Duo/Trio)
            </CardTitle>
            <CardDescription>Individual artists, duos, and trios you manage</CardDescription>
          </CardHeader>
          <CardContent>
            {managedArtists.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No individual artists in your roster yet. Click on an artist below to add them.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {managedArtists.map((artist) => (
                  <Card 
                    key={artist.id} 
                    className="border-primary/20 cursor-pointer hover:border-primary/50 transition-colors p-0"
                    onClick={() => navigate(`/artist-profile/${artist.artist_id}?book=1`)}
                  >
                    <CardHeader className="p-2 pb-1">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                            {artist.profile.photo_urls?.[0] ? (
                              <img
                                src={artist.profile.photo_urls[0]}
                                alt={artist.profile.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <UsersIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-xs truncate">{artist.profile.name}</CardTitle>
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 mt-0.5">
                              {artist.group_type}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); removeArtistFromRoster(artist.artist_id); }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    {artist.profile.instrument && (
                      <CardContent className="p-2 pt-0">
                        <p className="text-[10px] text-muted-foreground">{artist.profile.instrument}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Bands and Available Bands sections removed */}

        {/* Artists/Musicians Directory removed — available on Dashboard */}

        {/* Availability Management */}
        {managedBands.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5" />
                Band Availability Management
              </CardTitle>
              <CardDescription>
                Request and view availability from band members
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Select Band:</label>
                <Select 
                  value={selectedBandForAvailability} 
                  onValueChange={(value) => {
                    setSelectedBandForAvailability(value);
                    setViewingResponsesForRequest(null);
                  }}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Choose a band to manage" />
                  </SelectTrigger>
                  <SelectContent>
                    {managedBands.map((band) => (
                      <SelectItem key={band.id} value={band.id}>
                        {band.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedBandForAvailability && (
                <div className="space-y-6">
                  <div className="grid lg:grid-cols-2 gap-6">
                    <AvailabilityRequestManager 
                      bandId={selectedBandForAvailability}
                      onViewResponses={(requestId) => setViewingResponsesForRequest(requestId)}
                    />
                    {viewingResponsesForRequest && (
                      <AvailabilityRequestResults 
                        requestId={viewingResponsesForRequest}
                        onBack={() => setViewingResponsesForRequest(null)}
                      />
                    )}
                  </div>
                  <BandInvitationManager 
                    bandId={selectedBandForAvailability}
                    bandName={managedBands.find(b => b.id === selectedBandForAvailability)?.name || "Band"}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Artist Availability Management removed — available on Dashboard */}
        {viewingResponsesForRequest && !selectedBandForAvailability && (
          <AvailabilityRequestResults 
            requestId={viewingResponsesForRequest}
            onBack={() => setViewingResponsesForRequest(null)}
          />
        )}


        {/* Scheduled Reminders */}
        <ScheduledRemindersManager />

        {/* Location Tracking */}
        <BookingManagerClientLocations />

        {/* Individual SMS Dialog */}
        <Dialog open={individualSmsOpen} onOpenChange={setIndividualSmsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Message {selectedProfile?.name}</DialogTitle>
              <DialogDescription>
                Send a direct message to this artist
              </DialogDescription>
            </DialogHeader>
            <Input placeholder="Type your message..." />
            <Button>Send Message</Button>
          </DialogContent>
        </Dialog>

        {/* Add Artist to Roster Dialog */}
        <Dialog open={addArtistDialogOpen} onOpenChange={setAddArtistDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {selectedArtistToAdd?.name} to Roster</DialogTitle>
              <DialogDescription>
                Select the type of act for this artist
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Act Type</label>
                <Select value={artistGroupType} onValueChange={setArtistGroupType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select act type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solo">Solo Artist</SelectItem>
                    <SelectItem value="duo">Duo</SelectItem>
                    <SelectItem value="trio">Trio</SelectItem>
                    <SelectItem value="quartet">Quartet</SelectItem>
                    <SelectItem value="ensemble">Ensemble</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAddArtistDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={addArtistToRoster}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add to Roster
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Book Talent — pick a performer */}
        <Dialog open={bookTalentOpen} onOpenChange={setBookTalentOpen}>
          <DialogContent className="max-w-2xl bg-black/60 backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle>Book Talent</DialogTitle>
              <DialogDescription>
                Choose a performer, band, or artist to start a booking.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search performers..."
                  className="pl-9"
                  value={bookTalentSearch}
                  onChange={(e) => setBookTalentSearch(e.target.value)}
                />
              </div>
              {(() => {
                const q = bookTalentSearch.toLowerCase().trim();
                const managedIds = new Set(managedArtists.map((a) => a.artist_id));
                const rosterItems = managedArtists.map((a) => ({
                  key: `r-${a.id}`,
                  id: a.artist_id,
                  name: a.profile?.name || "Unnamed",
                  subtitle: a.group_type || "solo",
                  inRoster: true,
                }));
                const otherItems = profiles
                  .filter((p) => !managedIds.has(p.id))
                  .map((p) => ({
                    key: `p-${p.id}`,
                    id: p.id,
                    name: p.name || "Unnamed",
                    subtitle: (p as any).instrument || "Performer",
                    inRoster: false,
                  }));
                const all = [...rosterItems, ...otherItems].filter((i) =>
                  q ? i.name.toLowerCase().includes(q) : true
                );
                if (all.length === 0) {
                  return (
                    <div className="text-center py-8 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        No performers found.
                      </p>
                      <Button onClick={() => { setBookTalentOpen(false); navigate("/artists"); }}>
                        <Search className="h-4 w-4 mr-2" />
                        Search Talent
                      </Button>
                    </div>
                  );
                }
                return (
                  <div className="max-h-[50vh] overflow-y-auto space-y-2">
                    {all.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => {
                          setBookTalentOpen(false);
                          navigate(`/artist-profile/${item.id}`);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Music className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                        </div>
                        {item.inRoster && (
                          <Badge variant="secondary" className="text-xs">Roster</Badge>
                        )}
                        <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  );
}
