import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Calendar, Users, Loader2, Check, X, ArrowLeft, CalendarPlus } from "lucide-react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { sendGigPushNotifications } from "@/utils/sendGigPushNotification";

interface AvailabilityRequest {
  id: string;
  band_id: string | null;
  booking_manager_id: string | null;
  target_artist_ids: string[] | null;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
}

interface MemberResponse {
  id: string;
  member_id: string;
  available_dates: string[];
  notes: string | null;
  member_name: string;
  member_photo: string | null;
  member_instrument: string | null;
}

interface AvailabilityRequestResultsProps {
  requestId: string;
  onBack: () => void;
}

export function AvailabilityRequestResults({ requestId, onBack }: AvailabilityRequestResultsProps) {
  const [request, setRequest] = useState<AvailabilityRequest | null>(null);
  const [responses, setResponses] = useState<MemberResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creatingGig, setCreatingGig] = useState(false);

  // Booking form state
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchData();
  }, [requestId]);

  const fetchData = async () => {
    try {
      // Fetch request details
      const { data: requestData, error: requestError } = await supabase
        .from("availability_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError) throw requestError;
      setRequest(requestData);

      // Fetch responses with member details
      const { data: responsesData, error: responsesError } = await supabase
        .from("availability_responses")
        .select("*")
        .eq("request_id", requestId);

      if (responsesError) throw responsesError;

      if (responsesData && responsesData.length > 0) {
        const memberIds = responsesData.map(r => r.member_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, photo_urls, instrument")
          .in("id", memberIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const responsesWithMembers = responsesData.map(r => ({
          ...r,
          member_name: profileMap.get(r.member_id)?.name || "Unknown",
          member_photo: profileMap.get(r.member_id)?.photo_urls?.[0] || null,
          member_instrument: profileMap.get(r.member_id)?.instrument || null
        }));

        setResponses(responsesWithMembers);
      } else {
        setResponses([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading responses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getAvailableMembersForDate = (dateStr: string) => {
    return responses.filter(r => r.available_dates.includes(dateStr));
  };

  const handleQuickBook = (dateStr: string) => {
    const availableMembers = getAvailableMembersForDate(dateStr);
    setSelectedDate(dateStr);
    setSelectedMembers(availableMembers.map(m => m.member_id));
    setBookingDialogOpen(true);
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCreateGig = async () => {
    if (!selectedDate || !venueAddress || !startTime) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    setCreatingGig(true);
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      // Create the gig
      const gigDate = new Date(selectedDate + "T" + startTime);
      const { data: gig, error: gigError } = await supabase
        .from("gigs")
        .insert({
          user_id: user.id,
          band_id: request?.band_id || null,
          date: gigDate.toISOString(),
          venue: venueAddress,
          venue_name: venueName || null,
          loading_time: startTime,
          end_time: endTime || null,
          notes: notes || null,
          status: "pending"
        })
        .select()
        .single();

      if (gigError) throw gigError;

      // Invite selected members
      if (selectedMembers.length > 0) {
        const memberInserts = selectedMembers.map(memberId => ({
          gig_id: gig.id,
          member_id: memberId,
          status: "pending"
        }));

        const { error: membersError } = await supabase
          .from("gig_members")
          .insert(memberInserts);

        if (membersError) throw membersError;

        // Send push notifications to invited members
        sendGigPushNotifications({
          gigId: gig.id,
          memberIds: selectedMembers,
          venueName: venueName || null,
          venue: venueAddress,
          gigDate: new Date(selectedDate),
          bandId: request?.band_id || null,
        });
      }

      toast({ 
        title: "Gig created successfully!",
        description: `Invited ${selectedMembers.length} member(s) to the gig`
      });

      // Reset and close
      setBookingDialogOpen(false);
      setSelectedDate(null);
      setSelectedMembers([]);
      setVenueName("");
      setVenueAddress("");
      setStartTime("");
      setEndTime("");
      setNotes("");
    } catch (error: any) {
      console.error("Error creating gig:", error);
      toast({ title: "Error creating gig", description: error.message, variant: "destructive" });
    } finally {
      setCreatingGig(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!request) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          Request not found
        </CardContent>
      </Card>
    );
  }

  const daysInRange = eachDayOfInterval({
    start: parseISO(request.start_date),
    end: parseISO(request.end_date)
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {request.title}
              </CardTitle>
              <CardDescription>
                {format(parseISO(request.start_date), "MMM d")} - {format(parseISO(request.end_date), "MMM d, yyyy")}
                {" • "}{responses.length} response(s)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {responses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No responses yet</p>
              <p className="text-sm">Waiting for artists to submit their availability</p>
            </div>
          ) : (
            <>
              {/* Legend */}
              <div className="flex flex-wrap gap-4 justify-center text-sm pb-2 border-b">
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded-full bg-muted" />
                  <span className="text-muted-foreground">Not Available / No Response</span>
                </div>
              </div>

              {/* Grid view */}
              <ScrollArea className="w-full">
                <div className="min-w-max">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="sticky left-0 bg-background z-10 p-2 text-left border-b min-w-[150px]">
                          Member
                        </th>
                        {daysInRange.map((day) => (
                          <th
                            key={day.toISOString()}
                            className={`p-1 text-center border-b min-w-[50px] ${
                              day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/30" : ""
                            }`}
                          >
                            <div className="text-xs text-muted-foreground">
                              {format(day, "EEE")}
                            </div>
                            <div className="text-sm font-medium">
                              {format(day, "d")}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {responses.map((response) => (
                        <tr key={response.id} className="hover:bg-muted/30">
                          <td className="sticky left-0 bg-background z-10 p-2 border-b">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={response.member_photo || undefined} alt={response.member_name} />
                                <AvatarFallback className="text-xs">
                                  {response.member_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{response.member_name}</p>
                                {response.member_instrument && (
                                  <p className="text-xs text-muted-foreground truncate">{response.member_instrument}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          {daysInRange.map((day) => {
                            const dateStr = format(day, "yyyy-MM-dd");
                            const isAvailable = response.available_dates.includes(dateStr);
                            return (
                              <td
                                key={day.toISOString()}
                                className={`p-1 text-center border-b ${
                                  day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/30" : ""
                                }`}
                              >
                                <div className="flex justify-center">
                                  {isAvailable ? (
                                    <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                                      <Check className="h-3 w-3 text-white" />
                                    </div>
                                  ) : (
                                    <div className="h-6 w-6 rounded-full bg-muted" />
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Summary row with quick book */}
                      <tr className="bg-muted/20 font-medium">
                        <td className="sticky left-0 bg-muted/20 z-10 p-2 border-t-2">
                          Available Count
                        </td>
                        {daysInRange.map((day) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          const availableCount = getAvailableMembersForDate(dateStr).length;
                          return (
                            <td
                              key={day.toISOString()}
                              className={`p-1 text-center border-t-2 ${
                                day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/30" : ""
                              }`}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant={availableCount > 0 ? "default" : "secondary"}>
                                  {availableCount}
                                </Badge>
                                {availableCount > 0 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => handleQuickBook(dateStr)}
                                  >
                                    <CalendarPlus className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Book Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick Book - {selectedDate && format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}</DialogTitle>
            <DialogDescription>
              Create a gig and invite available members
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Member selection */}
            <div>
              <Label className="mb-2 block">Select members to invite</Label>
              <div className="flex flex-wrap gap-2">
                {selectedDate && getAvailableMembersForDate(selectedDate).map((member) => (
                  <Button
                    key={member.member_id}
                    variant={selectedMembers.includes(member.member_id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleMember(member.member_id)}
                    className="gap-2"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={member.member_photo || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {member.member_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {member.member_name}
                    {selectedMembers.includes(member.member_id) && (
                      <Check className="h-3 w-3" />
                    )}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="venue-name">Venue Name</Label>
              <Input
                id="venue-name"
                placeholder="e.g., Blue Note Jazz Club"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="venue-address">Venue Address *</Label>
              <Input
                id="venue-address"
                placeholder="Full address"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-time">Start Time *</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateGig}
              disabled={creatingGig || !venueAddress || !startTime}
              className="gap-2"
            >
              {creatingGig && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Gig & Invite ({selectedMembers.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
