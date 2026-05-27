import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, X, Clock, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

type Status = "pending" | "accepted" | "declined" | "expired";

interface BookingRequest {
  id: string;
  booker_id: string;
  performer_id: string;
  booker_name: string | null;
  booker_email: string | null;
  performer_name: string | null;
  dates_text: string;
  time_text: string | null;
  venue: string;
  venue_phone: string | null;
  budget: string | null;
  contact_person: string | null;
  dress_code: string | null;
  note: string | null;
  status: Status;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
}

export default function BookingRequestResponse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<BookingRequest | null>(null);
  const [submitting, setSubmitting] = useState<"accept" | "decline" | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const autoRanRef = useRef(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate(`/auth?redirect=/booking-request/${id}`);
        return;
      }
      setUserId(session.user.id);
      const { data, error } = await supabase
        .from("booking_requests")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error || !data) {
        toast({ variant: "destructive", title: "Not found", description: "This booking request could not be loaded." });
        setLoading(false);
        return;
      }
      setRequest(data as BookingRequest);
      setLoading(false);
    })();
  }, [id, navigate]);

  const handleRespond = async (action: "accept" | "decline") => {
    if (!request) return;
    setSubmitting(action);
    try {
      const { data, error } = await supabase.functions.invoke("respond-booking-request", {
        body: { bookingRequestId: request.id, action },
      });
      if (error) throw error;
      toast({
        title: action === "accept" ? "Request accepted" : "Request declined",
        description: action === "accept" ? "The booker has been notified." : "The booker has been notified.",
      });
      setRequest({ ...request, status: action === "accept" ? "accepted" : "declined", responded_at: new Date().toISOString() });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not respond", description: err.message || "Please try again." });
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Request not found</CardTitle>
            <CardDescription>This booking request doesn't exist or you don't have access to it.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard")} className="w-full">Go to dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPerformer = userId === request.performer_id;
  const isBooker = userId === request.booker_id;
  const expiresAt = new Date(request.expires_at).getTime();
  const expired = request.status === "pending" && expiresAt < now;
  const effectiveStatus: Status = expired ? "expired" : request.status;
  const msLeft = Math.max(0, expiresAt - now);
  const hours = Math.floor(msLeft / 3600000);
  const minutes = Math.floor((msLeft % 3600000) / 60000);
  const seconds = Math.floor((msLeft % 60000) / 1000);

  const StatusBadge = () => {
    const map = {
      pending: { icon: Clock, label: "Pending", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
      accepted: { icon: CheckCircle2, label: "Accepted", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
      declined: { icon: XCircle, label: "Declined", className: "bg-destructive/10 text-destructive border-destructive/20" },
      expired: { icon: AlertCircle, label: "Expired", className: "bg-muted text-muted-foreground border-border" },
    } as const;
    const { icon: Icon, label, className } = map[effectiveStatus];
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${className}`}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-2xl">Booking Request</CardTitle>
                <CardDescription className="mt-1">
                  {request.booker_name ? `From ${request.booker_name}` : "From a booker"}
                  {request.booker_email && <> · <a href={`mailto:${request.booker_email}`} className="underline">{request.booker_email}</a></>}
                </CardDescription>
              </div>
              <StatusBadge />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {effectiveStatus === "pending" && (
              <div className="rounded-lg border bg-muted/40 p-4 flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="text-sm">
                  <div className="font-medium">Respond within {hours}h {String(minutes).padStart(2, "0")}m {String(seconds).padStart(2, "0")}s</div>
                  <div className="text-muted-foreground text-xs">If you don't respond, the request will be automatically declined and the booker will be notified.</div>
                </div>
              </div>
            )}

            {effectiveStatus === "expired" && (
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <div className="font-medium">This request has expired.</div>
                <div className="text-muted-foreground text-xs mt-1">It was not responded to within the 2-minute window.</div>
              </div>
            )}

            {effectiveStatus === "accepted" && request.responded_at && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
                <div className="font-medium text-emerald-700">Accepted {formatDistanceToNow(new Date(request.responded_at), { addSuffix: true })}</div>
              </div>
            )}

            {effectiveStatus === "declined" && request.responded_at && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
                <div className="font-medium text-destructive">Declined {formatDistanceToNow(new Date(request.responded_at), { addSuffix: true })}</div>
              </div>
            )}

            <div className="divide-y border rounded-lg overflow-hidden">
              <Row label="Date(s)" value={`${request.dates_text}${request.time_text ? " " + request.time_text : ""}`} />
              <Row label="Venue" value={request.venue} />
              {request.venue_phone && <Row label="Venue Phone" value={request.venue_phone} />}
              {request.budget && <Row label="Budget" value={request.budget} />}
              {request.contact_person && <Row label="Contact Person" value={request.contact_person} />}
              {request.dress_code && <Row label="Dress Code" value={request.dress_code} />}
              {request.note && <Row label="Note" value={request.note} />}
            </div>

            {isPerformer && effectiveStatus === "pending" && (
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => handleRespond("accept")}
                  disabled={submitting !== null}
                >
                  {submitting === "accept" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Accept
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleRespond("decline")}
                  disabled={submitting !== null}
                >
                  {submitting === "decline" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
                  Decline
                </Button>
              </div>
            )}

            {!isPerformer && !isBooker && (
              <div className="text-sm text-muted-foreground">You don't have permission to respond to this request.</div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
              <div className="text-xs text-muted-foreground">
                Sent {format(new Date(request.created_at), "MMM d, yyyy 'at' h:mm a")}
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                Go to dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 p-3 text-sm">
      <div className="sm:w-36 text-muted-foreground">{label}</div>
      <div className="flex-1 text-foreground">{value}</div>
    </div>
  );
}
