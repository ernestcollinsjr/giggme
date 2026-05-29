import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CalendarDays, Check, X, HelpCircle, CalendarRange, Loader2, MapPin, Clock, DollarSign } from "lucide-react";
import { format, eachDayOfInterval, isBefore, startOfDay, parseISO, isSameDay } from "date-fns";
import { DateRange } from "react-day-picker";

interface AvailabilityDate {
  id: string;
  date: string;
  status: 'available' | 'unavailable' | 'tentative';
  notes: string | null;
}

interface AvailabilityCalendarProps {
  userId?: string;
  readOnly?: boolean;
  onTodayStatusChange?: (status: string | null) => void;
}

export function AvailabilityCalendar({ userId, readOnly = false, onTodayStatusChange }: AvailabilityCalendarProps) {
  const [availability, setAvailability] = useState<AvailabilityDate[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<'available' | 'unavailable' | 'tentative'>('unavailable');
  const [loading, setLoading] = useState(true);
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [applyingRange, setApplyingRange] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBookings, setSelectedBookings] = useState<any[] | null>(null);
  const [selectedBookingDate, setSelectedBookingDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchAvailability();
    fetchBookings();
  }, [userId]);

  // Notify parent when today's status changes
  useEffect(() => {
    if (onTodayStatusChange) {
      const today = new Date().toISOString().split('T')[0];
      const todayAvail = availability.find(a => a.date === today);
      onTodayStatusChange(todayAvail?.status || null);
    }
  }, [availability, onTodayStatusChange]);

  const fetchAvailability = async () => {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
      if (!targetUserId) return;

      const { data, error } = await supabase
        .from('member_availability')
        .select('*')
        .eq('user_id', targetUserId);

      if (error) throw error;
      setAvailability(data as AvailabilityDate[] || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
      if (!targetUserId) return;

      // Gigs where this user is the owner (group leader)
      const { data: ownGigs } = await supabase
        .from('gigs')
        .select('id, date, venue, venue_name, end_time, status, payment_amount, notes')
        .eq('user_id', targetUserId);

      // Gigs where this user is an invited/accepted member
      const { data: memberRows } = await supabase
        .from('gig_members')
        .select('status, gigs(id, date, venue, venue_name, end_time, status, payment_amount, notes)')
        .eq('member_id', targetUserId);

      const memberGigs = (memberRows || [])
        .map((r: any) => r.gigs ? { ...r.gigs, member_status: r.status } : null)
        .filter(Boolean);

      const all = [...(ownGigs || []), ...memberGigs];
      // De-dupe by gig id
      const seen = new Set<string>();
      const unique = all.filter((g: any) => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });
      setBookings(unique);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  const handleDateClick = async (date: Date | undefined) => {
    if (!date || readOnly || isRangeMode) return;

    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = availability.find(a => a.date === dateStr);

    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) {
        toast({ title: "Please log in", variant: "destructive" });
        return;
      }

      if (existing) {
        // If clicking same status, remove it
        if (existing.status === selectedStatus) {
          const { error } = await supabase
            .from('member_availability')
            .delete()
            .eq('id', existing.id);

          if (error) throw error;
          setAvailability(prev => prev.filter(a => a.id !== existing.id));
          toast({ title: "Availability removed" });
        } else {
          // Update to new status
          const { error } = await supabase
            .from('member_availability')
            .update({ status: selectedStatus })
            .eq('id', existing.id);

          if (error) throw error;
          setAvailability(prev => prev.map(a => 
            a.id === existing.id ? { ...a, status: selectedStatus } : a
          ));
          toast({ title: `Marked as ${selectedStatus}` });
        }
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('member_availability')
          .insert({
            user_id: user.id,
            date: dateStr,
            status: selectedStatus
          })
          .select()
          .single();

        if (error) throw error;
        setAvailability(prev => [...prev, data as AvailabilityDate]);
        toast({ title: `Marked as ${selectedStatus}` });
      }
    } catch (error) {
      console.error('Error updating availability:', error);
      toast({ title: "Error updating availability", variant: "destructive" });
    }
  };

  const handleApplyRange = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({ title: "Please select a date range", variant: "destructive" });
      return;
    }

    setApplyingRange(true);
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) {
        toast({ title: "Please log in", variant: "destructive" });
        return;
      }

      const today = startOfDay(new Date());
      const datesInRange = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
        .filter(date => !isBefore(date, today));

      if (datesInRange.length === 0) {
        toast({ title: "No valid future dates in range", variant: "destructive" });
        return;
      }

      // Process each date
      const updates: AvailabilityDate[] = [];
      const inserts: { user_id: string; date: string; status: string }[] = [];
      const deleteIds: string[] = [];

      for (const date of datesInRange) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const existing = availability.find(a => a.date === dateStr);

        if (existing) {
          if (existing.status !== selectedStatus) {
            updates.push({ ...existing, status: selectedStatus });
          }
        } else {
          inserts.push({
            user_id: user.id,
            date: dateStr,
            status: selectedStatus
          });
        }
      }

      // Batch update existing records
      for (const update of updates) {
        await supabase
          .from('member_availability')
          .update({ status: update.status })
          .eq('id', update.id);
      }

      // Batch insert new records
      if (inserts.length > 0) {
        const { data: insertedData, error: insertError } = await supabase
          .from('member_availability')
          .insert(inserts)
          .select();

        if (insertError) throw insertError;

        if (insertedData) {
          setAvailability(prev => [
            ...prev.map(a => {
              const update = updates.find(u => u.id === a.id);
              return update ? { ...a, status: update.status } : a;
            }),
            ...(insertedData as AvailabilityDate[])
          ]);
        }
      } else {
        setAvailability(prev => prev.map(a => {
          const update = updates.find(u => u.id === a.id);
          return update ? { ...a, status: update.status } : a;
        }));
      }

      toast({ 
        title: `Applied ${selectedStatus} to ${datesInRange.length} days`,
        description: `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
      });

      // Reset range mode
      setDateRange(undefined);
      setIsRangeMode(false);
    } catch (error) {
      console.error('Error applying range:', error);
      toast({ title: "Error applying availability", variant: "destructive" });
    } finally {
      setApplyingRange(false);
    }
  };

  // Treat availability rows whose notes start with "Gig:" or "Booking:" as
  // confirmed bookings (the DB triggers tag them this way). This way viewers
  // who can't read the gigs table directly still see blue "Booked" dots.
  const noteBookedDates = availability
    .filter(a => /^\s*(Gig|Booking)\s*:/i.test(a.notes || ''))
    .map(a => new Date(a.date + 'T00:00:00'));
  const bookedDates = [...bookings.map((b: any) => new Date(b.date)), ...noteBookedDates];
  const bookedDateStrs = new Set(bookedDates.map(d => format(d, 'yyyy-MM-dd')));

  const unavailableDateStrs = new Set(
    availability.filter(a => a.status === 'unavailable' && !bookedDateStrs.has(a.date)).map(a => a.date)
  );
  const tentativeDateStrs = new Set(
    availability.filter(a => a.status === 'tentative' && !bookedDateStrs.has(a.date)).map(a => a.date)
  );

  const modifiers = {
    // Default-green: any date that isn't explicitly unavailable, tentative, or booked
    available: (date: Date) => {
      const ds = format(date, 'yyyy-MM-dd');
      return !unavailableDateStrs.has(ds) && !tentativeDateStrs.has(ds) && !bookedDateStrs.has(ds);
    },
    unavailable: availability.filter(a => a.status === 'unavailable' && !bookedDateStrs.has(a.date)).map(a => new Date(a.date + 'T00:00:00')),
    tentative: availability.filter(a => a.status === 'tentative' && !bookedDateStrs.has(a.date)).map(a => new Date(a.date + 'T00:00:00')),
    booked: bookedDates,
  };



  const modifiersStyles = {
    available: {
      backgroundColor: 'rgba(34, 197, 94, 0.4)', // soft green, slightly stronger
      color: 'inherit',
      borderRadius: '50%',
    },

    unavailable: {
      backgroundColor: 'rgb(239 68 68)',
      color: 'white',
      borderRadius: '50%',
    },
    tentative: {
      backgroundColor: 'rgb(234 179 8)',
      color: 'white',
      borderRadius: '50%',
    },
    booked: {
      backgroundColor: 'rgb(59 130 246)', // blue-500
      color: 'white',
      borderRadius: '50%',
      fontWeight: 700,
    },
  };

  const handleReadOnlyDateClick = (date: Date | undefined) => {
    if (!date) return;
    const matches = bookings.filter((b: any) => isSameDay(new Date(b.date), date));
    if (matches.length > 0) {
      setSelectedBookingDate(date);
      setSelectedBookings(matches);
      return;
    }
    // Fallback: if the viewer can't read the gig directly (RLS), show the
    // availability entry. The DB triggers tag booked dates as 'unavailable'
    // with notes like "Gig: <venue>" or "Booking: <venue>".
    const dateStr = format(date, 'yyyy-MM-dd');
    const avail = availability.find(a => a.date === dateStr);
    if (avail && (avail.notes || avail.status === 'unavailable')) {
      const lines = (avail.notes || '').split('\n').filter(Boolean);
      const synthesized = lines.length > 0
        ? lines.map((line, i) => {
            const cleaned = line.replace(/^(Gig|Booking):\s*/i, '').trim();
            return {
              id: `avail-${avail.id}-${i}`,
              date: date.toISOString(),
              venue: cleaned || 'Booked',
              venue_name: cleaned || 'Booked',
              status: avail.status,
              notes: null,
            };
          })
        : [{
            id: `avail-${avail.id}`,
            date: date.toISOString(),
            venue: 'Booked',
            venue_name: 'Marked unavailable',
            status: avail.status,
            notes: null,
          }];
      setSelectedBookingDate(date);
      setSelectedBookings(synthesized);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          {readOnly ? 'Bookings & Availability' : 'Bookings & Availability'}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!readOnly && (
          <>
            {/* Status Selection */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedStatus('available')}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                  selectedStatus === 'available'
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Check className="h-4 w-4" />
                Available
              </button>
              <button
                onClick={() => setSelectedStatus('unavailable')}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                  selectedStatus === 'unavailable'
                    ? "bg-red-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <X className="h-4 w-4" />
                Unavailable
              </button>
              <button
                onClick={() => setSelectedStatus('tentative')}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                  selectedStatus === 'tentative'
                    ? "bg-yellow-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <HelpCircle className="h-4 w-4" />
                Tentative
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant={isRangeMode ? "outline" : "default"}
                size="sm"
                onClick={() => {
                  setIsRangeMode(false);
                  setDateRange(undefined);
                }}
              >
                Single Day
              </Button>
              <Button
                variant={isRangeMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsRangeMode(true)}
                className="gap-1"
              >
                <CalendarRange className="h-4 w-4" />
                Date Range
              </Button>
            </div>

            {/* Range Info and Apply Button */}
            {isRangeMode && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm text-center text-muted-foreground">
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        <span className="font-medium text-foreground">
                          {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
                        </span>
                        <span className="block text-xs mt-1">
                          {eachDayOfInterval({ start: dateRange.from, end: dateRange.to }).length} days selected
                        </span>
                      </>
                    ) : (
                      <>Select end date</>
                    )
                  ) : (
                    <>Select start and end dates</>
                  )}
                </p>
                {dateRange?.from && dateRange?.to && (
                  <Button
                    onClick={handleApplyRange}
                    disabled={applyingRange}
                    className="w-full gap-2"
                    size="sm"
                  >
                    {applyingRange ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Apply {selectedStatus} to selected range
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex justify-center">
          {isRangeMode ? (
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="rounded-md border pointer-events-auto"
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              numberOfMonths={1}
            />
          ) : (
            <Calendar
              mode="single"
              onSelect={readOnly ? handleReadOnlyDateClick : handleDateClick}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="rounded-md border pointer-events-auto"
              disabled={readOnly ? undefined : (date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-3 justify-center text-sm">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Unavailable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">Tentative</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Booked</span>
          </div>
        </div>

        {readOnly && bookings.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Click a blue date to see booking details.
          </p>
        )}

        {!readOnly && (
          <p className="text-xs text-muted-foreground text-center">
            {isRangeMode 
              ? "Select a start and end date, then click Apply to set availability for the entire range."
              : "Click on a date to mark your availability. Click again with the same status to remove it."
            }
          </p>
        )}
      </CardContent>

      <Dialog open={!!selectedBookings} onOpenChange={(open) => { if (!open) { setSelectedBookings(null); setSelectedBookingDate(null); } }}>
        <DialogContent className="bg-black/60 backdrop-blur-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-500" />
              {selectedBookingDate && format(selectedBookingDate, 'EEEE, MMM d, yyyy')}
            </DialogTitle>
            <DialogDescription>
              {selectedBookings?.length === 1 ? '1 booking' : `${selectedBookings?.length || 0} bookings`} on this date
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {selectedBookings?.map((b: any) => {
              const start = b.date ? new Date(b.date) : null;
              return (
                <div key={b.id} className="border border-border rounded-lg p-3 space-y-2 bg-background/50">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{b.venue_name || b.venue}</p>
                      {b.venue_name && b.venue && (
                        <p className="text-xs text-muted-foreground truncate">{b.venue}</p>
                      )}
                    </div>
                  </div>
                  {start && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>
                        {format(start, 'h:mm a')}
                        {b.end_time ? ` – ${b.end_time}` : ''}
                      </span>
                    </div>
                  )}
                  {b.payment_amount != null && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>${Number(b.payment_amount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {b.status && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                        {b.status}
                      </span>
                    )}
                    {b.member_status && (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                        Response: {b.member_status}
                      </span>
                    )}
                  </div>
                  {b.notes && (
                    <p className="text-xs text-muted-foreground border-t border-border pt-2">
                      {b.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
