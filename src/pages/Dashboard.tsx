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
import { Music, Briefcase, MapPin, Calendar as CalendarIcon, Crown, LogOut, ListMusic, User as UserIcon, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import { BandAssistant } from "@/components/BandAssistant";
import { LivePresence } from "@/components/LivePresence";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { AutoLocationTracker } from "@/components/AutoLocationTracker";
import { MemberLocationsMap } from "@/components/MemberLocationsMap";
import { AcceptedGigsCard } from "@/components/AcceptedGigsCard";
import { Checkbox } from "@/components/ui/checkbox";
import { BookingManagerClientLocations } from "@/components/BookingManagerClientLocations";
import { BandMemberRoster } from "@/components/BandMemberRoster";

interface Profile {
  id: string;
  name: string;
  bio: string;
  instrument: string;
  photo_urls: string[];
  location_lat: number;
  location_lng: number;
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

type UserRole = "band_leader" | "band_member" | "booking_manager";

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
          .in("role", ["band_leader", "band_member"]);
        
        if (bandLeaders && bandLeaders.length > 0) {
          const userIds = bandLeaders.map(r => r.user_id);
          const { data: bandProfiles } = await supabase
            .from("profiles")
            .select("*")
            .in("id", userIds);
          
          setProfiles(bandProfiles || []);
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
                  : "Band Member"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LivePresence />
            <Button variant="outline" onClick={() => navigate("/profile-setup")}>
              Profile
            </Button>
            <Button variant="destructive" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

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
          </div>
        )}

        {userRole === "band_member" && (
          <>
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
          </>
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

            {selectedBandId && (
              <Card
                className="border-border/50 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => navigate("/setlist")}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ListMusic className="h-4 w-4 text-primary" />
                    Setlists
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Manage your band's setlists
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    View and manage setlists for this band
                  </p>
                </CardContent>
              </Card>
            )}

            {userRole === "band_member" && (
              <Card className="border-border/50 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-4 w-4 text-primary" />
                    Location Sharing
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Share your location with band members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <AutoLocationTracker
                      userId={user?.id || ""}
                      isEnabled={activeGigsWithSharing.length > 0}
                    />

                    <div>
                      <Label htmlFor="location" className="text-sm">Use GPS Location</Label>
                      <Button
                        onClick={handleShareLocation}
                        disabled={isSharingLocation}
                        className="w-full mt-2"
                        size="sm"
                      >
                        {isSharingLocation ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Getting location...
                          </>
                        ) : (
                          <>
                            <MapPin className="h-4 w-4 mr-2" />
                            Share My Location
                          </>
                        )}
                      </Button>
                    </div>

                    <div>
                      <Label htmlFor="manual-location" className="text-sm">Or Enter Address Manually</Label>
                      <div className="flex gap-2 mt-2">
                        <PlaceAutocomplete
                          value={manualLocation}
                          onChange={(value, place) => {
                            setManualLocation(value);
                            setSelectedPlace(place || null);
                          }}
                          placeholder="Enter your address..."
                        />
                        <Button
                          onClick={handleManualLocationSave}
                          disabled={isSavingManualLocation || !selectedPlace}
                          size="sm"
                        >
                          {isSavingManualLocation ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {userRole === "booking_manager" && (
          <>
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-primary" />
                  Available Bands
                </CardTitle>
                <CardDescription>Browse and connect with bands</CardDescription>
              </CardHeader>
              <CardContent>
                {profiles.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No bands available at the moment
                  </p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {profiles.map((bandProfile) => (
                      <Card key={bandProfile.id} className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={bandProfile.photo_urls?.[0]} alt={bandProfile.name} />
                            <AvatarFallback>{bandProfile.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold">{bandProfile.name}</h4>
                            {bandProfile.instrument && (
                              <p className="text-sm text-muted-foreground">{bandProfile.instrument}</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <BookingManagerClientLocations />
          </>
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

      <BottomNav />
    </div>
  );
};

export default Dashboard;
