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
  const [selectedStatus, setSelectedStatus] = useState<'available' | 'unavailable' | 'tentative'>('available');
  const [loading, setLoading] = useState(true);
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [applyingRange, setApplyingRange] = useState(false);

  useEffect(() => {
    fetchAvailability();
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

  const handleDateClick = async (date: Date | undefined) => {
    if (!date || readOnly || isRangeMode) return;

    const dateStr = date.toISOString().split('T')[0];
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

  const modifiers = {
    available: availability.filter(a => a.status === 'available').map(a => new Date(a.date + 'T00:00:00')),
    unavailable: availability.filter(a => a.status === 'unavailable').map(a => new Date(a.date + 'T00:00:00')),
    tentative: availability.filter(a => a.status === 'tentative').map(a => new Date(a.date + 'T00:00:00')),
  };

  const modifiersStyles = {
    available: {
      backgroundColor: 'rgb(34 197 94)', // green-500
      color: 'white',
      borderRadius: '50%',
    },
    unavailable: {
      backgroundColor: 'rgb(239 68 68)', // red-500
      color: 'white',
      borderRadius: '50%',
    },
    tentative: {
      backgroundColor: 'rgb(234 179 8)', // yellow-500
      color: 'white',
      borderRadius: '50%',
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Availability Calendar
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
              onSelect={handleDateClick}
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
        </div>

        {!readOnly && (
          <p className="text-xs text-muted-foreground text-center">
            {isRangeMode 
              ? "Select a start and end date, then click Apply to set availability for the entire range."
              : "Click on a date to mark your availability. Click again with the same status to remove it."
            }
          </p>
        )}
      </CardContent>
    </Card>
  );
}
