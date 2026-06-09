import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MapPin, Calendar, Clock, Trash2, BellOff, Archive, DollarSign, CheckCircle2, RefreshCw } from "lucide-react";
import { formatTimeString } from "@/hooks/useTimeFormat";

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
  auto_reminders_disabled: boolean;
  event_date: string | null;
  budget: string | null;
}

type DisplayStatus = BookingRequest["status"] | "completed";

const statusVariant: Record<DisplayStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  accepted: "default",
  declined: "destructive",
  expired: "outline",
  completed: "outline",
};

function formatTime12h(text: string): string {
  return formatTimeString(text);
}

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

function getDisplayStatus(r: BookingRequest): DisplayStatus {
  if (r.status === "accepted" && r.event_date && new Date(r.event_date).getTime() < Date.now()) {
    return "completed";
  }
  return r.status;
}

function parseBudget(b: string | null): number {
  if (!b) return 0;
  const n = parseFloat(b.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

export const SentBookingRequests = () => {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this book performer?")) return;
    const { error } = await supabase.from("booking_requests").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Book performer deleted" });
  };

  const handleToggleReminders = async (id: string, disabled: boolean) => {
    const { error } = await supabase
      .from("booking_requests")
      .update({ auto_reminders_disabled: disabled })
      .eq("id", id);
    if (error) {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, auto_reminders_disabled: disabled } : r)));
    toast({ title: disabled ? "Auto reminders off" : "Auto reminders on" });
  };

  const handleResend = async (id: string) => {
    setResendingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("resend-booking-request", {
        body: { bookingRequestId: id },
      });
      if (error) throw error;
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, expires_at: data?.expiresAt || r.expires_at } : r))
      );
      toast({ title: "Booking email resent", description: "The performer will receive the email again." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to resend",
        description: err?.message || "Something went wrong.",
      });
    } finally {
      setResendingId(null);
    }
  };

  const fetchRequests = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("booking_requests")
      .select("id, performer_name, performer_email, venue, dates_text, time_text, status, expires_at, created_at, responded_at, auto_reminders_disabled, event_date, budget")
      .eq("booker_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) setRequests(data as BookingRequest[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel(`sent-booking-requests-${Math.random().toString(36).slice(2)}`)
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

  const { active, archive, totalArchiveBudget } = useMemo(() => {
    const active: BookingRequest[] = [];
    const archive: BookingRequest[] = [];
    for (const r of requests) {
      if (getDisplayStatus(r) === "completed") archive.push(r);
      else active.push(r);
    }
    const totalArchiveBudget = archive.reduce((sum, r) => sum + parseBudget(r.budget), 0);
    return { active, archive, totalArchiveBudget };
  }, [requests]);

  const renderRow = (r: BookingRequest, archived: boolean) => {
    const display = archived ? "completed" : r.status;
    return (
      <div
        key={r.id}
        className="p-3 border rounded-lg bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold truncate">
              {r.performer_name || r.performer_email || "Performer"}
            </span>
            <Badge variant={statusVariant[display]} className="text-xs capitalize gap-1">
              {display === "completed" && <CheckCircle2 className="h-3 w-3" />}
              {display}
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
            {r.time_text && <span>{formatTime12h(r.time_text)}</span>}
            {r.budget && (
              <span className="flex items-center gap-1 text-foreground/80 font-medium">
                <DollarSign className="h-3 w-3" />
                {r.budget}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!archived && r.status === "pending" && (
            <div className="flex items-center gap-1 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Countdown expiresAt={r.expires_at} />
            </div>
          )}
          {!archived && r.status === "accepted" && (
            <label
              className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"
              title="Disable automatic 1-day and 2-hour reminder emails"
            >
              <BellOff className="h-3.5 w-3.5" />
              <Switch
                checked={r.auto_reminders_disabled}
                onCheckedChange={(v) => handleToggleReminders(r.id, v)}
              />
            </label>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => handleDelete(r.id)}
            aria-label="Delete book performer"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Sent Book Performers
        </CardTitle>
        <CardDescription>
          Track book performers you've sent to performers
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No book performers sent yet.
          </p>
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
              <TabsTrigger value="archive" className="gap-1">
                <Archive className="h-3.5 w-3.5" />
                Archive ({archive.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-3">
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No active book performers.
                </p>
              ) : (
                <div className="space-y-2">{active.map((r) => renderRow(r, false))}</div>
              )}
            </TabsContent>
            <TabsContent value="archive" className="mt-3 space-y-3">
              {archive.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No completed bookings yet.
                </p>
              ) : (
                <>
                  {totalArchiveBudget > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                      <span className="text-sm font-medium text-muted-foreground">
                        Total ({archive.length} completed)
                      </span>
                      <span className="text-lg font-semibold flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {totalArchiveBudget.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="space-y-2">{archive.map((r) => renderRow(r, true))}</div>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};
