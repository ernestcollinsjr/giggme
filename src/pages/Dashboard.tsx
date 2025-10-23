import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBand } from "@/contexts/BandContext";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music, Briefcase, MapPin, Calendar as CalendarIcon, Crown, LogOut, ListMusic, User as UserIcon, Plus, Loader2, Play, Pause, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import { BandAssistant } from "@/components/BandAssistant";
import { LivePresence } from "@/components/LivePresence";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { AutoLocationTracker } from "@/components/AutoLocationTracker";
import { MemberLocationsMap } from "@/components/MemberLocationsMap";
import { AcceptedGigsCard } from "@/components/AcceptedGigsCard";
import { MessageInbox } from "@/components/MessageInbox";
import { Checkbox } from "@/components/ui/checkbox";
import { BookingManagerClientLocations } from "@/components/BookingManagerClientLocations";
import { BandMemberRoster } from "@/components/BandMemberRoster";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import RoleSwitcher from "@/components/RoleSwitcher";
import { MessageSquare, Send, Users as UsersIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Profile {
  id: string;
  name: string;
  bio: string;
  instrument: string;
  photo_urls: string[];
  location_lat: number;
  location_lng: number;
  phone_number: string | null;
  isAvailable?: boolean;
}

interface Rehearsal {
  id: string;
  date: string;
  venue: string;
  notes: string | null;
  band_leader_id: string;
  band_id: string | null;
}

interface Gig {
  id: string;
  date: string;
  venue: string;
  notes: string | null;
  status: string;
  user_id: string;
  band_id: string | null;
}

interface GigInvite {
  id: string;
  gig_id: string;
  member_id: string;
  status: string;
  gigs: {
    id: string;
    date: string;
    venue: string;
    notes: string | null;
  };
}

interface Band {
  id: string;
  name: string;
  description: string | null;
  band_leader_id: string;
}

interface SetlistSong {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string | null;
  order_index: number;
  set_number: number;
}

interface Setlist {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  songs: SetlistSong[];
}

type UserRole = "band_leader" | "band_member" | "booking_manager" | "artist";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedBandId, setSelectedBandId } = useBand();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [gigInvites, setGigInvites] = useState<GigInvite[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBandName, setNewBandName] = useState("");
  const [newBandDescription, setNewBandDescription] = useState("");
  const [isCreatingBand, setIsCreatingBand] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [manualLocation, setManualLocation] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [isSavingManualLocation, setIsSavingManualLocation] = useState(false);
  const [acceptInviteDialog, setAcceptInviteDialog] = useState<{open: boolean, inviteId: string | null}>({open: false, inviteId: null});
  const [locationSharingConsent, setLocationSharingConsent] = useState(true);
  const [activeGigsWithSharing, setActiveGigsWithSharing] = useState<string[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string } | null>(null);
  
  // SMS state
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [groupSmsDialogOpen, setGroupSmsDialogOpen] = useState(false);
  const [gigRequestDialogOpen, setGigRequestDialogOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<Profile | null>(null);
  const [sendingSms, setSendingSms] = useState(false);
  const [smsType, setSmsType] = useState<'individual' | 'group' | 'gig-request'>('individual');

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }
    
    setUser(user);
    
    // Fetch user profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    // Fetch user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    
    if (profileData && roleData) {
      setProfile(profileData);
      setUserRole(roleData.role as UserRole);
      
      // Fetch bands for band leaders
      if (roleData.role === "band_leader") {
        const { data: bandsData } = await supabase
          .from("bands")
          .select("*")
          .eq("band_leader_id", user.id)
          .order("created_at", { ascending: true });
        
        setBands(bandsData || []);
        if (bandsData && bandsData.length > 0) {
          setSelectedBandId(bandsData[0].id);
        }
      }
      
      // Fetch rehearsals for band members and leaders
      if (roleData.role === "band_member" || roleData.role === "band_leader") {
        const { data: rehearsalData } = await supabase
          .from("rehearsals")
          .select("*")
          .order("date", { ascending: true });
        
        setRehearsals(rehearsalData || []);
        
        // Fetch gigs
        const { data: gigData } = await supabase
          .from("gigs")
          .select("*")
          .order("date", { ascending: true });
        
        setGigs(gigData || []);
      }
      
      // Fetch pending gig invites for band members only
      if (roleData.role === "band_member") {
        const { data: inviteData } = await supabase
          .from("gig_members")
          .select(`
            id,
            gig_id,
            member_id,
            status,
            gigs (
              id,
              date,
              venue,
              notes
            )
          `)
          .eq("member_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        
        setGigInvites(inviteData || []);
        
        // Fetch setlists for band members
        fetchSetlists(user.id);
        
        // Check for active gigs with location sharing enabled
        const { data: activeGigs } = await supabase
          .from("gig_members")
          .select(`
            gig_id,
            location_sharing_enabled,
            gigs!inner (
              id,
              date,
              loading_time,
              sound_check_time
            )
          `)
          .eq("member_id", user.id)
          .eq("status", "accepted")
          .eq("location_sharing_enabled", true);
        
        if (activeGigs) {
          const activeGigIds = activeGigs.map((g: any) => g.gig_id);
          setActiveGigsWithSharing(activeGigIds);
        }
      }
      
      // Booking managers see bands (leaders and members)
      if (roleData.role === "booking_manager") {
        const { data: bandLeaders } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["band_leader", "band_member", "artist"]);
        
        if (bandLeaders && bandLeaders.length > 0) {
          const userIds = bandLeaders.map(r => r.user_id);
          const { data: bandProfiles } = await supabase
            .from("profiles")
            .select("*")
            .in("id", userIds);
          
          // Get artists who have accepted gigs in the future
          const { data: bookedArtists } = await supabase
            .from("gig_members")
            .select("member_id, gigs!inner(date)")
            .eq("status", "accepted")
            .gte("gigs.date", new Date().toISOString());
          
          const bookedArtistIds = new Set(bookedArtists?.map(g => g.member_id) || []);
          
          // Mark artists as available or booked
          const profilesWithAvailability = bandProfiles?.map(profile => ({
            ...profile,
            isAvailable: !bookedArtistIds.has(profile.id)
          })) || [];
          
          setProfiles(profilesWithAvailability);
        }
      }
    }
    
    setLoading(false);
  };

  useEffect(() => {
    checkAuth();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: error.message,
      });
    }
  };

  const handleShareLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Location not supported",
        description: "Your browser doesn't support geolocation.",
      });
      return;
    }
    // Detect embedded preview/iframe which can block geolocation
    try {
      if (window.self !== window.top) {
        toast({
          title: "Open in a new tab",
          description: "Location access may be blocked in embedded previews. Open the app in a new tab or enter your address manually.",
        });
        return;
      }
    } catch {}

    setIsSharingLocation(true);

    // Request permission explicitly with better error handling
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      
      if (permission.state === 'denied') {
        toast({
          variant: "destructive",
          title: "Location permission denied",
          description: "Please enable location access in your browser settings to share your location.",
        });
        setIsSharingLocation(false);
        return;
      }
    } catch (permError) {
      console.log("Permission API not supported, continuing with geolocation request");
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { error } = await supabase
            .from("profiles")
            .update({
              location_lat: position.coords.latitude,
              location_lng: position.coords.longitude,
            })
            .eq("id", user?.id);

          if (error) throw error;

          toast({
            title: "Location shared! 📍",
            description: "Your location has been updated successfully.",
          });
          
          // Refresh profile to show updated location
          checkAuth();
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Update failed",
            description: error.message,
          });
        } finally {
          setIsSharingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        let errorMessage = "Could not get your location.";
        
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Location access was denied. Please enable location permissions in your browser settings and try again.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = "Location information is unavailable. Try entering your address manually instead.";
        } else if (error.code === error.TIMEOUT) {
          errorMessage = "Location request timed out. Please try again.";
        }
        
        toast({
          variant: "destructive",
          title: "Location error",
          description: errorMessage,
        });
        setIsSharingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleManualLocationSave = async () => {
    if (!selectedPlace?.geometry?.location) {
      toast({
        variant: "destructive",
        title: "No location selected",
        description: "Please select a location from the dropdown.",
      });
      return;
    }

    setIsSavingManualLocation(true);
    try {
      const lat = selectedPlace.geometry.location.lat();
      const lng = selectedPlace.geometry.location.lng();

      const { error } = await supabase
        .from("profiles")
        .update({
          location_lat: lat,
          location_lng: lng,
        })
        .eq("id", user?.id);

      if (error) throw error;

      toast({
        title: "Location saved 📍",
        description: "We'll use this address as your location.",
      });
      checkAuth();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } finally {
      setIsSavingManualLocation(false);
    }
  };

  const handleInviteResponse = async (inviteId: string, newStatus: string, enableLocationSharing: boolean = false) => {
    try {
      const { error } = await supabase
        .from("gig_members")
        .update({ 
          status: newStatus,
          location_sharing_enabled: newStatus === "accepted" ? enableLocationSharing : false
        })
        .eq("id", inviteId);

      if (error) throw error;

      if (newStatus === "accepted" && enableLocationSharing) {
        toast({
          title: "Gig accepted! 📅",
          description: "You'll automatically share your location 1 hour before the event.",
        });
      } else {
        toast({
          title: newStatus === "accepted" ? "Invite accepted!" : "Invite declined",
          description: `You have ${newStatus} the gig invite.`,
        });
      }

      // Refresh invites
      setGigInvites(gigInvites.filter(invite => invite.id !== inviteId));
      checkAuth();
      setAcceptInviteDialog({open: false, inviteId: null});
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Action failed",
        description: error.message,
      });
    }
  };

  const fetchSetlists = async (userId: string) => {
    try {
      // Get bands that the user is a member of
      const { data: memberBands } = await supabase
        .from("gig_members")
        .select("gig_id, gigs!inner(band_id)")
        .eq("member_id", userId);

      const bandIds = [...new Set(memberBands?.map(m => (m.gigs as any).band_id).filter(Boolean))];

      if (bandIds.length === 0) {
        setSetlists([]);
        return;
      }

      // Fetch setlists for these bands
      const { data: setlistsData } = await supabase
        .from("setlists")
        .select("*")
        .in("band_id", bandIds)
        .order("created_at", { ascending: false });

      // Fetch songs for each setlist
      const setlistsWithSongs = await Promise.all(
        (setlistsData || []).map(async (setlist) => {
          const { data: songsData } = await supabase
            .from("setlist_songs")
            .select("*")
            .eq("setlist_id", setlist.id)
            .order("set_number", { ascending: true })
            .order("order_index", { ascending: true });

          return {
            ...setlist,
            songs: songsData || [],
          };
        })
      );

      setSetlists(setlistsWithSongs);
    } catch (error: any) {
      console.error("Error fetching setlists:", error);
    }
  };

  const handlePlayPause = (song: SetlistSong) => {
    if (!song.audio_url) {
      toast({
        variant: "destructive",
        title: "No audio available",
        description: "This song doesn't have an audio file yet.",
      });
      return;
    }

    if (playingSongId === song.id && playingAudio) {
      playingAudio.pause();
      setPlayingAudio(null);
      setPlayingSongId(null);
      return;
    }

    if (playingAudio) {
      playingAudio.pause();
    }

    const audio = new Audio(song.audio_url);
    audio.play();
    audio.onended = () => {
      setPlayingAudio(null);
      setPlayingSongId(null);
    };
    setPlayingAudio(audio);
    setPlayingSongId(song.id);
  };

  const extractVideoId = (url: string): string | null => {
    if (!url) return null;
    
    try {
      const cleanUrl = url.trim();
      const u = new URL(cleanUrl);
      const host = u.hostname.toLowerCase().replace('www.', '');
      let id = "";

      if (host === "youtu.be") {
        id = u.pathname.substring(1).split('?')[0];
      } else if (host.includes("youtube.com")) {
        if (u.pathname === "/watch") {
          id = u.searchParams.get("v") || "";
        } else if (u.pathname.startsWith("/shorts/")) {
          id = u.pathname.split("/")[2] || "";
        } else if (u.pathname.startsWith("/embed/")) {
          id = u.pathname.split("/")[2] || "";
        } else if (u.pathname.startsWith("/v/")) {
          id = u.pathname.split("/")[2] || "";
        }
      }
      
      id = id.split('&')[0].split('?')[0];
      
      if (!id || id.length < 10) {
        return null;
      }

      return id;
    } catch (error) {
      console.error('Error parsing YouTube URL:', error);
      return null;
    }
  };

  const handleWatchVideo = async (song: SetlistSong) => {
    if (!song.audio_url) return;

    const localVideoId = extractVideoId(song.audio_url);
    if (localVideoId) {
      setPlayingVideo({ videoId: localVideoId, title: song.title });
      return;
    }

    try {
      const { data } = await supabase.functions.invoke('fetch-youtube', {
        body: { url: song.audio_url }
      });
      if (data?.videoId) {
        setPlayingVideo({ videoId: data.videoId, title: song.title });
      } else {
        toast({ variant: 'destructive', title: 'Could not load video' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Could not load video' });
    }
  };

  const handleCreateBand = async () => {
    if (!newBandName.trim()) {
      toast({
        variant: "destructive",
        title: "Band name required",
        description: "Please enter a band name.",
      });
      return;
    }

    setIsCreatingBand(true);
    try {
      const { data, error } = await supabase
        .from("bands")
        .insert({
          band_leader_id: user?.id,
          name: newBandName,
          description: newBandDescription || null,
        })
        .select()
        .single();

      if (error) throw error;

      setBands([...bands, data]);
      setSelectedBandId(data.id);
      setNewBandName("");
      setNewBandDescription("");
      setDialogOpen(false);

      toast({
        title: "Band created!",
        description: `${newBandName} has been created successfully.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to create band",
        description: error.message,
      });
    } finally {
      setIsCreatingBand(false);
    }
  };

  const handleSendSMS = async () => {
    if (!smsMessage.trim()) {
      toast({
        variant: "destructive",
        title: "Message required",
        description: "Please enter a message to send.",
      });
      return;
    }

    setSendingSms(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      let recipients: string[];
      
      if (smsType === 'individual' && selectedRecipient) {
        recipients = [selectedRecipient.id];
      } else if (smsType === 'gig-request') {
        // Only available (unbooked) artists
        recipients = profiles.filter(p => p.isAvailable !== false).map(p => p.id);
      } else {
        // All artists
        recipients = profiles.map(p => p.id);
      }

      const { data, error } = await supabase.functions.invoke('send-manager-sms', {
        body: {
          recipients,
          message: smsMessage,
          type: smsType === 'individual' ? 'individual' : 'group'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast({
        title: "Messages sent!",
        description: `Successfully sent ${data.sent} message(s).`,
      });

      setSmsMessage("");
      setSmsDialogOpen(false);
      setGroupSmsDialogOpen(false);
      setGigRequestDialogOpen(false);
      setSelectedRecipient(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send messages",
        description: error.message,
      });
    } finally {
      setSendingSms(false);
    }
  };

  const openIndividualSms = (profile: Profile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile.phone_number) {
      toast({
        variant: "destructive",
        title: "No phone number",
        description: `${profile.name} doesn't have a phone number on file.`,
      });
      return;
    }
    setSelectedRecipient(profile);
    setSmsMessage("");
    setSmsType('individual');
    setSmsDialogOpen(true);
  };

  const openGigRequest = () => {
    const availableArtists = profiles.filter(p => p.isAvailable !== false && p.phone_number);
    const bookedArtists = profiles.filter(p => p.isAvailable === false);
    
    if (availableArtists.length === 0) {
      toast({
        variant: "destructive",
        title: "No available artists",
        description: "All artists are currently booked for upcoming gigs.",
      });
      return;
    }
    
    if (bookedArtists.length > 0) {
      toast({
        title: "Sending to available artists only",
        description: `${bookedArtists.length} artist(s) excluded (already booked)`,
      });
    }
    
    setSmsMessage("");
    setSmsType('gig-request');
    setGigRequestDialogOpen(true);
  };

  const openGroupText = () => {
    const artistsWithPhone = profiles.filter(p => p.phone_number);
    
    if (artistsWithPhone.length === 0) {
      toast({
        variant: "destructive",
        title: "No phone numbers",
        description: "No artists have phone numbers on file.",
      });
      return;
    }
    
    setSmsMessage("");
    setSmsType('group');
    setGroupSmsDialogOpen(true);
  };

  // Filter data by selected band
  const filteredRehearsals = selectedBandId
    ? rehearsals.filter(r => r.band_id === selectedBandId)
    : rehearsals;

  const filteredGigs = selectedBandId
    ? gigs.filter(g => g.band_id === selectedBandId)
    : gigs;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 pb-20">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary">
              <AvatarImage src={profile?.photo_urls?.[0] || undefined} alt={profile?.name} />
              <AvatarFallback className="text-lg font-semibold bg-primary/10">
                {profile?.name?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Welcome, {profile?.name}
              </h1>
              <Badge variant="secondary" className="mt-2">
                {userRole === "booking_manager" 
                  ? "Booking Manager" 
                  : userRole === "band_leader"
                  ? "Band Leader"
                  : userRole === "artist"
                  ? "Artist/Musician"
                  : "Band Member"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LivePresence />
            {userRole === "artist" && (
              <Button variant="outline" onClick={() => navigate("/artist-profile")}>
                Edit Profile
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/profile-setup")}>
              Profile
            </Button>
            <Button variant="destructive" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <RoleSwitcher currentRole={userRole} onRoleChange={checkAuth} />

        {userRole === "band_leader" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">My Bands</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate("/bookings")}>
                  <CalendarIcon className="h-4 w-4" />
                  Add Gig
                </Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate("/rehearsals")}>
                  <Music className="h-4 w-4" />
                  Add Rehearsal
                </Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate("/setlist")}>
                  <ListMusic className="h-4 w-4" />
                  Add Setlist
                </Button>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" />
                      New Band
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Band</DialogTitle>
                      <DialogDescription>
                        Add a new band to manage separately
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="band-name">Band Name</Label>
                        <Input
                          id="band-name"
                          value={newBandName}
                          onChange={(e) => setNewBandName(e.target.value)}
                          placeholder="Enter band name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="band-description">Description (Optional)</Label>
                        <Input
                          id="band-description"
                          value={newBandDescription}
                          onChange={(e) => setNewBandDescription(e.target.value)}
                          placeholder="Brief description"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleCreateBand}
                        disabled={isCreatingBand}
                      >
                        {isCreatingBand ? "Creating..." : "Create Band"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {bands.length === 0 ? (
              <Card className="border-border/50 shadow-lg bg-gradient-to-br from-primary/5 to-accent/5">
                <CardContent className="pt-6 text-center">
                  <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold mb-2">No Bands Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first band to start managing rehearsals, gigs, and setlists
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Tabs value={selectedBandId || bands[0]?.id} onValueChange={setSelectedBandId}>
                <TabsList className="bg-transparent border-0 p-0 h-auto gap-2">
                  {bands.map((band) => (
                    <TabsTrigger key={band.id} value={band.id} className="border-2 border-border shadow-sm">
                      {band.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {bands.map((band) => (
                  <TabsContent key={band.id} value={band.id}>
                    <Card className="border-border/50 shadow-lg">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Music className="h-5 w-5 text-primary" />
                          {band.name}
                        </CardTitle>
                        {band.description && (
                          <CardDescription>{band.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <BandMemberRoster bandId={band.id} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            )}
            
            <BandAssistant />

            <MessageInbox userId={user?.id || ""} />
          </div>
        )}

        {userRole === "band_member" && (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="bg-transparent border-0 p-0 h-auto gap-2">
              <TabsTrigger value="overview" className="border-2 border-border shadow-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="setlists" className="border-2 border-border shadow-sm">
                View Setlist and Songs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
            {gigInvites.length > 0 && (
              <Card className="border-border/50 shadow-lg bg-gradient-to-br from-primary/5 to-accent/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Music className="h-5 w-5 text-primary" />
                    Gig Invites
                  </CardTitle>
                  <CardDescription>
                    You have {gigInvites.length} pending gig {gigInvites.length === 1 ? 'invite' : 'invites'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {gigInvites.map((invite) => (
                      <div key={invite.id} className="p-4 border rounded-lg bg-background">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <CalendarIcon className="h-4 w-4" />
                              {new Date(invite.gigs.date).toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                            <h4 className="font-semibold">{invite.gigs.venue}</h4>
                            {invite.gigs.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{invite.gigs.notes}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => setAcceptInviteDialog({open: true, inviteId: invite.id})}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Accept
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleInviteResponse(invite.id, "declined", false)}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <BandAssistant />
            
            <AcceptedGigsCard userId={user?.id || ""} />

            <MessageInbox userId={user?.id || ""} />

            {userRole === "band_member" && (
              <AutoLocationTracker
                userId={user?.id || ""}
                isEnabled={activeGigsWithSharing.length > 0}
              />
            )}
            </TabsContent>

            <TabsContent value="setlists" className="space-y-4">
              {setlists.length === 0 ? (
                <Card className="border-border/50 shadow-lg">
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        No setlists available yet. Your band leader will upload them soon!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                setlists.map((setlist) => (
                  <Card key={setlist.id} className="border-border/50 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Music className="h-5 w-5 text-primary" />
                        {setlist.title}
                      </CardTitle>
                      {setlist.description && (
                        <CardDescription>{setlist.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {setlist.songs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">
                          No songs in this setlist yet
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {[1, 2, 3, 4].map((setNum) => {
                            const setSongs = setlist.songs.filter(song => song.set_number === setNum);
                            if (setSongs.length === 0) return null;
                            
                            return (
                              <div key={setNum} className="space-y-1">
                                <h3 className="text-xs font-semibold text-muted-foreground/70 mb-0.5">Set {setNum} ({setSongs.length} songs)</h3>
                                {setSongs.map((song, index) => (
                                  <div key={song.id} className="group relative flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-100 dark:bg-slate-800/20 hover:bg-slate-200 dark:hover:bg-slate-700/30 transition-colors">
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <span className="text-xs text-muted-foreground font-medium w-4 shrink-0">
                                        {index + 1}
                                      </span>
                                      <div className="flex-1">
                                        <p className="text-xs font-medium truncate leading-tight">{song.title}</p>
                                        {song.artist && (
                                          <p className="text-[10px] text-muted-foreground truncate leading-tight">{song.artist}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {song.audio_url && /(youtu\.be|youtube\.com|youtube-nocookie\.com)/i.test(song.audio_url) && (
                                        <Button
                                          variant="default"
                                          size="sm"
                                          className="h-6 text-[10px] px-1.5 py-0"
                                          onClick={() => handleWatchVideo(song)}
                                        >
                                          <Play className="h-2.5 w-2.5 mr-0.5" />
                                          Watch
                                        </Button>
                                      )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-[10px] px-1.5 py-0"
                                          onClick={() => navigate(`/setlist/lyrics/${song.id}`)}
                                        >
                                          <FileText className="h-2.5 w-2.5 mr-0.5" />
                                          Lyrics
                                        </Button>
                                      {song.audio_url && !/(youtu\.be|youtube\.com|youtube-nocookie\.com)/i.test(song.audio_url) && (
                                        <Button
                                          size="icon"
                                          className="h-6 w-6"
                                          variant={playingSongId === song.id ? "default" : "ghost"}
                                          onClick={() => handlePlayPause(song)}
                                        >
                                          {playingSongId === song.id ? (
                                            <Pause className="h-2.5 w-2.5" />
                                          ) : (
                                            <Play className="h-4 w-4" />
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}

        {(userRole === "band_leader" || userRole === "band_member") && (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <Card
                className="border-border/50 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => navigate("/rehearsals")}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    Upcoming Rehearsals
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {filteredRehearsals.length > 0 ? `${filteredRehearsals.length} scheduled` : "No rehearsals yet"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {filteredRehearsals.slice(0, 2).map((rehearsal) => (
                    <div key={rehearsal.id} className="p-2 border rounded-md text-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <CalendarIcon className="h-3 w-3" />
                        {new Date(rehearsal.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </div>
                      <p className="font-medium truncate">{rehearsal.venue}</p>
                    </div>
                  ))}
                  {filteredRehearsals.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No rehearsals scheduled
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card
                className="border-border/50 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => navigate("/bookings")}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Upcoming Gigs
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {filteredGigs.length > 0 ? `${filteredGigs.length} booked` : "No gigs yet"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {filteredGigs.slice(0, 2).map((gig) => (
                    <div key={gig.id} className="p-2 border rounded-md text-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <CalendarIcon className="h-3 w-3" />
                        {new Date(gig.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </div>
                      <p className="font-medium truncate">{gig.venue}</p>
                    </div>
                  ))}
                  {filteredGigs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No gigs scheduled
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {userRole === "booking_manager" && (
          <>
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Music className="h-5 w-5 text-primary" />
                      Band/Artist/Musician
                    </CardTitle>
                    <CardDescription>
                      Browse and connect with artists/musicians
                      <span className="block text-xs mt-1 text-primary/70">
                        💡 Tip: Hover over any artist to send personal text, click the Text icon button
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex flex-col items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={openGigRequest}
                        className="gap-2"
                      >
                        <CalendarIcon className="h-4 w-4" />
                        Group Gig Request
                      </Button>
                      <span className="text-[10px] text-muted-foreground mt-0.5">only to unbooked members</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={openGroupText}
                        className="gap-2"
                      >
                        <UsersIcon className="h-4 w-4" />
                        Group Text
                      </Button>
                      <span className="text-[10px] text-muted-foreground mt-0.5">to everyone</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {profiles.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No artists/musicians available at the moment
                  </p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                    {profiles.map((bandProfile) => (
                      <div
                        key={bandProfile.id}
                        className="relative flex flex-col items-center p-1.5 border-[0.5px] border-border rounded-md hover:shadow-md hover:border-primary hover:bg-primary/5 transition-all bg-card group"
                      >
                        <button
                          onClick={(e) => openIndividualSms(bandProfile, e)}
                          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 z-10"
                          title="Text Member"
                        >
                          <MessageSquare className="h-3 w-3" />
                        </button>
                        <div
                          onClick={() => navigate(`/bookings?artistId=${bandProfile.id}&artistName=${encodeURIComponent(bandProfile.name)}`)}
                          className="cursor-pointer flex flex-col items-center w-full"
                        >
                          <Avatar className="h-8 w-8 mb-1 border-[0.5px] border-primary">
                            <AvatarImage src={bandProfile.photo_urls?.[0]} alt={bandProfile.name} />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                              {bandProfile.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <h4 className="font-medium text-[10px] text-center line-clamp-1 w-full px-0.5">
                            {bandProfile.name}
                          </h4>
                          {bandProfile.instrument && (
                            <p className="text-[8px] text-muted-foreground mt-0.5 truncate w-full text-center">
                              {bandProfile.instrument}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <BookingManagerClientLocations />
          </>
        )}

        {userRole === "artist" && (
          <div className="space-y-6">
            <Card className="border-border/50 shadow-lg bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-primary" />
                  Artist/Musician Dashboard
                </CardTitle>
                <CardDescription>
                  Manage your profile and get discovered by booking managers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Button
                    variant="default"
                    onClick={() => navigate("/artist-profile")}
                    className="h-20 text-lg"
                  >
                    <UserIcon className="mr-2 h-5 w-5" />
                    Edit Profile
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/artists")}
                    className="h-20 text-lg"
                  >
                    <Music className="mr-2 h-5 w-5" />
                    Browse Artists
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Keep your profile up to date with videos, bio, and availability to get more opportunities!
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Quick Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Badge variant="secondary">1</Badge>
                    <span>Upload high-quality photos to make a great first impression</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="secondary">2</Badge>
                    <span>Add YouTube videos of your best performances</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="secondary">3</Badge>
                    <span>Keep your availability and rate range updated</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="secondary">4</Badge>
                    <span>Write a compelling bio that showcases your unique style</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="border-border/50 shadow-lg bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Upgrade to Premium
            </CardTitle>
            <CardDescription>
              Unlock advanced features for your band
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Get access to priority support, advanced analytics, and more.
            </p>
            <Button className="w-full">
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Dialog 
          open={acceptInviteDialog.open} 
          onOpenChange={(open) => setAcceptInviteDialog({open, inviteId: null})}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Accept Gig Invitation</DialogTitle>
              <DialogDescription>
                Would you like to enable automatic location sharing for this gig?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="location-consent"
                  checked={locationSharingConsent}
                  onCheckedChange={(checked) => setLocationSharingConsent(checked as boolean)}
                />
                <label
                  htmlFor="location-consent"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Share my location 1 hour before the gig starts
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                This helps the band leader know when everyone is arriving at the venue.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAcceptInviteDialog({open: false, inviteId: null})}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (acceptInviteDialog.inviteId) {
                    handleInviteResponse(acceptInviteDialog.inviteId, "accepted", locationSharingConsent);
                  }
                }}
              >
                Accept Gig
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {playingVideo && (
        <YouTubePlayer
          videoId={playingVideo.videoId}
          title={playingVideo.title}
          isOpen={!!playingVideo}
          onClose={() => setPlayingVideo(null)}
        />
      )}

      {/* Individual SMS Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Text Message</DialogTitle>
            <DialogDescription>
              Send a text message to {selectedRecipient?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sms-message">Message</Label>
              <Textarea
                id="sms-message"
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={5}
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground">
                {smsMessage.length}/160 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSmsDialogOpen(false)}
              disabled={sendingSms}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendSMS}
              disabled={sendingSms || !smsMessage.trim()}
              className="gap-2"
            >
              {sendingSms ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group SMS Dialog */}
      <Dialog open={groupSmsDialogOpen} onOpenChange={setGroupSmsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Group Text</DialogTitle>
            <DialogDescription>
              Send a general message to all {profiles.filter(p => p.phone_number).length} artists (including those with bookings)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-sms-message">Message</Label>
              <Textarea
                id="group-sms-message"
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Example: Reminder - Practice session this Sunday at 3pm. See you there!"
                rows={6}
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground">
                {smsMessage.length}/160 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGroupSmsDialogOpen(false)}
              disabled={sendingSms}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendSMS}
              disabled={sendingSms || !smsMessage.trim()}
              className="gap-2"
            >
              {sendingSms ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UsersIcon className="h-4 w-4" />
              )}
              Send to All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
