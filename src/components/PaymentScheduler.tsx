import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CalendarIcon, CheckCircle2, Clock, DollarSign, Wallet } from "lucide-react";
import { format } from "date-fns";

type Mode = "manager" | "booking_manager";

interface Performer {
  id: string;
  name: string;
  email?: string | null;
  photo_url?: string | null;
}

interface Booking {
  source: "gig" | "booking_request";
  source_id: string;
  performer_id: string;
  performer_name: string;
  date: string;          // ISO
  venue: string;
  amount?: number | null;
}

interface PaymentRow {
  source: string;
  source_id: string;
  artist_id: string;
  status: "paid" | "pending" | string;
  due_date: string | null;
  paid_at: string | null;
  amount: number | null;
  notes: string | null;
}

const keyOf = (b: { source: string; source_id: string; performer_id: string }) =>
  `${b.source}:${b.source_id}:${b.performer_id}`;

export function PaymentScheduler({ mode }: { mode: Mode }) {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Record<string, PaymentRow>>({});
  const [selectedPerformerId, setSelectedPerformerId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) { setLoading(false); return; }
      if (mode === "manager") await loadManager(uid);
      else await loadBandLeader(uid);
      await loadPayments(uid);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const loadPayments = async (uid: string) => {
    const { data } = await supabase
      .from("booking_manager_payments")
      .select("source, source_id, artist_id, status, due_date, paid_at, amount, notes")
      .eq("booking_manager_id", uid);
    const map: Record<string, PaymentRow> = {};
    (data || []).forEach((r: any) => {
      map[`${r.source}:${r.source_id}:${r.artist_id}`] = r as PaymentRow;
    });
    setPayments(map);
  };

  const loadManager = async (uid: string) => {
    const { data: ma } = await supabase
      .from("booking_manager_artists")
      .select("artist_id")
      .eq("booking_manager_id", uid);
    const artistIds = (ma || []).map((r: any) => r.artist_id);
    if (artistIds.length === 0) return;
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name, email, photo_urls")
      .in("id", artistIds);
    setPerformers((profs || []).map((p: any) => ({
      id: p.id, name: p.name, email: p.email, photo_url: p.photo_urls?.[0] ?? null,
    })));

    const { data: brs } = await supabase
      .from("booking_requests")
      .select("id, performer_id, performer_name, event_date, venue, budget")
      .eq("booker_id", uid)
      .eq("status", "accepted")
      .in("performer_id", artistIds);
    setBookings(
      (brs || [])
        .filter((b: any) => b.event_date)
        .map((b: any) => ({
          source: "booking_request" as const,
          source_id: b.id,
          performer_id: b.performer_id,
          performer_name: b.performer_name || "",
          date: b.event_date,
          venue: b.venue || "",
          amount: b.budget ? parseFloat(String(b.budget).replace(/[^0-9.]/g, "")) || null : null,
        }))
    );
  };

  const loadBandLeader = async (uid: string) => {
    // Bands led by this user
    const { data: bands } = await supabase.from("bands").select("id").eq("band_leader_id", uid);
    const bandIds = (bands || []).map((b: any) => b.id);
    // Members of those bands
    let memberIds: string[] = [];
    if (bandIds.length) {
      const { data: bm } = await supabase
        .from("band_members").select("member_id").in("band_id", bandIds);
      memberIds = Array.from(new Set((bm || []).map((r: any) => r.member_id)));
    }
    // Also include gig_members on this leader's gigs
    const { data: leaderGigs } = await supabase
      .from("gigs").select("id, venue, venue_name, date, payment_amount").eq("user_id", uid);
    const gigIds = (leaderGigs || []).map((g: any) => g.id);
    let gigMembers: any[] = [];
    if (gigIds.length) {
      const { data: gm } = await supabase
        .from("gig_members").select("gig_id, member_id, status").in("gig_id", gigIds).eq("status", "accepted");
      gigMembers = gm || [];
      memberIds = Array.from(new Set([...memberIds, ...gigMembers.map((r) => r.member_id)]));
    }
    if (memberIds.length === 0) return;
    const { data: profs } = await supabase
      .from("profiles").select("id, name, email, photo_urls").in("id", memberIds);
    const profMap = new Map<string, any>((profs || []).map((p: any) => [p.id, p]));
    setPerformers((profs || []).map((p: any) => ({
      id: p.id, name: p.name, email: p.email, photo_url: p.photo_urls?.[0] ?? null,
    })));

    const gigById = new Map<string, any>((leaderGigs || []).map((g: any) => [g.id, g]));
    const bks: Booking[] = gigMembers.map((gm) => {
      const g = gigById.get(gm.gig_id);
      const p = profMap.get(gm.member_id);
      return {
        source: "gig" as const,
        source_id: gm.gig_id,
        performer_id: gm.member_id,
        performer_name: p?.name || "",
        date: g?.date,
        venue: g?.venue_name || g?.venue || "",
        amount: g?.payment_amount ?? null,
      };
    }).filter((b) => b.date);
    setBookings(bks);
  };

  const selectedBookings = useMemo(
    () => bookings
      .filter((b) => !selectedPerformerId || b.performer_id === selectedPerformerId)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date)),
    [bookings, selectedPerformerId]
  );

  const updatePayment = async (b: Booking, patch: Partial<PaymentRow>) => {
    if (!userId) return;
    const k = keyOf(b);
    const existing = payments[k];
    const next: PaymentRow = {
      source: b.source,
      source_id: b.source_id,
      artist_id: b.performer_id,
      status: existing?.status || "pending",
      due_date: existing?.due_date ?? null,
      paid_at: existing?.paid_at ?? null,
      amount: existing?.amount ?? b.amount ?? null,
      notes: existing?.notes ?? null,
      ...patch,
    };
    setPayments((p) => ({ ...p, [k]: next }));
    const { error } = await supabase
      .from("booking_manager_payments")
      .upsert(
        {
          booking_manager_id: userId,
          source: b.source,
          source_id: b.source_id,
          artist_id: b.performer_id,
          status: next.status,
          due_date: next.due_date,
          paid_at: next.paid_at,
          amount: next.amount,
          notes: next.notes,
        },
        { onConflict: "booking_manager_id,source,source_id,artist_id" }
      );
    if (error) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
      if (existing) setPayments((p) => ({ ...p, [k]: existing }));
    }
  };

  const togglePaid = (b: Booking) => {
    const k = keyOf(b);
    const cur = payments[k];
    const isPaid = cur?.status === "paid";
    updatePayment(b, {
      status: isPaid ? "pending" : "paid",
      paid_at: isPaid ? null : new Date().toISOString(),
    });
  };

  const pending = selectedBookings.filter((b) => payments[keyOf(b)]?.status !== "paid");
  const paid = selectedBookings.filter((b) => payments[keyOf(b)]?.status === "paid");

  const totalPending = pending.reduce((sum, b) => sum + (payments[keyOf(b)]?.amount ?? b.amount ?? 0), 0);
  const totalPaid = paid.reduce((sum, b) => sum + (payments[keyOf(b)]?.amount ?? b.amount ?? 0), 0);

  const selectedPerformer = performers.find((p) => p.id === selectedPerformerId) || null;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Payment Scheduler
        </CardTitle>
        <CardDescription>
          Plan payouts by performer. Set due dates, track what's pending, and mark payments as sent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : performers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {mode === "manager"
              ? "Add managed performers to start scheduling payouts."
              : "Add band members and assign them to gigs to schedule payouts."}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedPerformerId} onValueChange={setSelectedPerformerId}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Select a performer…" />
                </SelectTrigger>
                <SelectContent>
                  {performers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPerformer && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Avatar className="h-7 w-7">
                    {selectedPerformer.photo_url && (
                      <AvatarImage src={selectedPerformer.photo_url} alt={selectedPerformer.name} />
                    )}
                    <AvatarFallback className="text-xs">
                      {selectedPerformer.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{selectedPerformer.name}</span>
                </div>
              )}
            </div>

            {!selectedPerformerId ? (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded-md border-dashed">
                Choose a performer above to see pending and sent payments.
              </div>
            ) : selectedBookings.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded-md border-dashed">
                No bookings for {selectedPerformer?.name} yet.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> Pending
                    </div>
                    <div className="text-xl font-semibold mt-1">
                      ${totalPending.toFixed(2)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({pending.length})
                      </span>
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                    </div>
                    <div className="text-xl font-semibold mt-1">
                      ${totalPaid.toFixed(2)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({paid.length})
                      </span>
                    </div>
                  </div>
                </div>

                <Section
                  title="Pending payments"
                  icon={<Clock className="h-4 w-4" />}
                  bookings={pending}
                  payments={payments}
                  onAmountChange={(b, v) => updatePayment(b, { amount: v })}
                  onDueDateChange={(b, d) => updatePayment(b, { due_date: d })}
                  onTogglePaid={togglePaid}
                />
                <Section
                  title="Sent payments"
                  icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
                  bookings={paid}
                  payments={payments}
                  onAmountChange={(b, v) => updatePayment(b, { amount: v })}
                  onDueDateChange={(b, d) => updatePayment(b, { due_date: d })}
                  onTogglePaid={togglePaid}
                  variant="paid"
                />
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title, icon, bookings, payments, onAmountChange, onDueDateChange, onTogglePaid, variant,
}: {
  title: string;
  icon: React.ReactNode;
  bookings: Booking[];
  payments: Record<string, PaymentRow>;
  onAmountChange: (b: Booking, v: number | null) => void;
  onDueDateChange: (b: Booking, d: string | null) => void;
  onTogglePaid: (b: Booking) => void;
  variant?: "paid";
}) {
  if (bookings.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        {icon} {title}
      </h4>
      <ul className="divide-y border rounded-md">
        {bookings.map((b) => {
          const k = keyOf(b);
          const row = payments[k];
          const due = row?.due_date ? new Date(row.due_date + "T00:00:00") : null;
          const amount = row?.amount ?? b.amount ?? null;
          const isPaid = row?.status === "paid";
          const d = new Date(b.date);
          const overdue = !isPaid && due && due.getTime() < Date.now() - 86400000;
          return (
            <li key={k} className={cn("p-3 flex flex-wrap items-center gap-3", variant === "paid" && "opacity-80")}>
              <div className="flex flex-col items-center justify-center w-12 h-12 rounded-md bg-muted text-center flex-shrink-0">
                <span className="text-[10px] uppercase font-medium text-muted-foreground leading-none">
                  {d.toLocaleDateString("en-US", { month: "short" })}
                </span>
                <span className="text-lg font-bold leading-none mt-0.5">{d.getDate()}</span>
              </div>
              <div className="flex-1 min-w-[160px]">
                <p className="font-medium text-sm truncate">{b.venue || "Booking"}</p>
                <p className="text-xs text-muted-foreground">
                  Event {format(d, "MMM d, yyyy")}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Amount"
                  className="h-8 w-24 text-sm"
                  defaultValue={amount ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value === "" ? null : parseFloat(e.target.value);
                    if (v !== (amount ?? null)) onAmountChange(b, v);
                  }}
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 gap-1.5", overdue && "border-destructive text-destructive")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {due ? format(due, "MMM d") : "Due date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={due ?? undefined}
                    onSelect={(d) =>
                      onDueDateChange(b, d ? format(d, "yyyy-MM-dd") : null)
                    }
                    initialFocus
                  />
                  {due && (
                    <div className="p-2 border-t flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => onDueDateChange(b, null)}>
                        Clear
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {isPaid && row?.paid_at && (
                <Badge variant="outline" className="text-[10px]">
                  Sent {format(new Date(row.paid_at), "MMM d")}
                </Badge>
              )}
              {overdue && !isPaid && (
                <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
              )}
              <Button
                size="sm"
                variant={isPaid ? "outline" : "default"}
                onClick={() => onTogglePaid(b)}
                className="h-8"
              >
                {isPaid ? "Mark unpaid" : "Mark paid"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PaymentScheduler;
