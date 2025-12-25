import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Check, X, HelpCircle } from "lucide-react";

interface AvailabilityDate {
  id: string;
  date: string;
  status: 'available' | 'unavailable' | 'tentative';
  notes: string | null;
}

interface AvailabilityCalendarProps {
  userId?: string;
  readOnly?: boolean;
}

export function AvailabilityCalendar({ userId, readOnly = false }: AvailabilityCalendarProps) {
  const [availability, setAvailability] = useState<AvailabilityDate[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<'available' | 'unavailable' | 'tentative'>('available');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvailability();
  }, [userId]);

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
    if (!date || readOnly) return;

    const dateStr = date.toISOString().split('T')[0];
    const existing = availability.find(a => a.date === dateStr);

    try {
      const { data: { user } } = await supabase.auth.getUser();
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

  const getDateStatus = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return availability.find(a => a.date === dateStr)?.status;
  };

  const modifiers = {
    available: availability.filter(a => a.status === 'available').map(a => new Date(a.date + 'T00:00:00')),
    unavailable: availability.filter(a => a.status === 'unavailable').map(a => new Date(a.date + 'T00:00:00')),
    tentative: availability.filter(a => a.status === 'tentative').map(a => new Date(a.date + 'T00:00:00')),
  };

  const modifiersStyles = {
    available: {
      backgroundColor: 'hsl(var(--chart-2))',
      color: 'white',
      borderRadius: '50%',
    },
    unavailable: {
      backgroundColor: 'hsl(var(--destructive))',
      color: 'white',
      borderRadius: '50%',
    },
    tentative: {
      backgroundColor: 'hsl(var(--chart-4))',
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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedStatus('available')}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                selectedStatus === 'available'
                  ? "bg-[hsl(var(--chart-2))] text-white"
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
                  ? "bg-destructive text-destructive-foreground"
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
                  ? "bg-[hsl(var(--chart-4))] text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <HelpCircle className="h-4 w-4" />
              Tentative
            </button>
          </div>
        )}

        <div className="flex justify-center">
          <Calendar
            mode="single"
            onSelect={handleDateClick}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="rounded-md border pointer-events-auto"
            disabled={readOnly ? undefined : (date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          />
        </div>

        <div className="flex flex-wrap gap-3 justify-center text-sm">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--chart-2))]" />
            <span className="text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Unavailable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--chart-4))]" />
            <span className="text-muted-foreground">Tentative</span>
          </div>
        </div>

        {!readOnly && (
          <p className="text-xs text-muted-foreground text-center">
            Click on a date to mark your availability. Click again with the same status to remove it.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
