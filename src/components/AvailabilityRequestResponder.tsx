import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { CalendarCheck, Calendar as CalendarIcon, Loader2, Check, Send } from "lucide-react";
import { format, eachDayOfInterval, isBefore, startOfDay } from "date-fns";

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
  created_at: string;
  source?: 'band' | 'booking_manager';
}

interface AvailabilityResponse {
  id: string;
  request_id: string;
  member_id: string;
  available_dates: string[];
  notes: string | null;
}

export function AvailabilityRequestResponder() {
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [responses, setResponses] = useState<Map<string, AvailabilityResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedDates, setSelectedDates] = useState<Map<string, Date[]>>(new Map());
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const allRequests: AvailabilityRequest[] = [];

      // Get user's band memberships and fetch band-based requests
      const { data: memberships } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("member_id", user.id);

      if (memberships && memberships.length > 0) {
        const bandIds = memberships.map(m => m.band_id);

        // Fetch open requests for those bands
        const { data: bandRequests, error } = await supabase
          .from("availability_requests")
          .select("*")
          .in("band_id", bandIds)
          .eq("status", "open")
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (bandRequests) {
          allRequests.push(...bandRequests.map(r => ({ ...r, source: 'band' as const })));
        }
      }

      // Fetch booking manager requests targeting this artist
      const { data: artistRequests, error: artistError } = await supabase
        .from("availability_requests")
        .select("*")
        .contains("target_artist_ids", [user.id])
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (artistError) {
        console.error("Error fetching artist requests:", artistError);
      } else if (artistRequests) {
        allRequests.push(...artistRequests.map(r => ({ ...r, source: 'booking_manager' as const })));
      }

      // Remove duplicates by id
      const uniqueRequests = Array.from(
        new Map(allRequests.map(r => [r.id, r])).values()
      );

      setRequests(uniqueRequests);

      // Fetch existing responses
      if (uniqueRequests.length > 0) {
        const requestIds = uniqueRequests.map(r => r.id);
        const { data: responsesData } = await supabase
          .from("availability_responses")
          .select("*")
          .in("request_id", requestIds)
          .eq("member_id", user.id);

        const responseMap = new Map<string, AvailabilityResponse>();
        const datesMap = new Map<string, Date[]>();
        const notesMap = new Map<string, string>();

        responsesData?.forEach(r => {
          responseMap.set(r.request_id, r);
          datesMap.set(r.request_id, r.available_dates.map((d: string) => new Date(d + "T00:00:00")));
          notesMap.set(r.request_id, r.notes || "");
        });

        setResponses(responseMap);
        setSelectedDates(datesMap);
        setNotes(notesMap);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (requestId: string, dates: Date[] | undefined) => {
    setSelectedDates(prev => {
      const newMap = new Map(prev);
      newMap.set(requestId, dates || []);
      return newMap;
    });
  };

  const handleSubmit = async (requestId: string) => {
    const dates = selectedDates.get(requestId) || [];
    const note = notes.get(requestId) || "";

    if (dates.length === 0) {
      toast({ title: "Please select at least one available date", variant: "destructive" });
      return;
    }

    setSubmitting(requestId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const availableDates = dates.map(d => format(d, "yyyy-MM-dd"));
      const existingResponse = responses.get(requestId);

      if (existingResponse) {
        // Update existing response
        const { error } = await supabase
          .from("availability_responses")
          .update({
            available_dates: availableDates,
            notes: note || null
          })
          .eq("id", existingResponse.id);

        if (error) throw error;
      } else {
        // Create new response
        const { data, error } = await supabase
          .from("availability_responses")
          .insert({
            request_id: requestId,
            member_id: user.id,
            available_dates: availableDates,
            notes: note || null
          })
          .select()
          .single();

        if (error) throw error;

        setResponses(prev => {
          const newMap = new Map(prev);
          newMap.set(requestId, data);
          return newMap;
        });
      }

      toast({ title: "Availability submitted!", description: `${dates.length} date(s) marked as available` });
    } catch (error: any) {
      console.error("Error submitting response:", error);
      toast({ title: "Error submitting availability", variant: "destructive" });
    } finally {
      setSubmitting(null);
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

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" />
          Availability Requests
        </CardTitle>
        <CardDescription>
          Respond to availability requests from band leaders and booking managers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {requests.map((request) => {
          const datesInRange = eachDayOfInterval({
            start: new Date(request.start_date + "T00:00:00"),
            end: new Date(request.end_date + "T00:00:00")
          });
          const selected = selectedDates.get(request.id) || [];
          const hasResponse = responses.has(request.id);

          return (
            <div key={request.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">{request.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      {request.source === 'booking_manager' ? 'From Booking Manager' : 'From Band'}
                    </Badge>
                    {hasResponse && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        Submitted
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(request.start_date), "MMM d")} - {format(new Date(request.end_date), "MMM d, yyyy")}
                  </p>
                  {request.description && (
                    <p className="text-sm text-muted-foreground mt-1">{request.description}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(request.start_date), "MMM d")} - {format(new Date(request.end_date), "MMM d, yyyy")}
                  </p>
                  {request.description && (
                    <p className="text-sm text-muted-foreground mt-1">{request.description}</p>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Select dates you're available ({selected.length} selected)
                </Label>
                <div className="flex justify-center">
                  <Calendar
                    mode="multiple"
                    selected={selected}
                    onSelect={(dates) => handleDateSelect(request.id, dates)}
                    className="rounded-md border pointer-events-auto"
                    disabled={(date) => {
                      const dateOnly = startOfDay(date);
                      const startDate = startOfDay(new Date(request.start_date + "T00:00:00"));
                      const endDate = startOfDay(new Date(request.end_date + "T00:00:00"));
                      return isBefore(dateOnly, startDate) || dateOnly > endDate;
                    }}
                    defaultMonth={new Date(request.start_date + "T00:00:00")}
                    modifiers={{
                      inRange: datesInRange
                    }}
                    modifiersStyles={{
                      inRange: {
                        backgroundColor: "hsl(var(--muted))",
                      }
                    }}
                  />
                </div>
                {selected.length > 0 && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Selected dates:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected
                        .sort((a, b) => a.getTime() - b.getTime())
                        .map((date) => (
                          <Badge 
                            key={date.toISOString()} 
                            variant="secondary"
                            className="text-xs"
                          >
                            {format(date, "MMM d")}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor={`notes-${request.id}`}>Notes (optional)</Label>
                <Textarea
                  id={`notes-${request.id}`}
                  placeholder="Any notes about your availability..."
                  value={notes.get(request.id) || ""}
                  onChange={(e) => {
                    setNotes(prev => {
                      const newMap = new Map(prev);
                      newMap.set(request.id, e.target.value);
                      return newMap;
                    });
                  }}
                  className="mt-1"
                />
              </div>

              <Button
                onClick={() => handleSubmit(request.id)}
                disabled={submitting === request.id}
                className="w-full gap-2"
              >
                {submitting === request.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {hasResponse ? "Update Availability" : "Submit Availability"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
