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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Clock, MapPin, Plus, Trash2, Music } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";

interface Gig {
  id: string;
  date: string;
  venue: string;
  notes: string | null;
  attire: string | null;
  food_provided: string | null;
  status: string;
  user_id: string;
}

const Bookings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("19:00");
  const [venue, setVenue] = useState("");
  const [notes, setNotes] = useState("");
  const [attire, setAttire] = useState("");
  const [foodProvided, setFoodProvided] = useState("");
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

    // Fetch gigs
    const { data: gigData } = await supabase
      .from("gigs")
      .select("*")
      .order("date", { ascending: true });

    setGigs(gigData || []);
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

      // Combine date and time
      const [hours, minutes] = time.split(":").map(Number);
      const gigDateTime = new Date(date);
      gigDateTime.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from("gigs")
        .insert({
          user_id: user.id,
          date: gigDateTime.toISOString(),
          venue: venue.trim(),
          notes: notes.trim() || null,
          attire: attire.trim() || null,
          food_provided: foodProvided.trim() || null,
          status: "pending",
        });

      if (error) throw error;

      toast({
        title: "Gig added",
        description: "The gig has been scheduled successfully.",
      });

      // Reset form and refresh data
      setDate(undefined);
      setTime("19:00");
      setVenue("");
      setNotes("");
      setAttire("");
      setFoodProvided("");
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

        {isBandLeader && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Schedule New Gig
              </CardTitle>
              <CardDescription>Add a new performance to your calendar</CardDescription>
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

                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="venue"
                    placeholder="e.g., Blue Note Jazz Club, City Arena, etc."
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                  />
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

              <Button onClick={handleAddGig} disabled={isSubmitting} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Gig
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
                          {format(new Date(gig.date), "PPP 'at' p")}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">{gig.venue}</h4>
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
                      </div>
                      {isBandLeader && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteGig(gig.id)}
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

export default Bookings;
