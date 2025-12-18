import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";

interface CalloutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
  onSuccess: () => void;
}

export const CalloutDialog = ({
  open,
  onOpenChange,
  bookingId,
  onSuccess,
}: CalloutDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  const handleCallout = async () => {
    if (!bookingId) return;
    setLoading(true);

    try {
      // Get booking details first
      const { data: booking } = await supabase
        .from("entertainment_bookings")
        .select(`
          *,
          venue:venues!entertainment_bookings_venue_id_fkey(name, owner_id)
        `)
        .eq("id", bookingId)
        .single();

      if (!booking) throw new Error("Booking not found");

      // Update booking status
      const { error: updateError } = await supabase
        .from("entertainment_bookings")
        .update({
          status: "callout",
          callout_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      if (updateError) throw updateError;

      // Get suggested replacements from venue's preferred list
      const { data: preferredEntertainers } = await supabase
        .from("venue_preferred_entertainers")
        .select("entertainer_id, priority")
        .eq("venue_id", booking.venue_id)
        .neq("entertainer_id", booking.entertainer_id)
        .order("priority", { ascending: true })
        .limit(3);

      // Fetch profile names separately
      let suggestionText = "";
      if (preferredEntertainers && preferredEntertainers.length > 0) {
        const entertainerIds = preferredEntertainers.map(e => e.entertainer_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", entertainerIds);

        const names = profiles?.map(p => p.name).join(", ") || "";
        if (names) {
          suggestionText = ` Suggested replacements from your preferred list: ${names}`;
        }
      }

      // Notify venue owner
      await supabase.from("notifications").insert({
        user_id: booking.venue?.owner_id,
        title: "Entertainer Called Out",
        message: `An entertainer has called out for the booking on ${booking.date}. Reason: ${reason || "Not specified"}.${suggestionText}`,
        type: "callout",
        related_id: bookingId,
      });

      toast({
        title: "Callout Submitted",
        description: "The venue has been notified with replacement suggestions.",
      });

      onSuccess();
      onOpenChange(false);
      setReason("");
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
          <DialogTitle className="flex items-center gap-2 text-orange-500">
            <AlertCircle className="h-5 w-5" />
            Can't Make It?
          </DialogTitle>
          <DialogDescription>
            Let the venue know you can't perform. They'll receive replacement suggestions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Let the venue know why you can't make it..."
              rows={3}
            />
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
            <p className="text-sm text-orange-600">
              <strong>Note:</strong> The venue will be notified immediately and will receive suggestions 
              for replacement entertainers from their preferred list.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Go Back
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleCallout}
              disabled={loading}
            >
              {loading ? "Submitting..." : "Confirm Callout"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
