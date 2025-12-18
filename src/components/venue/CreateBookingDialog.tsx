import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, DollarSign, Music } from "lucide-react";
import { format } from "date-fns";

interface CreateBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: string;
  preSelectedEntertainerId?: string | null;
  onSuccess: () => void;
}

interface Entertainer {
  user_id: string;
  stage_name: string | null;
  profile?: {
    name: string;
  };
}

export const CreateBookingDialog = ({
  open,
  onOpenChange,
  venueId,
  preSelectedEntertainerId,
  onSuccess,
}: CreateBookingDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [entertainers, setEntertainers] = useState<Entertainer[]>([]);
  const [formData, setFormData] = useState({
    entertainer_id: preSelectedEntertainerId || "",
    date: format(new Date(), "yyyy-MM-dd"),
    start_time: "19:00",
    end_time: "22:00",
    payment_amount: "",
    notes: "",
  });

  useEffect(() => {
    if (preSelectedEntertainerId) {
      setFormData(prev => ({ ...prev, entertainer_id: preSelectedEntertainerId }));
    }
  }, [preSelectedEntertainerId]);

  useEffect(() => {
    fetchEntertainers();
  }, [venueId]);

  const fetchEntertainers = async () => {
    // First get preferred entertainers
    const { data: preferredData } = await supabase
      .from("venue_preferred_entertainers")
      .select("entertainer_id")
      .eq("venue_id", venueId);

    const preferredIds = preferredData?.map(p => p.entertainer_id) || [];

    // Get all artists
    const { data: artistData } = await supabase
      .from("artist_profiles")
      .select("user_id, stage_name");

    if (artistData) {
      // Fetch profiles separately
      const userIds = artistData.map(a => a.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enriched = artistData.map(a => ({
        user_id: a.user_id,
        stage_name: a.stage_name,
        profile: profileMap.get(a.user_id)
      }));

      // Sort preferred entertainers first
      const sorted = enriched.sort((a, b) => {
        const aPreferred = preferredIds.includes(a.user_id);
        const bPreferred = preferredIds.includes(b.user_id);
        if (aPreferred && !bPreferred) return -1;
        if (!aPreferred && bPreferred) return 1;
        return 0;
      });
      setEntertainers(sorted as Entertainer[]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create the booking
      const { data: booking, error: bookingError } = await supabase
        .from("entertainment_bookings")
        .insert({
          venue_id: venueId,
          entertainer_id: formData.entertainer_id,
          date: formData.date,
          start_time: formData.start_time,
          end_time: formData.end_time || null,
          payment_amount: formData.payment_amount ? parseFloat(formData.payment_amount) : null,
          notes: formData.notes || null,
          status: "pending",
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Create notification for entertainer
      const { data: venue } = await supabase
        .from("venues")
        .select("name")
        .eq("id", venueId)
        .single();

      await supabase.from("notifications").insert({
        user_id: formData.entertainer_id,
        title: "New Booking Request",
        message: `${venue?.name || "A venue"} wants to book you for ${format(new Date(formData.date), "EEEE, MMMM d")} at ${formData.start_time}`,
        type: "booking_request",
        related_id: booking.id,
      });

      toast({
        title: "Booking Request Sent",
        description: "The entertainer will be notified and can accept or decline.",
      });

      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        entertainer_id: "",
        date: format(new Date(), "yyyy-MM-dd"),
        start_time: "19:00",
        end_time: "22:00",
        payment_amount: "",
        notes: "",
      });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Book Entertainment
          </DialogTitle>
          <DialogDescription>
            Send a booking request to an entertainer
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entertainer">Entertainer *</Label>
            <Select
              value={formData.entertainer_id}
              onValueChange={(value) => setFormData({ ...formData, entertainer_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an entertainer" />
              </SelectTrigger>
              <SelectContent>
                {entertainers.map((e) => (
                  <SelectItem key={e.user_id} value={e.user_id}>
                    {e.stage_name || e.profile?.name || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment">Payment Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="payment"
                type="number"
                value={formData.payment_amount}
                onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
                className="pl-10"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any special requests or details..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading || !formData.entertainer_id}>
              {loading ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
