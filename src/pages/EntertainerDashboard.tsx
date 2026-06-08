import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Music,
  CheckCircle,
  XCircle,
  DollarSign,
  AlertCircle,
  Building2
} from "lucide-react";
import { format, parseISO, isToday, isTomorrow, isPast } from "date-fns";
import { NotificationBell } from "@/components/NotificationBell";
import { CalloutDialog } from "@/components/entertainer/CalloutDialog";
import { UpcomingGigLocationTracker } from "@/components/UpcomingGigLocationTracker";

interface Booking {
  id: string;
  venue_id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  status: string;
  payment_amount: number | null;
  notes: string | null;
  venue?: {
    name: string;
    address: string;
  };
}

const EntertainerDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [showCalloutDialog, setShowCalloutDialog] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
    setupRealtimeSubscription();
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`entertainer-bookings-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "entertainment_bookings",
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchBookings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);

      const { data: bookingsData, error } = await supabase
        .from("entertainment_bookings")
        .select(`
          *,
          venue:venues!entertainment_bookings_venue_id_fkey(name, address)
        `)
        .eq("entertainer_id", user.id)
        .order("date", { ascending: true });

      if (error) throw error;
      setBookings(bookingsData || []);
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

  const handleResponse = async (bookingId: string, accept: boolean) => {
    try {
      const { error } = await supabase
        .from("entertainment_bookings")
        .update({ 
          status: accept ? "confirmed" : "declined",
          updated_at: new Date().toISOString()
        })
        .eq("id", bookingId);

      if (error) throw error;

      toast({
        title: accept ? "Booking Accepted" : "Booking Declined",
        description: accept 
          ? "You've confirmed this performance. The venue has been notified."
          : "You've declined this booking. The venue has been notified.",
      });

      fetchBookings();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleCallout = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setShowCalloutDialog(true);
  };

  const pendingBookings = bookings.filter(b => b.status === "pending");
  const confirmedBookings = bookings.filter(b => 
    b.status === "confirmed" && !isPast(parseISO(b.date))
  );
  const pastBookings = bookings.filter(b => 
    isPast(parseISO(b.date)) || b.status === "completed"
  );

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <AppShell userRole="entertainer">
    <div className="min-h-screen bg-background pb-20 lg:pb-6">
      <TopNav userRole="entertainer" />

      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Music className="h-6 w-6 text-primary" />
              My Bookings
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage your performance schedule
            </p>
          </div>
          <NotificationBell />
        </div>

        {/* Upcoming Gig Location Tracker - Shows prominently when gig is within 1 hour */}
        {userId && (
          <UpcomingGigLocationTracker 
            userId={userId} 
            userRole="entertainer" 
          />
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-yellow-500">{pendingBookings.length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-500">{confirmedBookings.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary">{pastBookings.length}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="pending" className="flex-1">
              Pending {pendingBookings.length > 0 && `(${pendingBookings.length})`}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <div className="space-y-4">
              {pendingBookings.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Pending Requests</h3>
                    <p className="text-muted-foreground text-sm">
                      New book performers will appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                pendingBookings.map((booking) => (
                  <Card key={booking.id} className="border-yellow-500/30 bg-yellow-500/5">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">{booking.venue?.name}</span>
                            </div>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {booking.venue?.address}
                            </p>
                          </div>
                          <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                            New Request
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-primary" />
                            {getDateLabel(booking.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-primary" />
                            {booking.start_time}
                            {booking.end_time && ` - ${booking.end_time}`}
                          </span>
                          {booking.payment_amount && (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <DollarSign className="h-4 w-4" />
                              {booking.payment_amount}
                            </span>
                          )}
                        </div>

                        {booking.notes && (
                          <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                            {booking.notes}
                          </p>
                        )}
                        
                        <div className="flex gap-2">
                          <Button 
                            className="flex-1"
                            onClick={() => handleResponse(booking.id, true)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Accept
                          </Button>
                          <Button 
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleResponse(booking.id, false)}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="upcoming">
            <div className="space-y-4">
              {confirmedBookings.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Upcoming Performances</h3>
                    <p className="text-muted-foreground text-sm">
                      Your confirmed bookings will appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                confirmedBookings.map((booking) => (
                  <Card key={booking.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{booking.venue?.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {getDateLabel(booking.date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {booking.start_time}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Confirmed
                          </Badge>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                            onClick={() => handleCallout(booking.id)}
                          >
                            <AlertCircle className="h-4 w-4 mr-1" />
                            Can't Make It
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-4">
              {pastBookings.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Music className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Past Performances</h3>
                    <p className="text-muted-foreground text-sm">
                      Your performance history will appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                pastBookings.map((booking) => (
                  <Card key={booking.id} className="border-border/50 opacity-75">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{booking.venue?.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{format(parseISO(booking.date), "MMM d, yyyy")}</span>
                            {booking.payment_amount && (
                              <span className="text-green-600">
                                ${booking.payment_amount}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary">Completed</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <CalloutDialog
        open={showCalloutDialog}
        onOpenChange={setShowCalloutDialog}
        bookingId={selectedBookingId}
        onSuccess={fetchBookings}
      />
      
      <BottomNav />
    </div>
    </AppShell>
  );
};

export default EntertainerDashboard;
