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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music, Briefcase, MapPin, Calendar as CalendarIcon, Crown, LogOut, ListMusic, User as UserIcon, Plus, Loader2, Play, Pause, FileText, Search, Shield, Filter } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import { BandAssistant } from "@/components/BandAssistant";
import { LivePresence } from "@/components/LivePresence";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { AutoLocationTracker } from "@/components/AutoLocationTracker";
import { MemberLocationsMap } from "@/components/MemberLocationsMap";
import { AcceptedGigsCard } from "@/components/AcceptedGigsCard";
import { UpcomingGigLocationTracker } from "@/components/UpcomingGigLocationTracker";

import { Checkbox } from "@/components/ui/checkbox";
import { BandMemberRoster } from "@/components/BandMemberRoster";
import { BandInvitationManager } from "@/components/BandInvitationManager";
import { TeamAvailabilityView } from "@/components/TeamAvailabilityView";
import { AvailabilityRequestManager } from "@/components/AvailabilityRequestManager";
import { AvailabilityRequestResults } from "@/components/AvailabilityRequestResults";
import { GigResponseCountdown } from "@/components/GigResponseCountdown";
import { AvailabilityRequestResponder } from "@/components/AvailabilityRequestResponder";
import { BandProfileEditor } from "@/components/BandProfileEditor";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import RoleSwitcher from "@/components/RoleSwitcher";
import { MessageSquare, Send, Users as UsersIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { formatInTimeZone } from "date-fns-tz";
import { TopNav } from "@/components/TopNav";

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
  venue_name?: string | null;
  loading_time?: string | null;
  sound_check_time?: string | null;
  end_time?: string | null;
  payment_amount?: number | null;
  payment_status?: string | null;
  attire?: string | null;
  food_provided?: string | null;
  venue_contact_person?: string | null;
  sound_man_info?: string | null;
}

interface GigInvite {
  id: string;
  gig_id: string;
  member_id: string;
  status: string;
  response_deadline: string | null;
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

type UserRole = "band_leader" | "band_member" | "booking_manager" | "artist" | "tour_manager" | "super_admin";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedBandId, setSelectedBandId } = useBand();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userTimezone, setUserTimezone] = useState<string>("America/Chicago");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [gigResponseCounts, setGigResponseCounts] = useState<Record<string, { pending: number; accepted: number; declined: number }>>({});
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
  const [showPendingGigsOnly, setShowPendingGigsOnly] = useState(false);
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
  
  // Artist profile dialog state
  const [artistProfileDialogOpen, setArtistProfileDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Profile | null>(null);
  const [artistGigs, setArtistGigs] = useState<Gig[]>([]);
  const [loadingArtistGigs, setLoadingArtistGigs] = useState(false);
  const [newBookingDate, setNewBookingDate] = useState("");
  const [newBookingVenueName, setNewBookingVenueName] = useState("");
  const [newBookingVenue, setNewBookingVenue] = useState("");
  const [newBookingLoadingTime, setNewBookingLoadingTime] = useState("");
  const [newBookingSoundCheckTime, setNewBookingSoundCheckTime] = useState("");
  const [newBookingEndTime, setNewBookingEndTime] = useState("");
  const [newBookingAttire, setNewBookingAttire] = useState("");
  const [newBookingFoodProvided, setNewBookingFoodProvided] = useState("");
  const [newBookingVenueContact, setNewBookingVenueContact] = useState("");
  const [newBookingSoundManInfo, setNewBookingSoundManInfo] = useState("");
  const [newBookingNotes, setNewBookingNotes] = useState("");
  const [newBookingPaymentAmount, setNewBookingPaymentAmount] = useState("");
  const [isBookingArtist, setIsBookingArtist] = useState(false);
  
  // Availability request state
  const [viewingRequestId, setViewingRequestId] = useState<string | null>(null);
  
  // Booking manager state
  const [managedBands, setManagedBands] = useState<Band[]>([]);
  const [selectedManagedBandId, setSelectedManagedBandId] = useState<string>("");
  const [bmViewingRequestId, setBmViewingRequestId] = useState<string | null>(null);

  const checkAuth = async () => {
    const { waitForUser } = await import("@/lib/requireAuth");
    const user = await waitForUser();

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
    
    // Fetch user roles - prioritize super_admin > band_leader > others
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    // Determine the primary role for display - prioritize band_leader for users who have both
    // This allows super_admins who are also band_leaders to test the app as a band leader
    let primaryRole: UserRole | null = null;
    if (rolesData && rolesData.length > 0) {
      const roles = rolesData.map(r => r.role);
      if (roles.includes("band_leader")) {
        primaryRole = "band_leader";
      } else if (roles.includes("tour_manager")) {
        primaryRole = "tour_manager";
      } else if (roles.includes("booking_manager")) {
        primaryRole = "booking_manager";
      } else if (roles.includes("artist")) {
        primaryRole = "artist";
      } else if (roles.includes("super_admin")) {
        primaryRole = "super_admin";
      } else {
        primaryRole = roles[0] as UserRole;
      }
    }
    
    if (profileData && primaryRole) {
      setProfile(profileData);
      setUserRole(primaryRole);


      
      // Fetch bands for band leaders and super admins
      if (primaryRole === "band_leader" || primaryRole === "super_admin") {
        // For super_admin, fetch all bands; for band_leader, fetch only their bands
        let bandsQuery = supabase.from("bands").select("*");
        if (primaryRole !== "super_admin") {
          bandsQuery = bandsQuery.eq("band_leader_id", user.id);
        }
        const { data: bandsData } = await bandsQuery.order("created_at", { ascending: true });
        
        setBands(bandsData || []);
        if (bandsData && bandsData.length > 0) {
          setSelectedBandId(bandsData[0].id);
        }

        // Fetch artist profiles for band leaders (for booking tab)
        const { data: artistRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["band_member", "artist"]);
        
        if (artistRoles && artistRoles.length > 0) {
          const userIds = artistRoles.map(r => r.user_id);
          const { data: artistProfiles } = await supabase
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
          const profilesWithAvailability = artistProfiles?.map(profile => ({
            ...profile,
            isAvailable: !bookedArtistIds.has(profile.id)
          })) || [];
          
          setProfiles(profilesWithAvailability);
        }
      }
      
      // Fetch rehearsals for band members, leaders, and super admins
      if (primaryRole === "band_member" || primaryRole === "band_leader" || primaryRole === "super_admin") {
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
        
        // Fetch gig member response counts
        if (gigData && gigData.length > 0) {
          const gigIds = gigData.map((g: any) => g.id);
          const { data: responses } = await supabase
            .from('gig_members')
            .select('gig_id, status')
            .in('gig_id', gigIds);
          
          const counts: Record<string, { pending: number; accepted: number; declined: number }> = {};
          responses?.forEach((r: any) => {
            if (!counts[r.gig_id]) {
              counts[r.gig_id] = { pending: 0, accepted: 0, declined: 0 };
            }
            if (r.status === 'pending') counts[r.gig_id].pending++;
            else if (r.status === 'accepted') counts[r.gig_id].accepted++;
            else if (r.status === 'declined') counts[r.gig_id].declined++;
          });
          setGigResponseCounts(counts);
        }
      }
      
      // Fetch pending gig invites for band members only
      if (primaryRole === "band_member") {
        const { data: inviteData } = await supabase
          .from("gig_members")
          .select(`
            id,
            gig_id,
            member_id,
            status,
            response_deadline,
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
      if (primaryRole === "booking_manager") {
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
        
        // Fetch managed bands for booking manager
        const { data: managedBandLinks } = await supabase
          .from("booking_manager_bands")
          .select("band_id")
          .eq("booking_manager_id", user.id);
        
        if (managedBandLinks && managedBandLinks.length > 0) {
          const bandIds = managedBandLinks.map(link => link.band_id);
          const { data: bandsData } = await supabase
            .from("bands")
            .select("*")
            .in("id", bandIds);
          
          setManagedBands(bandsData || []);
          if (bandsData && bandsData.length > 0) {
            setSelectedManagedBandId(bandsData[0].id);
          }
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

  // Booking managers use the dedicated /booking-manager dashboard
  useEffect(() => {
    if (userRole === "booking_manager") {
      navigate("/booking-manager", { replace: true });
    }
  }, [userRole, navigate]);


  // Real-time updates for gig member responses (for band leaders and super admins)
  useEffect(() => {
    if ((userRole !== "band_leader" && userRole !== "super_admin") || !user) return;

    const channel = supabase
      .channel('gig-members-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gig_members'
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const update = payload.new as { member_id: string; status: string; gig_id: string };
            const oldData = payload.old as { status?: string } | null;
            
            // Only notify for gigs that belong to this band leader
            const { data: gigData } = await supabase
              .from('gigs')
              .select('id, venue, user_id')
              .eq('id', update.gig_id)
              .eq('user_id', user.id)
              .single();
            
            if (!gigData) return;
            
            // Update the response counts
            setGigResponseCounts(prev => {
              const current = prev[update.gig_id] || { pending: 0, accepted: 0, declined: 0 };
              const updated = { ...current };
              
              // Decrement old status count if this is an update
              if (payload.eventType === 'UPDATE' && oldData?.status) {
                if (oldData.status === 'pending') updated.pending = Math.max(0, updated.pending - 1);
                else if (oldData.status === 'accepted') updated.accepted = Math.max(0, updated.accepted - 1);
                else if (oldData.status === 'declined') updated.declined = Math.max(0, updated.declined - 1);
              }
              
              // Increment new status count
              if (update.status === 'pending') updated.pending++;
              else if (update.status === 'accepted') updated.accepted++;
              else if (update.status === 'declined') updated.declined++;
              
              return { ...prev, [update.gig_id]: updated };
            });
            
            // Get member name
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', update.member_id)
              .single();
            
            const memberName = profile?.name || 'A member';
            const statusEmoji = update.status === 'accepted' ? '✅' : update.status === 'declined' ? '❌' : '⏳';
            
            toast({
              title: "Gig RSVP Update",
              description: `${statusEmoji} ${memberName} has ${update.status} the gig at ${gigData.venue}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole, user, toast]);

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
      // Get the invite details before updating
      const invite = gigInvites.find(inv => inv.id === inviteId);
      
      const { error } = await supabase
        .from("gig_members")
        .update({ 
          status: newStatus,
          location_sharing_enabled: newStatus === "accepted" ? enableLocationSharing : false
        })
        .eq("id", inviteId);

      if (error) throw error;

      // Send email notification to band leader
      if (invite && (newStatus === "accepted" || newStatus === "declined")) {
        try {
          await supabase.functions.invoke("notify-gig-response", {
            body: {
              gig_id: invite.gig_id,
              member_id: user?.id,
              member_name: profile?.name || "A band member",
              status: newStatus,
            },
          });
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
          // Don't fail the main action if email fails
        }
      }

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

  const handlePaymentStatusToggle = async (gigId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
      const { error } = await supabase
        .from('gigs')
        .update({ payment_status: newStatus })
        .eq('id', gigId);

      if (error) throw error;

      toast({
        title: "Payment status updated",
        description: `Marked as ${newStatus}`,
      });

      // Refresh the gigs list
      if (selectedArtist) {
        openArtistProfile(selectedArtist);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    }
  };

  const handlePaymentAmountUpdate = async (gigId: string, amount: string) => {
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount < 0) {
        toast({
          variant: "destructive",
          title: "Invalid amount",
          description: "Please enter a valid positive number",
        });
        return;
      }

      const { error } = await supabase
        .from('gigs')
        .update({ payment_amount: numAmount })
        .eq('id', gigId);

      if (error) throw error;

      toast({
        title: "Payment amount updated",
        description: `Set to $${numAmount.toFixed(2)}`,
      });

      // Refresh the gigs list
      if (selectedArtist) {
        openArtistProfile(selectedArtist);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    }
  };

  const getGigCompletionTime = (gig: Pick<Gig, "date" | "end_time">): number => {
    const dateOnly = gig.date.split("T")[0];
    const endIso = gig.end_time ? `${dateOnly}T${gig.end_time}` : `${dateOnly}T23:59:59`;
    const completionTime = new Date(endIso).getTime();
    return Number.isNaN(completionTime) ? new Date(gig.date).getTime() : completionTime;
  };

  const isGigCompleted = (gig: Gig): boolean => {
    return gig.status === "completed" || getGigCompletionTime(gig) < Date.now();
  };

  const openArtistProfile = (artist: Profile) => {
    setSelectedArtist(artist);
    navigate(`/artist-profile/${artist.id}`);
  };


  const handleBookArtist = async () => {
    if (!selectedArtist || !newBookingDate || !newBookingVenue || !newBookingLoadingTime || !newBookingEndTime) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please provide date, venue, start time, and end time.",
      });
      return;
    }

    // Validate that end time is after start time
    if (newBookingEndTime <= newBookingLoadingTime) {
      toast({
        variant: "destructive",
        title: "Invalid time range",
        description: "End time must be after start time.",
      });
      return;
    }

    setIsBookingArtist(true);
    try {
      // Check for time conflicts on the same date
      const { data: existingGigs, error: checkError } = await supabase
        .from('gig_members')
        .select(`
          gig_id,
          gigs!inner (
            id,
            date,
            loading_time,
            end_time
          )
        `)
        .eq('member_id', selectedArtist.id)
        .eq('status', 'accepted');

      if (checkError) throw checkError;

      // Check for time conflicts on the same date
      const hasConflict = existingGigs?.some((gm: any) => {
        const gig = gm.gigs;
        const gigDate = new Date(gig.date).toISOString().split('T')[0];
        const newDate = new Date(newBookingDate).toISOString().split('T')[0];
        
        if (gigDate !== newDate) return false;

        const existingStart = gig.loading_time || "00:00";
        const existingEnd = gig.end_time || "23:59";

        // Check if times overlap
        const newStart = newBookingLoadingTime;
        const newEnd = newBookingEndTime;

        // Times conflict if: new start is before existing end AND new end is after existing start
        return (newStart < existingEnd && newEnd > existingStart);
      });

      if (hasConflict) {
        toast({
          variant: "destructive",
          title: "Already Booked",
          description: `${selectedArtist.name} is already booked during this time on ${formatInTimeZone(new Date(newBookingDate), userTimezone, 'MMM d, yyyy')}.`,
        });
        setIsBookingArtist(false);
        return;
      }

      // Create the gig
      const { data: gigData, error: gigError } = await supabase
        .from('gigs')
        .insert({
          date: newBookingDate,
          venue: newBookingVenue,
          venue_name: newBookingVenueName || null,
          loading_time: newBookingLoadingTime,
          sound_check_time: newBookingSoundCheckTime || null,
          end_time: newBookingEndTime,
          attire: newBookingAttire || null,
          food_provided: newBookingFoodProvided || null,
          venue_contact_person: newBookingVenueContact || null,
          sound_man_info: newBookingSoundManInfo || null,
          notes: newBookingNotes || null,
          payment_amount: newBookingPaymentAmount ? parseFloat(newBookingPaymentAmount) : null,
          payment_status: 'unpaid',
          status: 'confirmed',
          user_id: user?.id,
        })
        .select()
        .single();

      if (gigError) throw gigError;

      // Add the artist as a gig member with accepted status
      const { error: memberError } = await supabase
        .from('gig_members')
        .insert({
          gig_id: gigData.id,
          member_id: selectedArtist.id,
          status: 'accepted',
        });

      if (memberError) throw memberError;

      toast({
        title: "Artist booked!",
        description: `${selectedArtist.name} has been booked for ${formatInTimeZone(new Date(newBookingDate), userTimezone, 'MMM d, yyyy')} from ${newBookingLoadingTime} to ${newBookingEndTime}`,
      });

      // Clear form
      setNewBookingDate("");
      setNewBookingVenueName("");
      setNewBookingVenue("");
      setNewBookingLoadingTime("");
      setNewBookingSoundCheckTime("");
      setNewBookingEndTime("");
      setNewBookingAttire("");
      setNewBookingFoodProvided("");
      setNewBookingVenueContact("");
      setNewBookingSoundManInfo("");
      setNewBookingNotes("");
      setNewBookingPaymentAmount("");

      // Refresh the artist's gigs
      openArtistProfile(selectedArtist);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Booking failed",
        description: error.message,
      });
    } finally {
      setIsBookingArtist(false);
    }
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
      <TopNav userRole={userRole} />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Welcome Section */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary">
            <AvatarImage src={profile?.photo_urls?.[0] || undefined} alt={profile?.name} />
            <AvatarFallback className="text-lg font-semibold bg-primary/10">
              {profile?.name?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Welcome, {profile?.name}
            </h1>
            <Badge variant="secondary" className="mt-2">
              {userRole === "super_admin"
                ? "Super Admin"
                : userRole === "booking_manager" 
                ? "Booking Manager" 
                : userRole === "band_leader"
                ? "Band Leader"
                : userRole === "artist"
                ? "Artist/Musician"
                : userRole === "tour_manager"
                ? "Tour/Road Manager"
                : "Band Member"}
            </Badge>
          </div>
          <LivePresence />
        </div>

        {/* Upcoming Gig Location Tracker - Shows prominently when gig is within 1 hour */}
        {user && userRole && (
          <UpcomingGigLocationTracker 
            userId={user.id} 
            userRole={userRole} 
          />
        )}

        {(userRole === "band_leader" || userRole === "super_admin") && (
          <div className="space-y-4">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">{userRole === "super_admin" ? "All Bands" : "My Bands"}</h2>
              <div className="flex gap-2">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
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
                <div className="mb-4">
                  <Select value={selectedBandId || bands[0]?.id} onValueChange={setSelectedBandId}>
                    <SelectTrigger className="w-full max-w-xs bg-background border-2 border-border shadow-sm">
                      <SelectValue placeholder="Select a band" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border shadow-lg z-50">
                      {bands.map((band) => (
                        <SelectItem key={band.id} value={band.id}>
                          <span className="flex items-center gap-2">
                            <Music className="h-4 w-4 text-primary" />
                            {band.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {bands.map((band) => (
                  <TabsContent key={band.id} value={band.id}>
                    <Card className="border-border/50 shadow-lg">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <Music className="h-5 w-5 text-primary" />
                            {band.name}
                          </CardTitle>
                          <BandProfileEditor bandId={band.id} bandName={band.name} />
                        </div>
                        {band.description && (
                          <CardDescription>{band.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Tabs defaultValue="overview" className="w-full">
                          <TabsList className="w-full justify-start bg-muted/50 mb-4 flex-wrap">
                            <TabsTrigger value="overview" className="flex-1 sm:flex-none">
                              <Briefcase className="h-4 w-4 mr-1.5" />
                              Overview
                            </TabsTrigger>
                            <TabsTrigger value="team" className="flex-1 sm:flex-none">
                              <UsersIcon className="h-4 w-4 mr-1.5" />
                              Team
                            </TabsTrigger>
                            <TabsTrigger value="availability" className="flex-1 sm:flex-none">
                              <CalendarIcon className="h-4 w-4 mr-1.5" />
                              Availability
                            </TabsTrigger>
                            <TabsTrigger value="booking" className="flex-1 sm:flex-none">
                              <Music className="h-4 w-4 mr-1.5" />
                              Booking
                            </TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="overview" className="mt-0 space-y-4">
                            <div className="grid gap-4">
                              <div className="p-4 rounded-lg bg-muted/30 border">
                                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                  <Music className="h-4 w-4 text-primary" />
                                  Band Info
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {band.description || "No description set. Edit your band profile to add one."}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => navigate("/bookings")}
                                  className="gap-1.5"
                                >
                                  <Briefcase className="h-4 w-4" />
                                  View Gigs
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => navigate("/rehearsals")}
                                  className="gap-1.5"
                                >
                                  <CalendarIcon className="h-4 w-4" />
                                  Rehearsals
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => navigate("/setlist")}
                                  className="gap-1.5"
                                >
                                  <ListMusic className="h-4 w-4" />
                                  Setlists
                                </Button>
                              </div>
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="team" className="mt-0 space-y-4">
                            <BandMemberRoster bandId={band.id} />
                            <BandInvitationManager bandId={band.id} bandName={band.name} />
                          </TabsContent>
                          
                          <TabsContent value="availability" className="mt-0 space-y-4">
                            {viewingRequestId ? (
                              <AvailabilityRequestResults 
                                requestId={viewingRequestId} 
                                onBack={() => setViewingRequestId(null)} 
                              />
                            ) : (
                              <AvailabilityRequestManager 
                                bandId={band.id} 
                                onViewResponses={(requestId) => setViewingRequestId(requestId)} 
                              />
                            )}
                            <TeamAvailabilityView bandId={band.id} />
                          </TabsContent>

                          <TabsContent value="booking" className="mt-0 space-y-4">
                            <div className="space-y-4">
                              {/* Quick Actions */}
                              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <Button 
                                  onClick={() => navigate("/bookings")}
                                  className="h-16 gap-2"
                                >
                                  <Briefcase className="h-5 w-5" />
                                  Manage Gigs
                                </Button>
                                <Button 
                                  variant="outline"
                                  onClick={() => navigate("/artists")}
                                  className="h-16 gap-2"
                                >
                                  <Search className="h-5 w-5" />
                                  Discover Artists
                                </Button>
                                <Button 
                                  variant="outline"
                                  onClick={() => navigate("/schedule-reminder?type=custom")}
                                  className="h-16 gap-2"
                                >
                                  <CalendarIcon className="h-5 w-5" />
                                  Schedule Reminder
                                </Button>
                                <Button 
                                  variant="outline"
                                  onClick={() => setGigRequestDialogOpen(true)}
                                  className="h-16 gap-2"
                                >
                                  <Send className="h-5 w-5" />
                                  Send Gig Request
                                </Button>
                              </div>

                              {/* Artists Directory Preview */}
                              <div className="p-4 rounded-lg border bg-muted/30">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-medium text-sm flex items-center gap-2">
                                    <UsersIcon className="h-4 w-4 text-primary" />
                                    Available Artists
                                  </h4>
                                  <Button 
                                    variant="link" 
                                    size="sm" 
                                    onClick={() => navigate("/artists")}
                                    className="text-xs"
                                  >
                                    View All →
                                  </Button>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                  {profiles.slice(0, 8).map((profile) => (
                                    <div
                                      key={profile.id}
                                      onClick={() => openArtistProfile(profile)}
                                      className="relative flex flex-col items-center p-2 border rounded-md hover:shadow-md hover:border-primary hover:bg-primary/5 transition-all cursor-pointer bg-card"
                                    >
                                      <div className="w-10 h-10 rounded-full overflow-hidden bg-muted mb-1">
                                        {profile.photo_urls?.[0] ? (
                                          <img
                                            src={profile.photo_urls[0]}
                                            alt={profile.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <UserIcon className="h-5 w-5 text-muted-foreground" />
                                          </div>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-center font-medium truncate w-full">
                                        {profile.name}
                                      </p>
                                      {profile.instrument && (
                                        <p className="text-[9px] text-center text-muted-foreground truncate w-full">
                                          {profile.instrument}
                                        </p>
                                      )}
                                      {profile.isAvailable && (
                                        <Badge variant="secondary" className="absolute -top-1 -right-1 text-[8px] px-1 py-0 bg-green-100 text-green-700">
                                          Free
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {profiles.length === 0 && (
                                  <p className="text-sm text-muted-foreground text-center py-4">
                                    No artists found. Browse the artist directory to discover talent.
                                  </p>
                                )}
                              </div>

                              {/* Group SMS */}
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setGroupSmsDialogOpen(true)}
                                  className="gap-1.5"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                  Send Group Text
                                </Button>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            )}
            
            <div className="space-y-6">
              <BandAssistant />
            </div>
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
            {/* Availability Requests from Band Leaders */}
            <AvailabilityRequestResponder />
            
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
                            {invite.response_deadline && (
                              <GigResponseCountdown 
                                deadline={invite.response_deadline} 
                                className="mt-2"
                              />
                            )}
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

            <div className="space-y-6">
              <BandAssistant />
              <AcceptedGigsCard userId={user?.id || ""} />
            </div>

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
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Briefcase className="h-4 w-4 text-primary" />
                        Upcoming Gigs
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {filteredGigs.length > 0 ? `${filteredGigs.length} booked` : "No gigs yet"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Filter className="h-3 w-3 text-muted-foreground" />
                      <Label htmlFor="pending-gigs-filter" className="text-[10px] text-muted-foreground cursor-pointer">
                        Pending
                      </Label>
                      <Switch
                        id="pending-gigs-filter"
                        checked={showPendingGigsOnly}
                        onCheckedChange={setShowPendingGigsOnly}
                        className="scale-75"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {filteredGigs
                    .filter(gig => !showPendingGigsOnly || (gigResponseCounts[gig.id]?.pending > 0))
                    .slice(0, 2)
                    .map((gig) => (
                    <div key={gig.id} className="p-2 border rounded-md text-sm">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <CalendarIcon className="h-3 w-3" />
                        {new Date(gig.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </div>
                      <p className="font-medium truncate">{gig.venue}</p>
                      {gigResponseCounts[gig.id] && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {gigResponseCounts[gig.id].pending > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-yellow-50 text-yellow-700 border-yellow-200">
                              ⏳ {gigResponseCounts[gig.id].pending}
                            </Badge>
                          )}
                          {gigResponseCounts[gig.id].accepted > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-50 text-green-700 border-green-200">
                              ✅ {gigResponseCounts[gig.id].accepted}
                            </Badge>
                          )}
                          {gigResponseCounts[gig.id].declined > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-red-50 text-red-700 border-red-200">
                              ❌ {gigResponseCounts[gig.id].declined}
                            </Badge>
                          )}
                        </div>
                      )}
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
          <div className="space-y-6">
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Booking Manager Dashboard
                </CardTitle>
                <CardDescription>
                  Manage your roster and discover new talent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Button
                    variant="default"
                    onClick={() => navigate("/booking-manager")}
                    className="h-20 text-lg"
                  >
                    <UsersIcon className="mr-2 h-5 w-5" />
                    Manage Roster & Artists
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/artists")}
                    className="h-20 text-lg"
                  >
                    <Search className="mr-2 h-5 w-5" />
                    Discover New Artists
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Add bands to your roster, browse artists, and track locations during gigs!
                </p>
              </CardContent>
            </Card>

            {/* Availability Management for Booking Managers */}
            {managedBands.length > 0 && (
              <Card className="border-border/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    Band Availability Management
                  </CardTitle>
                  <CardDescription>
                    Request and view availability from band members
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {managedBands.length > 1 && (
                    <div className="flex items-center gap-4">
                      <label className="text-sm font-medium">Select Band:</label>
                      <select
                        value={selectedManagedBandId}
                        onChange={(e) => {
                          setSelectedManagedBandId(e.target.value);
                          setBmViewingRequestId(null);
                        }}
                        className="flex h-9 w-[280px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        {managedBands.map((band) => (
                          <option key={band.id} value={band.id}>
                            {band.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {managedBands.length === 1 && (
                    <p className="text-sm font-medium">Managing: {managedBands[0].name}</p>
                  )}

                  {selectedManagedBandId && (
                    <div className="grid lg:grid-cols-2 gap-6">
                      <AvailabilityRequestManager 
                        bandId={selectedManagedBandId}
                        onViewResponses={(requestId) => setBmViewingRequestId(requestId)}
                      />
                      {bmViewingRequestId && (
                        <AvailabilityRequestResults 
                          requestId={bmViewingRequestId}
                          onBack={() => setBmViewingRequestId(null)}
                        />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {userRole === "artist" && (
          <div className="space-y-6">
            {/* Availability Requests for Artists */}
            <AvailabilityRequestResponder />

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
                    onClick={() => navigate("/entertainers")}
                    className="h-20 text-lg"
                  >
                    <Music className="mr-2 h-5 w-5" />
                    Connect w/ Entertainers
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

        {userRole === "tour_manager" && (
          <div className="space-y-6">
            <Card className="border-border/50 shadow-lg bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  Tour/Road Manager Dashboard
                </CardTitle>
                <CardDescription>
                  Manage your tours and coordinate with crew members
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Button
                    variant="default"
                    onClick={() => navigate("/tours")}
                    className="h-12 text-sm"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Manage Tours
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/profile-setup")}
                    className="h-12 text-sm"
                  >
                    <UserIcon className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Create tours, invite crew members, and book tour gigs all in one place!
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
                    <span>Create tours and organize them by date range</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="secondary">2</Badge>
                    <span>Send invitation links to your crew members</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="secondary">3</Badge>
                    <span>Use "Book Tour Gig" to schedule tour performances</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="secondary">4</Badge>
                    <span>Track crew member responses and manage your roster</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {userRole !== "band_member" && userRole !== "artist" && (
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
        )}

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

      {/* Artist Profile Dialog removed — clicking a performer now navigates to /artist-profile/:id */}

      {/* Gig Request Dialog */}
      <Dialog open={gigRequestDialogOpen} onOpenChange={setGigRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Gig Request</DialogTitle>
            <DialogDescription>
              Enter gig details to create a new booking
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gig-request-message">Gig Details</Label>
              <Textarea
                id="gig-request-message"
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Enter gig details (venue, date, time, requirements, etc.)"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGigRequestDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (smsMessage.trim()) {
                  setGigRequestDialogOpen(false);
                  navigate(`/bookings?newGig=true&details=${encodeURIComponent(smsMessage)}`);
                  setSmsMessage("");
                } else {
                  toast({
                    title: "Error",
                    description: "Please enter gig details",
                    variant: "destructive",
                  });
                }
              }}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Create Gig
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
