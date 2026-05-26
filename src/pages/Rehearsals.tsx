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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Clock, MapPin, Plus, Trash2, Navigation, Pencil } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";

interface Rehearsal {
  id: string;
  date: string;
  venue: string;
  notes: string | null;
  attire: string | null;
  food_provided: string | null;
  venue_contact_person: string | null;
  sound_man_info: string | null;
  end_time: string | null;
  band_leader_id: string;
  venue_lat: number | null;
  venue_lng: number | null;
}

const Rehearsals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedBandId } = useBand();
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [date, setDate] = useState<Date>();
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("14:00");
  const [venue, setVenue] = useState("");
  const [venueLat, setVenueLat] = useState<number | null>(null);
  const [venueLng, setVenueLng] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [foodProvided, setFoodProvided] = useState("");
  const [venueContactPerson, setVenueContactPerson] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editingRehearsal, setEditingRehearsal] = useState<Rehearsal | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDate, setEditDate] = useState<Date>();
  const [editStartTime, setEditStartTime] = useState("12:00");
  const [editEndTime, setEditEndTime] = useState("14:00");
  const [editVenue, setEditVenue] = useState("");
  const [editVenueLat, setEditVenueLat] = useState<number | null>(null);
  const [editVenueLng, setEditVenueLng] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editFoodProvided, setEditFoodProvided] = useState("");
  const [editVenueContactPerson, setEditVenueContactPerson] = useState("");

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
    
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

    // Fetch rehearsals filtered by selected band
    let query = supabase
      .from("rehearsals")
      .select("*")
      .order("date", { ascending: true });
    
    if (selectedBandId) {
      query = query.eq("band_id", selectedBandId);
    }
    
    const { data: rehearsalData } = await query;

    setRehearsals(rehearsalData || []);
    setLoading(false);
  };

  const handleAddRehearsal = async () => {
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
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      // Combine date and time
      const [hours, minutes] = startTime.split(":").map(Number);
      const rehearsalDateTime = new Date(date);
      rehearsalDateTime.setHours(hours, minutes, 0, 0);

      if (!selectedBandId) {
        toast({
          variant: "destructive",
          title: "No band selected",
          description: "Please select a band from the dashboard first.",
        });
        return;
      }

      const { error } = await supabase
        .from("rehearsals")
        .insert({
          band_leader_id: user.id,
          band_id: selectedBandId,
          date: rehearsalDateTime.toISOString(),
          end_time: endTime,
          venue: venue.trim(),
          venue_lat: venueLat,
          venue_lng: venueLng,
          notes: notes.trim() || null,
          food_provided: foodProvided.trim() || null,
          venue_contact_person: venueContactPerson.trim() || null,
        });

      if (error) throw error;

      toast({
        title: "Rehearsal added",
        description: "The rehearsal has been scheduled successfully.",
      });

      // Reset form and refresh data
      setDate(undefined);
      setStartTime("12:00");
      setEndTime("14:00");
      setVenue("");
      setVenueLat(null);
      setVenueLng(null);
      setNotes("");
      setFoodProvided("");
      setVenueContactPerson("");
      checkAuthAndFetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to add rehearsal",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRehearsal = async (id: string) => {
    try {
      const { error } = await supabase
        .from("rehearsals")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Rehearsal deleted",
        description: "The rehearsal has been removed.",
      });

      checkAuthAndFetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to delete rehearsal",
        description: error.message,
      });
    }
  };

  const openEditDialog = (rehearsal: Rehearsal) => {
    setEditingRehearsal(rehearsal);
    const rehearsalDate = new Date(rehearsal.date);
    setEditDate(rehearsalDate);
    setEditStartTime(format(rehearsalDate, "HH:mm"));
    setEditEndTime(rehearsal.end_time || "14:00");
    setEditVenue(rehearsal.venue);
    setEditVenueLat(rehearsal.venue_lat);
    setEditVenueLng(rehearsal.venue_lng);
    setEditNotes(rehearsal.notes || "");
    setEditFoodProvided(rehearsal.food_provided || "");
    setEditVenueContactPerson(rehearsal.venue_contact_person || "");
    setEditDialogOpen(true);
  };

  const handleUpdateRehearsal = async () => {
    if (!editingRehearsal || !editDate || !editVenue.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a date and enter a venue.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const [hours, minutes] = editStartTime.split(":").map(Number);
      const rehearsalDateTime = new Date(editDate);
      rehearsalDateTime.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from("rehearsals")
        .update({
          date: rehearsalDateTime.toISOString(),
          end_time: editEndTime,
          venue: editVenue.trim(),
          venue_lat: editVenueLat,
          venue_lng: editVenueLng,
          notes: editNotes.trim() || null,
          food_provided: editFoodProvided.trim() || null,
          venue_contact_person: editVenueContactPerson.trim() || null,
        })
        .eq("id", editingRehearsal.id);

      if (error) throw error;

      toast({
        title: "Rehearsal updated",
        description: "The rehearsal has been updated successfully.",
      });

      setEditDialogOpen(false);
      setEditingRehearsal(null);
      checkAuthAndFetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update rehearsal",
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
              Rehearsals
            </h1>
            <p className="text-muted-foreground mt-1">
              {isBandLeader ? "Manage your band's rehearsal schedule" : "View upcoming rehearsals"}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>

        {isBandLeader && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Schedule New Rehearsal
              </CardTitle>
              <CardDescription>Add a new rehearsal to your calendar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {date ? format(date, "MM/dd/yy") : <span>Pick date</span>}
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

                <div className="space-y-1">
                  <Label htmlFor="startTime" className="text-xs">Start</Label>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="endTime" className="text-xs">End</Label>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="venueContactPerson" className="text-xs">Contact (Optional)</Label>
                  <Input
                    id="venueContactPerson"
                    placeholder="John, 555-1234"
                    value={venueContactPerson}
                    onChange={(e) => setVenueContactPerson(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="venue" className="text-xs">Venue</Label>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <PlaceAutocomplete
                      value={venue}
                      onChange={(value, placeDetails) => {
                        setVenue(value);
                        if (placeDetails?.geometry?.location) {
                          setVenueLat(placeDetails.geometry.location.lat());
                          setVenueLng(placeDetails.geometry.location.lng());
                        }
                      }}
                      placeholder="Venue name or address..."
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="foodProvided" className="text-xs">Food Provided (Optional)</Label>
                  <Input
                    id="foodProvided"
                    placeholder="e.g., Dinner included"
                    value={foodProvided}
                    onChange={(e) => setFoodProvided(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs">Notes (Optional)</Label>
                <Input
                  id="notes"
                  placeholder="Any additional info..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9"
                />
              </div>

              <Button onClick={handleAddRehearsal} disabled={isSubmitting} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Rehearsal
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Scheduled Rehearsals
            </CardTitle>
            <CardDescription>Upcoming rehearsal sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {rehearsals.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No rehearsals scheduled yet
              </p>
            ) : (
              <div className="space-y-3">
                {rehearsals.map((rehearsal) => (
                  <div key={rehearsal.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            {format(new Date(rehearsal.date), "PPP")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(new Date(rehearsal.date), "p")}
                            {rehearsal.end_time && ` - ${rehearsal.end_time}`}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">{rehearsal.venue}</h4>
                          {rehearsal.venue_lat && rehearsal.venue_lng && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => {
                                const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${rehearsal.venue_lat},${rehearsal.venue_lng}`;
                                window.open(mapsUrl, '_blank');
                              }}
                            >
                              <Navigation className="h-3 w-3 mr-1" />
                              Navigate
                            </Button>
                          )}
                          {rehearsal.notes && (
                            <span className="text-sm text-muted-foreground">• {rehearsal.notes}</span>
                          )}
                        </div>
                        {(rehearsal.food_provided || rehearsal.venue_contact_person) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            {rehearsal.food_provided && (
                              <span><span className="font-medium">Food:</span> {rehearsal.food_provided}</span>
                            )}
                            {rehearsal.venue_contact_person && (
                              <span><span className="font-medium">Contact:</span> {rehearsal.venue_contact_person}</span>
                            )}
                          </div>
                        )}
                      </div>
                      {isBandLeader && (
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(rehearsal)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRehearsal(rehearsal.id)}
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

      {/* Edit Rehearsal Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Rehearsal</DialogTitle>
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
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
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

            <div className="space-y-2">
              <Label>Venue</Label>
              <PlaceAutocomplete
                value={editVenue}
                onChange={(value, placeDetails) => {
                  setEditVenue(value);
                  if (placeDetails?.geometry?.location) {
                    setEditVenueLat(placeDetails.geometry.location.lat());
                    setEditVenueLng(placeDetails.geometry.location.lng());
                  }
                }}
                placeholder="Start typing a venue..."
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
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

            <Button onClick={handleUpdateRehearsal} disabled={isSubmitting} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Rehearsals;
