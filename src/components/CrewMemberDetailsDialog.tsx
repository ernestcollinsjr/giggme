import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CrewMemberDetails {
  id: string;
  crew_member_id: string;
  profiles: {
    name: string;
    email: string;
  };
  flight_confirmation: string | null;
  hotel_name: string | null;
  hotel_address: string | null;
  hotel_room_number: string | null;
  hotel_check_in_time: string | null;
  per_diem_info: string | null;
  ticket_purchase_responsibility: string | null;
  venue_amenities: string | null;
  nearby_services: string | null;
}

interface CrewMemberDetailsDialogProps {
  member: CrewMemberDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export default function CrewMemberDetailsDialog({
  member,
  open,
  onOpenChange,
  onUpdate
}: CrewMemberDetailsDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    flight_confirmation: "",
    hotel_name: "",
    hotel_address: "",
    hotel_room_number: "",
    hotel_check_in_time: "",
    per_diem_info: "",
    ticket_purchase_responsibility: "manager",
    venue_amenities: "",
    nearby_services: ""
  });

  useEffect(() => {
    if (member) {
      setFormData({
        flight_confirmation: member.flight_confirmation || "",
        hotel_name: member.hotel_name || "",
        hotel_address: member.hotel_address || "",
        hotel_room_number: member.hotel_room_number || "",
        hotel_check_in_time: member.hotel_check_in_time || "",
        per_diem_info: member.per_diem_info || "",
        ticket_purchase_responsibility: member.ticket_purchase_responsibility || "manager",
        venue_amenities: member.venue_amenities || "",
        nearby_services: member.nearby_services || ""
      });
    }
  }, [member]);

  const handleSave = async () => {
    if (!member) return;

    try {
      const { error } = await supabase
        .from("tour_crew_members")
        .update(formData)
        .eq("id", member.id);

      if (error) throw error;

      toast({
        title: "Details Updated",
        description: `Information updated for ${member.profiles.name}`
      });

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating crew member details:", error);
      toast({
        title: "Error",
        description: "Failed to update crew member details",
        variant: "destructive"
      });
    }
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crew Member Details</DialogTitle>
          <DialogDescription>
            Manage logistics information for {member.profiles.name}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="travel" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="travel">Travel</TabsTrigger>
            <TabsTrigger value="lodging">Lodging</TabsTrigger>
            <TabsTrigger value="amenities">Amenities</TabsTrigger>
          </TabsList>

          <TabsContent value="travel" className="space-y-4">
            <div>
              <Label htmlFor="flight">Flight Confirmation</Label>
              <Input
                id="flight"
                value={formData.flight_confirmation}
                onChange={(e) => setFormData({ ...formData, flight_confirmation: e.target.value })}
                placeholder="Flight number and confirmation code"
              />
            </div>

            <div>
              <Label htmlFor="ticket">Ticket Purchase Responsibility</Label>
              <Select
                value={formData.ticket_purchase_responsibility}
                onValueChange={(value) => setFormData({ ...formData, ticket_purchase_responsibility: value })}
              >
                <SelectTrigger id="ticket">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager Purchases</SelectItem>
                  <SelectItem value="member">Member Purchases</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="perdiem">Per Diem Information</Label>
              <Textarea
                id="perdiem"
                value={formData.per_diem_info}
                onChange={(e) => setFormData({ ...formData, per_diem_info: e.target.value })}
                placeholder="Daily allowance amount, payment schedule, etc."
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="lodging" className="space-y-4">
            <div>
              <Label htmlFor="hotel">Hotel Name</Label>
              <Input
                id="hotel"
                value={formData.hotel_name}
                onChange={(e) => setFormData({ ...formData, hotel_name: e.target.value })}
                placeholder="Hotel name"
              />
            </div>

            <div>
              <Label htmlFor="address">Hotel Address</Label>
              <Input
                id="address"
                value={formData.hotel_address}
                onChange={(e) => setFormData({ ...formData, hotel_address: e.target.value })}
                placeholder="Full hotel address"
              />
            </div>

            <div>
              <Label htmlFor="room">Room Number</Label>
              <Input
                id="room"
                value={formData.hotel_room_number}
                onChange={(e) => setFormData({ ...formData, hotel_room_number: e.target.value })}
                placeholder="Room number"
              />
            </div>

            <div>
              <Label htmlFor="checkin">Check-in Time</Label>
              <Input
                id="checkin"
                value={formData.hotel_check_in_time}
                onChange={(e) => setFormData({ ...formData, hotel_check_in_time: e.target.value })}
                placeholder="e.g., 3:00 PM"
              />
            </div>
          </TabsContent>

          <TabsContent value="amenities" className="space-y-4">
            <div>
              <Label htmlFor="venue">Venue Amenities</Label>
              <Textarea
                id="venue"
                value={formData.venue_amenities}
                onChange={(e) => setFormData({ ...formData, venue_amenities: e.target.value })}
                placeholder="Catering, dry cleaning, showers, washer/dryer, workout gym, etc."
                rows={5}
              />
            </div>

            <div>
              <Label htmlFor="nearby">Nearby Services</Label>
              <Textarea
                id="nearby"
                value={formData.nearby_services}
                onChange={(e) => setFormData({ ...formData, nearby_services: e.target.value })}
                placeholder="Starbucks, Walmart, barber, nail salon, massage therapist, etc."
                rows={5}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
