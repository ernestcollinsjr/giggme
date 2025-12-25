import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBand } from "@/contexts/BandContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Clock, MapPin, Plus, Trash2, Music, Navigation, Users, Send, Pencil } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { GigTemplateSelector } from "@/components/GigTemplateSelector";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface Gig {
  id: string;
  date: string;
  venue: string;
  venue_name: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  notes: string | null;
  attire: string | null;
  food_provided: string | null;
  venue_contact_person: string | null;
  sound_man_info: string | null;
  end_time: string | null;
  loading_time: string | null;
  sound_check_time: string | null;
  status: string;
  user_id: string;
}

interface BandMember {
  id: string;
  name: string;
  email: string;
  instrument: string | null;
}

const Bookings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedBandId, setSelectedBandId } = useBand();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [bands, setBands] = useState<{ id: string; name: string }[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [currentGigForInvite, setCurrentGigForInvite] = useState<string | null>(null);
  
  // Form state
  const [date, setDate] = useState<Date>();
  const [showTime, setShowTime] = useState("19:00");
  const [endTime, setEndTime] = useState("23:00");
  const [loadingTime, setLoadingTime] = useState("");
  const [soundCheckTime, setSoundCheckTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venue, setVenue] = useState("");
  const [venueLat, setVenueLat] = useState<number | null>(null);
  const [venueLng, setVenueLng] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [attire, setAttire] = useState("");
  const [foodProvided, setFoodProvided] = useState("");
  const [venueContactPerson, setVenueContactPerson] = useState("");
  const [soundManInfo, setSoundManInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit gig state
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDate, setEditDate] = useState<Date>();
  const [editShowTime, setEditShowTime] = useState("19:00");
  const [editEndTime, setEditEndTime] = useState("23:00");
  const [editLoadingTime, setEditLoadingTime] = useState("");
  const [editSoundCheckTime, setEditSoundCheckTime] = useState("");
  const [editVenueName, setEditVenueName] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editVenueLat, setEditVenueLat] = useState<number | null>(null);
  const [editVenueLng, setEditVenueLng] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editAttire, setEditAttire] = useState("");
  const [editFoodProvided, setEditFoodProvided] = useState("");
  const [editVenueContactPerson, setEditVenueContactPerson] = useState("");
  const [editSoundManInfo, setEditSoundManInfo] = useState("");

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    setUserRole(roleData?.role || null);

    // Fetch bands for band leaders
    if (roleData?.role === "band_leader") {
      const { data: bandsData } = await supabase
        .from("bands")
        .select("id, name")
        .eq("band_leader_id", user.id)
        .order("created_at", { ascending: true });
      
      setBands(bandsData || []);
      
      // Auto-select first band if none selected
      if (bandsData && bandsData.length > 0 && !selectedBandId) {
        setSelectedBandId(bandsData[0].id);
      }
      
      // Validate selected band exists
      if (selectedBandId) {
        const bandExists = bandsData?.some(b => b.id === selectedBandId);
        if (!bandExists) {
          setSelectedBandId(bandsData?.[0]?.id || null);
        }
      }
    }

    // Fetch gigs filtered by selected band
    let query = supabase
      .from("gigs")
      .select("*")
      .order("date", { ascending: true });
    
    if (selectedBandId) {
      query = query.eq("band_id", selectedBandId);
    }
    
    const { data: gigData } = await query;

    setGigs((gigData as unknown as Gig[]) || []);
    
    // Fetch band members if a band is selected
    if (selectedBandId && roleData?.role === "band_leader") {
      const { data: membersData } = await supabase
        .from("profiles")
        .select("id, name, email, instrument")
        .neq("id", user.id); // Exclude the band leader
      
      setBandMembers((membersData as BandMember[]) || []);
    }
    
    setLoading(false);
  };

  const handleAddGig = async () => {
    if (!date || !venue.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a date and enter a venue.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!selectedBandId) {
        toast({
          variant: "destructive",
          title: "No band selected",
          description: "Please select a band from the dashboard first.",
        });
        return;
      }

      // Combine date and time
      const [hours, minutes] = showTime.split(":").map(Number);
      const gigDateTime = new Date(date);
      gigDateTime.setHours(hours, minutes, 0, 0);

      const { data: newGig, error } = await supabase
        .from("gigs")
        .insert({
          user_id: user.id,
          band_id: selectedBandId,
          date: gigDateTime.toISOString(),
          end_time: endTime,
          loading_time: loadingTime.trim() || null,
          sound_check_time: soundCheckTime.trim() || null,
          venue_name: venueName.trim() || null,
          venue: venue.trim(),
          venue_lat: venueLat,
          venue_lng: venueLng,
          notes: notes.trim() || null,
          attire: attire.trim() || null,
          food_provided: foodProvided.trim() || null,
          venue_contact_person: venueContactPerson.trim() || null,
          sound_man_info: soundManInfo.trim() || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-invite selected members
      if (selectedMembers.length > 0 && newGig) {
        const invites = selectedMembers.map(memberId => ({
          gig_id: newGig.id,
          member_id: memberId,
          status: 'pending',
        }));

        const { error: inviteError } = await supabase
          .from("gig_members")
          .insert(invites);

        if (inviteError) throw inviteError;

        toast({
          title: "Gig added & invites sent",
          description: `Successfully scheduled gig and invited ${selectedMembers.length} member(s).`,
        });
      } else {
        toast({
          title: "Gig added",
          description: "The gig has been scheduled successfully.",
        });
      }

      // Reset form and refresh data
      setDate(undefined);
      setShowTime("19:00");
      setEndTime("23:00");
      setLoadingTime("");
      setSoundCheckTime("");
      setVenueName("");
      setVenue("");
      setVenueLat(null);
      setVenueLng(null);
      setNotes("");
      setAttire("");
      setFoodProvided("");
      setVenueContactPerson("");
      setSoundManInfo("");
      setSelectedMembers([]);
      checkAuthAndFetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to add gig",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteMembers = async () => {
    if (!currentGigForInvite || selectedMembers.length === 0) {
      toast({
        variant: "destructive",
        title: "No members selected",
        description: "Please select at least one band member to invite.",
      });
      return;
    }

    try {
      // Check for existing invitations to avoid duplicates
      const { data: existingInvites } = await supabase
        .from("gig_members")
        .select("member_id")
        .eq("gig_id", currentGigForInvite)
        .in("member_id", selectedMembers);

      const alreadyInvitedIds = new Set(existingInvites?.map(i => i.member_id) || []);
      const newMembers = selectedMembers.filter(id => !alreadyInvitedIds.has(id));

      if (newMembers.length === 0) {
        toast({
          variant: "destructive",
          title: "Already invited",
          description: "All selected members have already been invited to this gig.",
        });
        return;
      }

      const invites = newMembers.map(memberId => ({
        gig_id: currentGigForInvite,
        member_id: memberId,
        status: 'pending',
      }));

      const { error } = await supabase
        .from("gig_members")
        .insert(invites);

      if (error) throw error;

      const skippedCount = selectedMembers.length - newMembers.length;
      toast({
        title: "Invitations sent",
        description: skippedCount > 0 
          ? `Invited ${newMembers.length} member(s). ${skippedCount} already invited.`
          : `Successfully invited ${newMembers.length} member(s) to the gig.`,
      });

      setInviteDialogOpen(false);
      setSelectedMembers([]);
      setCurrentGigForInvite(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send invitations",
        description: error.message,
      });
    }
  };

  const handleDeleteGig = async (id: string) => {
    try {
      const { error } = await supabase
        .from("gigs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Gig deleted",
        description: "The gig has been removed.",
      });

      checkAuthAndFetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to delete gig",
        description: error.message,
      });
    }
  };

  const openEditGigDialog = (gig: Gig) => {
    setEditingGig(gig);
    const gigDate = new Date(gig.date);
    setEditDate(gigDate);
    setEditShowTime(format(gigDate, "HH:mm"));
    setEditEndTime(gig.end_time || "23:00");
    setEditLoadingTime(gig.loading_time || "");
    setEditSoundCheckTime(gig.sound_check_time || "");
    setEditVenueName(gig.venue_name || "");
    setEditVenue(gig.venue);
    setEditVenueLat(gig.venue_lat);
    setEditVenueLng(gig.venue_lng);
    setEditNotes(gig.notes || "");
    setEditAttire(gig.attire || "");
    setEditFoodProvided(gig.food_provided || "");
    setEditVenueContactPerson(gig.venue_contact_person || "");
    setEditSoundManInfo(gig.sound_man_info || "");
    setEditDialogOpen(true);
  };

  const handleUpdateGig = async () => {
    if (!editingGig || !editDate || !editVenue.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a date and enter a venue.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const [hours, minutes] = editShowTime.split(":").map(Number);
      const gigDateTime = new Date(editDate);
      gigDateTime.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from("gigs")
        .update({
          date: gigDateTime.toISOString(),
          end_time: editEndTime,
          loading_time: editLoadingTime.trim() || null,
          sound_check_time: editSoundCheckTime.trim() || null,
          venue_name: editVenueName.trim() || null,
          venue: editVenue.trim(),
          venue_lat: editVenueLat,
          venue_lng: editVenueLng,
          notes: editNotes.trim() || null,
          attire: editAttire.trim() || null,
          food_provided: editFoodProvided.trim() || null,
          venue_contact_person: editVenueContactPerson.trim() || null,
          sound_man_info: editSoundManInfo.trim() || null,
        })
        .eq("id", editingGig.id);

      if (error) throw error;

      toast({
        title: "Gig updated",
        description: "The gig has been updated successfully.",
      });

      setEditDialogOpen(false);
      setEditingGig(null);
      checkAuthAndFetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update gig",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const isBandLeader = userRole === "band_leader";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 pb-20">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Gigs & Bookings
            </h1>
            <p className="text-muted-foreground mt-1">
              {isBandLeader ? "Manage your band's performance schedule" : "View upcoming gigs"}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>

        {isBandLeader && bands.length > 0 && (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Label htmlFor="band-select" className="text-sm font-medium whitespace-nowrap">
                  Current Band:
                </Label>
                <Select value={selectedBandId || undefined} onValueChange={setSelectedBandId}>
                  <SelectTrigger id="band-select" className="w-full max-w-sm">
                    <SelectValue placeholder="Select a band" />
                  </SelectTrigger>
                  <SelectContent>
                    {bands.map((band) => (
                      <SelectItem key={band.id} value={band.id}>
                        {band.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {isBandLeader && bands.length === 0 && (
          <Card className="border-border/50 shadow-lg bg-gradient-to-br from-destructive/5 to-destructive/10">
            <CardContent className="pt-6 text-center">
              <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Bands Created</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You need to create a band first before you can add gigs.
              </p>
              <Button onClick={() => navigate("/dashboard")}>
                Go to Dashboard to Create Band
              </Button>
            </CardContent>
          </Card>
        )}

        {isBandLeader && selectedBandId && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Schedule New Gig
              </CardTitle>
              <CardDescription>Add a new performance to your calendar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GigTemplateSelector
                currentValues={{
                  venueName,
                  venue,
                  venueLat,
                  venueLng,
                  showTime,
                  endTime,
                  loadingTime,
                  soundCheckTime,
                  attire,
                  foodProvided,
                  venueContactPerson,
                  soundManInfo,
                  notes,
                }}
                onSelectTemplate={(values) => {
                  setVenueName(values.venueName);
                  setVenue(values.venue);
                  setVenueLat(values.venueLat);
                  setVenueLng(values.venueLng);
                  setShowTime(values.showTime);
                  setEndTime(values.endTime);
                  setLoadingTime(values.loadingTime);
                  setSoundCheckTime(values.soundCheckTime);
                  setAttire(values.attire);
                  setFoodProvided(values.foodProvided);
                  setVenueContactPerson(values.venueContactPerson);
                  setSoundManInfo(values.soundManInfo);
                  setNotes(values.notes);
                }}
              />
              
              <div className="space-y-2">
                <Label htmlFor="venueName">Venue Name (Optional)</Label>
                <Input
                  id="venueName"
                  placeholder="e.g., Blue Note Jazz Club, City Arena..."
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue">Venue Address</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <PlaceAutocomplete
                    value={venue}
                    onChange={async (value, placeDetails) => {
                      setVenue(value);
                      let lat: number | null = null;
                      let lng: number | null = null;
                      let placeName: string | null = null;
                      
                      if (placeDetails?.geometry?.location) {
                        lat = placeDetails.geometry.location.lat();
                        lng = placeDetails.geometry.location.lng();
                        setVenueLat(lat);
                        setVenueLng(lng);
                      }
                      
                      // Extract venue name from place details
                      if (placeDetails?.name) {
                        placeName = placeDetails.name;
                        setVenueName(placeName);
                      }
                      
                      // Auto-save as template if venue has coordinates
                      if (value && lat && lng) {
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) return;
                          
                          // Check if template already exists for this venue
                          const { data: existingTemplates } = await supabase
                            .from("gig_templates")
                            .select("id")
                            .eq("user_id", user.id)
                            .eq("venue", value)
                            .limit(1);
                          
                          // Only create if no existing template
                          if (!existingTemplates || existingTemplates.length === 0) {
                            await supabase.from("gig_templates").insert({
                              user_id: user.id,
                              name: placeName || value.split(",")[0],
                              venue: value,
                              venue_name: placeName,
                              venue_lat: lat,
                              venue_lng: lng,
                            });
                            
                            toast({
                              title: "Venue saved",
                              description: "This venue has been saved as a template for quick access.",
                            });
                          }
                        } catch (error) {
                          console.error("Failed to auto-save template:", error);
                        }
                      }
                    }}
                    placeholder="Start typing a venue address..."
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="showTime">Show Time</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="showTime"
                        type="time"
                        value={showTime}
                        onChange={(e) => setShowTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loadingTime">Load-in Time (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="loadingTime"
                      type="time"
                      value={loadingTime}
                      onChange={(e) => setLoadingTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="soundCheckTime">Sound Check Time (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="soundCheckTime"
                      type="time"
                      value={soundCheckTime}
                      onChange={(e) => setSoundCheckTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Performance details, setlist info, special requirements..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attire">Attire (Optional)</Label>
                <Input
                  id="attire"
                  placeholder="e.g., Black tie, Casual, Band uniform..."
                  value={attire}
                  onChange={(e) => setAttire(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="foodProvided">Food Provided (Optional)</Label>
                <Input
                  id="foodProvided"
                  placeholder="e.g., Dinner included, Refreshments only..."
                  value={foodProvided}
                  onChange={(e) => setFoodProvided(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venueContactPerson">Venue Contact Person (Optional)</Label>
                <Input
                  id="venueContactPerson"
                  placeholder="e.g., John Smith, 555-1234..."
                  value={venueContactPerson}
                  onChange={(e) => setVenueContactPerson(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="soundManInfo">Sound Man Information (Optional)</Label>
                <Input
                  id="soundManInfo"
                  placeholder="e.g., Mike Johnson, 555-5678..."
                  value={soundManInfo}
                  onChange={(e) => setSoundManInfo(e.target.value)}
                />
              </div>

              <div className="space-y-3 pt-4 border-t">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Invite Band Members (Optional)
                </Label>
                {bandMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No band members available to invite</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                    {bandMembers.map((member) => (
                      <div key={member.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`invite-${member.id}`}
                          checked={selectedMembers.includes(member.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedMembers([...selectedMembers, member.id]);
                            } else {
                              setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={`invite-${member.id}`}
                          className="text-sm flex-1 cursor-pointer"
                        >
                          {member.name}
                          {member.instrument && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({member.instrument})
                            </span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleAddGig} disabled={isSubmitting} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Gig {selectedMembers.length > 0 && `& Invite ${selectedMembers.length}`}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              Scheduled Gigs
            </CardTitle>
            <CardDescription>Upcoming performances and bookings</CardDescription>
          </CardHeader>
          <CardContent>
            {gigs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No gigs scheduled yet
              </p>
            ) : (
              <div className="space-y-3">
                {gigs.map((gig) => (
                  <div key={gig.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={gig.status === 'confirmed' ? 'default' : 'secondary'}>
                            {gig.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(gig.date), "PPP")}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Clock className="h-4 w-4" />
                          {format(new Date(gig.date), "p")}
                          {gig.end_time && ` - ${gig.end_time}`}
                        </div>
                        {gig.loading_time && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">Load-in:</span> {gig.loading_time}
                          </div>
                        )}
                        {gig.sound_check_time && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">Sound Check:</span> {gig.sound_check_time}
                          </div>
                        )}
                        {gig.venue_name && (
                          <h3 className="font-bold text-lg mb-2">{gig.venue_name}</h3>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">{gig.venue}</h4>
                          {(gig.venue_lat && gig.venue_lng) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${gig.venue_lat},${gig.venue_lng}`;
                                window.open(mapsUrl, '_blank');
                              }}
                            >
                              <Navigation className="h-4 w-4 mr-1" />
                              Navigate
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gig.venue)}`;
                                window.open(mapsUrl, '_blank');
                              }}
                            >
                              <Navigation className="h-4 w-4 mr-1" />
                              Search
                            </Button>
                          )}
                        </div>
                        {gig.notes && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {gig.notes}
                          </p>
                        )}
                        {gig.attire && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">Attire:</span> {gig.attire}
                          </p>
                        )}
                        {gig.food_provided && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">Food Provided:</span> {gig.food_provided}
                          </p>
                        )}
                        {gig.venue_contact_person && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">Venue Contact Person:</span> {gig.venue_contact_person}
                          </p>
                        )}
                        {gig.sound_man_info && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">Sound Man Information:</span> {gig.sound_man_info}
                          </p>
                        )}
                      </div>
                      {isBandLeader && (
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditGigDialog(gig)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Dialog open={inviteDialogOpen && currentGigForInvite === gig.id} onOpenChange={(open) => {
                            setInviteDialogOpen(open);
                            if (!open) {
                              setCurrentGigForInvite(null);
                              setSelectedMembers([]);
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCurrentGigForInvite(gig.id);
                                  setInviteDialogOpen(true);
                                }}
                              >
                                <Users className="h-4 w-4 mr-2" />
                                Invite Members
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Invite Band Members</DialogTitle>
                                <DialogDescription>
                                  Select band members to invite to this gig
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                {bandMembers.length === 0 ? (
                                  <p className="text-sm text-muted-foreground text-center py-4">
                                    No other band members found. Members need to sign up first.
                                  </p>
                                ) : (
                                  bandMembers.map((member) => (
                                    <div key={member.id} className="flex items-center space-x-3">
                                      <Checkbox
                                        id={member.id}
                                        checked={selectedMembers.includes(member.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSelectedMembers([...selectedMembers, member.id]);
                                          } else {
                                            setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                                          }
                                        }}
                                      />
                                      <label
                                        htmlFor={member.id}
                                        className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                      >
                                        <div>
                                          <p className="font-semibold">{member.name}</p>
                                          <p className="text-xs text-muted-foreground">{member.email}</p>
                                          {member.instrument && (
                                            <p className="text-xs text-muted-foreground">{member.instrument}</p>
                                          )}
                                        </div>
                                      </label>
                                    </div>
                                  ))
                                )}
                              </div>
                              {bandMembers.length > 0 && (
                                <Button onClick={handleInviteMembers} className="w-full">
                                  <Send className="h-4 w-4 mr-2" />
                                  Send Invitations ({selectedMembers.length})
                                </Button>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteGig(gig.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Gig Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Gig</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? format(editDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editDate}
                    onSelect={setEditDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Show Time</Label>
                <Input
                  type="time"
                  value={editShowTime}
                  onChange={(e) => setEditShowTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Load-in Time</Label>
                <Input
                  type="time"
                  value={editLoadingTime}
                  onChange={(e) => setEditLoadingTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sound Check</Label>
                <Input
                  type="time"
                  value={editSoundCheckTime}
                  onChange={(e) => setEditSoundCheckTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Venue Name</Label>
              <Input
                value={editVenueName}
                onChange={(e) => setEditVenueName(e.target.value)}
                placeholder="e.g., Blue Note Jazz Club"
              />
            </div>

            <div className="space-y-2">
              <Label>Venue Address</Label>
              <PlaceAutocomplete
                value={editVenue}
                onChange={(value, placeDetails) => {
                  setEditVenue(value);
                  if (placeDetails?.geometry?.location) {
                    setEditVenueLat(placeDetails.geometry.location.lat());
                    setEditVenueLng(placeDetails.geometry.location.lng());
                  }
                }}
                placeholder="Start typing an address..."
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Attire</Label>
              <Input
                value={editAttire}
                onChange={(e) => setEditAttire(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Food Provided</Label>
              <Input
                value={editFoodProvided}
                onChange={(e) => setEditFoodProvided(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Venue Contact Person</Label>
              <Input
                value={editVenueContactPerson}
                onChange={(e) => setEditVenueContactPerson(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Sound Man Info</Label>
              <Input
                value={editSoundManInfo}
                onChange={(e) => setEditSoundManInfo(e.target.value)}
              />
            </div>

            <Button onClick={handleUpdateGig} disabled={isSubmitting} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Bookings;
