import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MapPin, Calendar, Clock } from "lucide-react";

interface BookingRequest {
  id: string;
  performer_name: string | null;
  performer_email: string | null;
  venue: string;
  dates_text: string;
  time_text: string | null;
  status: "pending" | "accepted" | "declined" | "expired";
  expires_at: string;
  created_at: string;
  responded_at: string | null;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  accepted: "default",
  declined: "destructive",
  expired: "outline",
};

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return <span className="text-destructive font-mono">expired</span>;
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <span className="font-mono text-foreground">
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

export const SentBookingRequests = () => {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("booking_requests")
      .select("id, performer_name, performer_email, venue, dates_text, time_text, status, expires_at, created_at, responded_at")
      .eq("booker_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) setRequests(data as BookingRequest[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel("sent-booking-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_requests" },
        () => fetchRequests()
      )
      .subscribe();
    const interval = setInterval(fetchRequests, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Sent Booking Requests
        </CardTitle>
        <CardDescription>
          Track booking requests you've sent to performers
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No booking requests sent yet.
          </p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div
                key={r.id}
                className="p-3 border rounded-lg bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold truncate">
                      {r.performer_name || r.performer_email || "Performer"}
                    </span>
                    <Badge variant={statusVariant[r.status]} className="text-xs capitalize">
                      {r.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{r.venue}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {r.dates_text}
                    </span>
                    {r.time_text && <span>{r.time_text}</span>}
                  </div>
                </div>
                {r.status === "pending" && (
                  <div className="flex items-center gap-1 text-sm flex-shrink-0">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Countdown expiresAt={r.expires_at} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
