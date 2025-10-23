import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Calendar as CalendarIconLucide, Mail, MapPin } from "lucide-react";
import { format } from "date-fns";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Tour {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  tour_crew_members?: Array<{
    crew_type: 'band_members' | 'singer' | 'sound_crew' | 'lighting_crew';
    status: string;
  }>;
}

export default function Tours() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bookGigDialogOpen, setBookGigDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: ""
  });

  // Gig booking form state
  const [gigDate, setGigDate] = useState<Date>();
  const [showTime, setShowTime] = useState("19:00");
  const [endTime, setEndTime] = useState("23:00");
  const [loadingTime, setLoadingTime] = useState("");
  const [soundCheckTime, setSoundCheckTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venue, setVenue] = useState("");
  const [venueLat, setVenueLat] = useState<number | null>(null);
  const [venueLng, setVenueLng] = useState<number | null>(null);
  const [gigNotes, setGigNotes] = useState("");
  const [attire, setAttire] = useState("");
  const [foodProvided, setFoodProvided] = useState("");
  const [venueContactPerson, setVenueContactPerson] = useState("");
  const [soundManInfo, setSoundManInfo] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isBookingGig, setIsBookingGig] = useState(false);

  useEffect(() => {
    checkUserRole();
    fetchTours();
  }, []);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || roleData.role !== "tour_manager") {
      toast({
        title: "Access Denied",
        description: "You need to be a Tour Manager to access this page.",
        variant: "destructive"
      });
      navigate("/dashboard");
    }
  };

  const fetchTours = async () => {
    try {
      const { data, error } = await supabase
        .from("tours")
        .select(`
          *,
          tour_crew_members(crew_type, status)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTours(data || []);
    } catch (error) {
      console.error("Error fetching tours:", error);
      toast({
        title: "Error",
        description: "Failed to load tours",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTour = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("tours")
        .insert({
          tour_manager_id: user.id,
          name: formData.name,
          description: formData.description || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Tour created successfully"
      });

      setTours([data, ...tours]);
      setDialogOpen(false);
      setFormData({ name: "", description: "", start_date: "", end_date: "" });
    } catch (error) {
      console.error("Error creating tour:", error);
      toast({
        title: "Error",
        description: "Failed to create tour",
        variant: "destructive"
      });
    }
  };

  const handleTourClick = (tourId: string) => {
    navigate(`/tours/${tourId}`);
  };

  const handleBookGig = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gigDate || !venue.trim()) {
      toast({
        title: "Missing information",
        description: "Please select a date and enter a venue.",
        variant: "destructive"
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsBookingGig(true);

    try {
      // Combine date and time
      const [hours, minutes] = showTime.split(":").map(Number);
      const gigDateTime = new Date(gigDate);
      gigDateTime.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from("gigs")
        .insert({
          user_id: user.id,
          date: gigDateTime.toISOString(),
          venue: venue.trim(),
          venue_name: venueName.trim() || null,
          venue_lat: venueLat,
          venue_lng: venueLng,
          loading_time: loadingTime.trim() || null,
          sound_check_time: soundCheckTime.trim() || null,
          end_time: endTime,
          attire: attire.trim() || null,
          food_provided: foodProvided.trim() || null,
          venue_contact_person: venueContactPerson.trim() || null,
          sound_man_info: soundManInfo.trim() || null,
          notes: gigNotes.trim() || null,
          payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
          status: "pending"
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Tour gig booked successfully"
      });

      // Reset form
      setGigDate(undefined);
      setShowTime("19:00");
      setEndTime("23:00");
      setLoadingTime("");
      setSoundCheckTime("");
      setVenueName("");
      setVenue("");
      setVenueLat(null);
      setVenueLng(null);
      setGigNotes("");
      setAttire("");
      setFoodProvided("");
      setVenueContactPerson("");
      setSoundManInfo("");
      setPaymentAmount("");
      setBookGigDialogOpen(false);
    } catch (error) {
      console.error("Error booking gig:", error);
      toast({
        title: "Error",
        description: "Failed to book tour gig",
        variant: "destructive"
      });
    } finally {
      setIsBookingGig(false);
    }
  };

  const handlePlaceSelect = (address: string, place?: google.maps.places.PlaceResult) => {
    setVenue(address);
    if (place && place.geometry && place.geometry.location) {
      setVenueName(place.name || "");
      setVenueLat(place.geometry.location.lat());
      setVenueLng(place.geometry.location.lng());
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Tour Management</h1>
          <p className="text-muted-foreground">Create and manage your tours</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={bookGigDialogOpen} onOpenChange={setBookGigDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <CalendarIconLucide className="mr-2 h-4 w-4" />
                Book Tour Gig
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Book Tour Gig</DialogTitle>
                <DialogDescription>
                  Schedule a gig for your tour
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleBookGig} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !gigDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIconLucide className="mr-2 h-4 w-4" />
                          {gigDate ? format(gigDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={gigDate}
                          onSelect={setGigDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="showTime">Show Time *</Label>
                    <Input
                      id="showTime"
                      type="time"
                      value={showTime}
                      onChange={(e) => setShowTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="loadingTime">Loading Time</Label>
                    <Input
                      id="loadingTime"
                      type="time"
                      value={loadingTime}
                      onChange={(e) => setLoadingTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="soundCheckTime">Sound Check Time</Label>
                    <Input
                      id="soundCheckTime"
                      type="time"
                      value={soundCheckTime}
                      onChange={(e) => setSoundCheckTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Venue Location * <MapPin className="inline h-3 w-3" /></Label>
                  <PlaceAutocomplete
                    value={venue}
                    onChange={handlePlaceSelect}
                    placeholder="Search for venue..."
                  />
                  {venue && (
                    <p className="text-xs text-muted-foreground mt-1">{venue}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venueName">Venue Name</Label>
                  <Input
                    id="venueName"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="e.g., The Blue Note"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="attire">Attire</Label>
                    <Input
                      id="attire"
                      value={attire}
                      onChange={(e) => setAttire(e.target.value)}
                      placeholder="e.g., Black attire"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="foodProvided">Food Provided</Label>
                    <Input
                      id="foodProvided"
                      value={foodProvided}
                      onChange={(e) => setFoodProvided(e.target.value)}
                      placeholder="e.g., Dinner included"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="venueContact">Venue Contact</Label>
                    <Input
                      id="venueContact"
                      value={venueContactPerson}
                      onChange={(e) => setVenueContactPerson(e.target.value)}
                      placeholder="Contact person"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="soundMan">Sound Man Info</Label>
                    <Input
                      id="soundMan"
                      value={soundManInfo}
                      onChange={(e) => setSoundManInfo(e.target.value)}
                      placeholder="Sound engineer details"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Payment Amount ($)</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gigNotes">Notes</Label>
                  <Textarea
                    id="gigNotes"
                    value={gigNotes}
                    onChange={(e) => setGigNotes(e.target.value)}
                    placeholder="Additional details..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setBookGigDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isBookingGig}>
                    {isBookingGig ? "Booking..." : "Book Gig"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Tour
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tour</DialogTitle>
              <DialogDescription>
                Set up a new tour and invite your crew members
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTour} className="space-y-4">
              <div>
                <Label htmlFor="name">Tour Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Summer Tour 2025"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Tour details..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Tour</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {tours.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarIconLucide className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tours yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first tour to start managing your crew
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {tours.map((tour) => (
            <div key={tour.id} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleTourClick(tour.id)}
              >
                <CardHeader>
                  <CardTitle>{tour.name}</CardTitle>
                  {tour.description && (
                    <CardDescription>{tour.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {tour.start_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIconLucide className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(new Date(tour.start_date), "MMM d, yyyy")}
                        {tour.end_date && ` - ${format(new Date(tour.end_date), "MMM d, yyyy")}`}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleTourClick(tour.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Crew Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(!tour.tour_crew_members || tour.tour_crew_members.length === 0) ? (
                    <p className="text-sm text-muted-foreground">No crew members yet</p>
                  ) : (
                    <div className="space-y-2">
                      {['band_members', 'singer', 'sound_crew', 'lighting_crew'].map((type) => {
                        const typeMembers = tour.tour_crew_members?.filter(m => m.crew_type === type) || [];
                        if (typeMembers.length === 0) return null;
                        
                        const typeLabels: Record<string, string> = {
                          band_members: 'Band Members',
                          singer: 'Singer',
                          sound_crew: 'Sound Crew',
                          lighting_crew: 'Lighting Crew'
                        };
                        
                        return (
                          <div key={type} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{typeLabels[type]}</span>
                            <span className="font-medium">{typeMembers.length}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
