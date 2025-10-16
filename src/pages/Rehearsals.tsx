import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Clock, MapPin, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";

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
}

const Rehearsals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [date, setDate] = useState<Date>();
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("14:00");
  const [venue, setVenue] = useState("");
  const [notes, setNotes] = useState("");
  const [foodProvided, setFoodProvided] = useState("");
  const [venueContactPerson, setVenueContactPerson] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    // Fetch rehearsals
    const { data: rehearsalData } = await supabase
      .from("rehearsals")
      .select("*")
      .order("date", { ascending: true });

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Combine date and time
      const [hours, minutes] = startTime.split(":").map(Number);
      const rehearsalDateTime = new Date(date);
      rehearsalDateTime.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from("rehearsals")
        .insert({
          band_leader_id: user.id,
          date: rehearsalDateTime.toISOString(),
          end_time: endTime,
          venue: venue.trim(),
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
            <CardContent className="space-y-4">
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
                    <Label htmlFor="startTime">Start Time</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="startTime"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
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

              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="venue"
                    placeholder="e.g., Studio A, Main Hall, etc."
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional information or reminders..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
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
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(rehearsal.date), "PPP")}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Clock className="h-4 w-4" />
                          {format(new Date(rehearsal.date), "p")}
                          {rehearsal.end_time && ` - ${rehearsal.end_time}`}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">{rehearsal.venue}</h4>
                        </div>
                        {rehearsal.notes && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {rehearsal.notes}
                          </p>
                        )}
                        {rehearsal.food_provided && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">Food Provided:</span> {rehearsal.food_provided}
                          </p>
                        )}
                        {rehearsal.venue_contact_person && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">Venue Contact Person:</span> {rehearsal.venue_contact_person}
                          </p>
                        )}
                      </div>
                      {isBandLeader && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRehearsal(rehearsal.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default Rehearsals;
