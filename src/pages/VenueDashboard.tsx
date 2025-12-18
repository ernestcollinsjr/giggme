import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  Users, 
  Clock, 
  Plus,
  Building2,
  Music,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { format, parseISO, isToday } from "date-fns";
import { NotificationBell } from "@/components/NotificationBell";
import { BookingCalendar } from "@/components/venue/BookingCalendar";
import { CreateBookingDialog } from "@/components/venue/CreateBookingDialog";
import { VenueSetup } from "@/components/venue/VenueSetup";

interface Venue {
  id: string;
  name: string;
  address: string;
  venue_type: string;
}

interface Booking {
  id: string;
  venue_id: string;
  entertainer_id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  payment_amount: number | null;
  notes: string | null;
  entertainer?: {
    name: string;
    photo_urls: string[];
  };
}

const VenueDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [activeTab, setActiveTab] = useState("upcoming");

  useEffect(() => {
    checkRoleAndFetchData();
  }, []);

  const checkRoleAndFetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user has venue_owner role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "venue_owner")
        .maybeSingle();

      if (!roleData) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You don't have venue owner access.",
        });
        navigate("/dashboard");
        return;
      }

      // Fetch venue
      const { data: venueData } = await supabase
        .from("venues")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      setVenue(venueData);

      if (venueData) {
        // Fetch bookings
        const { data: bookingsData } = await supabase
          .from("entertainment_bookings")
          .select("*")
          .eq("venue_id", venueData.id)
          .order("date", { ascending: true });

        // Fetch entertainer profiles separately
        if (bookingsData) {
          const entertainerIds = [...new Set(bookingsData.map(b => b.entertainer_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, photo_urls")
            .in("id", entertainerIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
          
          const enrichedBookings = bookingsData.map(b => ({
            ...b,
            entertainer: profileMap.get(b.entertainer_id) || { name: "Unknown", photo_urls: [] }
          }));
          
          setBookings(enrichedBookings as any);
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const upcomingBookings = bookings.filter(b => 
    new Date(b.date) >= new Date() && 
    (b.status === "confirmed" || b.status === "pending")
  );

  const todayBookings = bookings.filter(b => isToday(parseISO(b.date)));
  const pendingBookings = bookings.filter(b => b.status === "pending");
  const calloutBookings = bookings.filter(b => b.status === "callout");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Confirmed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case "declined":
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Declined</Badge>;
      case "callout":
        return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Callout</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!venue) {
    return <VenueSetup onComplete={checkRoleAndFetchData} />;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav userRole="venue_owner" />
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              {venue.name}
            </h1>
            <p className="text-muted-foreground text-sm">{venue.address}</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Button onClick={() => setShowCreateBooking(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Book Entertainment
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{todayBookings.length}</p>
                  <p className="text-xs text-muted-foreground">Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingBookings.length}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{upcomingBookings.filter(b => b.status === "confirmed").length}</p>
                  <p className="text-xs text-muted-foreground">Confirmed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{calloutBookings.length}</p>
                  <p className="text-xs text-muted-foreground">Callouts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="entertainers">My Entertainers</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <div className="space-y-4">
              {upcomingBookings.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Music className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Upcoming Bookings</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Start by browsing entertainers and booking your first performance
                    </p>
                    <Button onClick={() => navigate("/entertainers")}>
                      Browse Entertainers
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                upcomingBookings.map((booking) => (
                  <Card key={booking.id} className="border-border/50 hover:border-primary/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                            {booking.entertainer?.photo_urls?.[0] ? (
                              <img 
                                src={booking.entertainer.photo_urls[0]} 
                                alt={booking.entertainer.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Music className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium">{booking.entertainer?.name || "Unknown"}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(booking.date), "EEE, MMM d")}
                              <span>•</span>
                              <Clock className="h-3 w-3" />
                              {booking.start_time}
                              {booking.end_time && ` - ${booking.end_time}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(booking.status)}
                          {booking.payment_amount && (
                            <span className="text-sm font-medium text-green-600">
                              ${booking.payment_amount}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="calendar">
            <BookingCalendar bookings={bookings} venueId={venue.id} />
          </TabsContent>

          <TabsContent value="entertainers">
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Build Your Roster</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Add your preferred entertainers for quick booking access
                </p>
                <Button onClick={() => navigate("/entertainers")}>
                  Browse Entertainers
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <CreateBookingDialog 
        open={showCreateBooking}
        onOpenChange={setShowCreateBooking}
        venueId={venue.id}
        onSuccess={checkRoleAndFetchData}
      />
      
      <BottomNav />
    </div>
  );
};

export default VenueDashboard;
