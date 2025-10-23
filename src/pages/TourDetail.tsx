import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Users, Copy, Check, Edit, UserPlus, Calendar as CalendarIconLucide, MapPin, Plus, Trash } from "lucide-react";
import { format } from "date-fns";
import CrewMemberDetailsDialog from "@/components/CrewMemberDetailsDialog";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Tour {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface TourDate {
  id: string;
  date: string;
  venue: string;
  venue_name: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  show_time: string | null;
  loading_time: string | null;
  sound_check_time: string | null;
  end_time: string | null;
  attire: string | null;
  food_provided: string | null;
  venue_contact_person: string | null;
  sound_man_info: string | null;
  notes: string | null;
  payment_amount: number | null;
  per_diem: number | null;
  ground_transportation: string | null;
  transportation_not_provided: boolean | null;
  hotel_name: string | null;
  hotel_address: string | null;
  hotel_check_in_time: string | null;
  hotel_check_out_date: string | null;
  hotel_check_out_time: string | null;
  hotel_notes: string | null;
  general_notes: string | null;
}

interface CrewMember {
  id: string;
  crew_member_id: string;
  status: string;
  role_title: string | null;
  crew_type: 'band_members' | 'singer' | 'sound_crew' | 'lighting_crew';
  flight_confirmation: string | null;
  hotel_name: string | null;
  hotel_address: string | null;
  hotel_room_number: string | null;
  hotel_check_in_time: string | null;
  per_diem_info: string | null;
  ticket_purchase_responsibility: string | null;
  venue_amenities: string | null;
  nearby_services: string | null;
  profiles: {
    name: string;
    email: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  invite_token: string;
  created_at: string;
}

export default function TourDetail() {
  const { tourId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tour, setTour] = useState<Tour | null>(null);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCrewType, setInviteCrewType] = useState<'band_members' | 'singer' | 'sound_crew' | 'lighting_crew'>('band_members');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedCrewType, setSelectedCrewType] = useState<'band_members' | 'singer' | 'sound_crew' | 'lighting_crew'>('band_members');
  const [tourDates, setTourDates] = useState<TourDate[]>([]);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<TourDate | null>(null);
  const [dateFormData, setDateFormData] = useState({
    date: new Date(),
    show_time: "19:00",
    loading_time: "",
    sound_check_time: "",
    end_time: "23:00",
    venue: "",
    venue_name: "",
    venue_lat: null as number | null,
    venue_lng: null as number | null,
    attire: "",
    food_provided: "",
    venue_contact_person: "",
    sound_man_info: "",
    notes: "",
    payment_amount: "",
    per_diem: "",
    ground_transportation: "",
    transportation_not_provided: false,
    hotel_name: "",
    hotel_address: "",
    hotel_check_in_time: "",
    hotel_check_out_date: "",
    hotel_check_out_time: "",
    hotel_notes: "",
    general_notes: ""
  });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setAuthReady(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthReady(!!session);
      if (session && tourId) {
        fetchTourData();
      }
    });
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (tourId && authReady) {
      fetchTourData();
    }
  }, [tourId, authReady]);

  const fetchTourData = async () => {
    try {
      const [tourResult, crewResult, invitesResult, profilesResult, datesResult] = await Promise.all([
        supabase.from("tours").select("*").eq("id", tourId).maybeSingle(),
        supabase
          .from("tour_crew_members")
          .select(`
            *,
            profiles(name, email)
          `)
          .eq("tour_id", tourId),
        supabase
          .from("tour_invitations")
          .select("*")
          .eq("tour_id", tourId)
          .eq("status", "pending"),
        supabase
          .from("profiles")
          .select("id, name, email")
          .limit(100),
        supabase
          .from("tour_dates")
          .select("*")
          .eq("tour_id", tourId)
          .order("date", { ascending: true })
      ]);

      if (tourResult.error) throw tourResult.error;
      setTour(tourResult.data);
      
      const existingMemberIds = (crewResult.data || []).map((m: any) => m.crew_member_id);
      const available = (profilesResult.data || []).filter(p => !existingMemberIds.includes(p.id));
      setAvailableProfiles(available);
      
      setCrewMembers((crewResult.data || []) as any);
      setInvitations(invitesResult.data || []);
      setTourDates((datesResult.data || []) as TourDate[]);
    } catch (error) {
      console.error("Error fetching tour data:", error);
      toast({
        title: "Error",
        description: "Failed to load tour details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !tourId || !tour) return;

    try {
      const inviteToken = crypto.randomUUID();
      
      const { error } = await supabase
        .from("tour_invitations")
        .insert({
          tour_id: tourId,
          tour_manager_id: user.id,
          email: inviteEmail,
          invite_token: inviteToken,
          crew_type: inviteCrewType
        });

      if (error) throw error;

      // Get user profile for manager name
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      // Send invitation email
      const { error: emailError } = await supabase.functions.invoke("send-tour-invite", {
        body: {
          recipientEmail: inviteEmail,
          tourName: tour.name,
          inviteToken: inviteToken,
          tourManagerName: profile?.name || "Tour Manager"
        }
      });

      if (emailError) {
        console.error("Error sending invitation email:", emailError);
        toast({
          title: "Invitation Created",
          description: `Invitation created for ${inviteEmail}, but email sending failed. You can copy and share the link below.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Invitation Sent",
          description: `Invitation email sent to ${inviteEmail}`
        });
      }

      setDialogOpen(false);
      setInviteEmail("");
      setInviteCrewType('band_members');
      fetchTourData();
    } catch (error) {
      console.error("Error sending invite:", error);
      toast({
        title: "Error",
        description: "Failed to create invitation",
        variant: "destructive"
      });
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/tour-invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast({
      title: "Link Copied",
      description: "Invitation link copied to clipboard"
    });
  };

  const resendInvitation = async (invitation: Invitation) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !tour) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      const { error } = await supabase.functions.invoke("send-tour-invite", {
        body: {
          recipientEmail: invitation.email,
          tourName: tour.name,
          inviteToken: invitation.invite_token,
          tourManagerName: profile?.name || "Tour Manager"
        }
      });

      if (error) throw error;

      toast({
        title: "Email Resent",
        description: `Invitation email resent to ${invitation.email}`
      });
    } catch (error) {
      console.error("Error resending invitation:", error);
      toast({
        title: "Error",
        description: "Failed to resend invitation email",
        variant: "destructive"
      });
    }
  };

  const handleAddExistingMember = async () => {
    if (!selectedProfileId || !tourId) return;

    try {
      const { error } = await supabase
        .from("tour_crew_members")
        .insert({
          tour_id: tourId,
          crew_member_id: selectedProfileId,
          crew_type: selectedCrewType,
          status: "accepted"
        });

      if (error) throw error;

      toast({
        title: "Member Added",
        description: "Crew member has been added to the tour"
      });

      setAddMemberDialogOpen(false);
      setSelectedProfileId("");
      setSelectedCrewType('band_members');
      fetchTourData();
    } catch (error) {
      console.error("Error adding crew member:", error);
      toast({
        title: "Error",
        description: "Failed to add crew member",
        variant: "destructive"
      });
    }
  };

  const handleDatePlaceSelect = (address: string, place?: google.maps.places.PlaceResult) => {
    setDateFormData(prev => ({
      ...prev,
      venue: address,
      venue_name: place?.name || "",
      venue_lat: place?.geometry?.location?.lat() ?? null,
      venue_lng: place?.geometry?.location?.lng() ?? null
    }));
  };

  const openDateDialog = (date?: TourDate) => {
    if (date) {
      setEditingDate(date);
      setDateFormData({
        date: new Date(date.date),
        show_time: date.show_time || "19:00",
        loading_time: date.loading_time || "",
        sound_check_time: date.sound_check_time || "",
        end_time: date.end_time || "23:00",
        venue: date.venue,
        venue_name: date.venue_name || "",
        venue_lat: date.venue_lat,
        venue_lng: date.venue_lng,
        attire: date.attire || "",
        food_provided: date.food_provided || "",
        venue_contact_person: date.venue_contact_person || "",
        sound_man_info: date.sound_man_info || "",
        notes: date.notes || "",
        payment_amount: date.payment_amount?.toString() || "",
        per_diem: date.per_diem?.toString() || "",
        ground_transportation: date.ground_transportation || "",
        transportation_not_provided: date.transportation_not_provided || false,
        hotel_name: date.hotel_name || "",
        hotel_address: date.hotel_address || "",
        hotel_check_in_time: date.hotel_check_in_time || "",
        hotel_check_out_date: date.hotel_check_out_date || "",
        hotel_check_out_time: date.hotel_check_out_time || "",
        hotel_notes: date.hotel_notes || "",
        general_notes: date.general_notes || ""
      });
    } else {
      setEditingDate(null);
      setDateFormData({
        date: new Date(),
        show_time: "19:00",
        loading_time: "",
        sound_check_time: "",
        end_time: "23:00",
        venue: "",
        venue_name: "",
        venue_lat: null,
        venue_lng: null,
        attire: "",
        food_provided: "",
        venue_contact_person: "",
        sound_man_info: "",
        notes: "",
        payment_amount: "",
        per_diem: "",
        ground_transportation: "",
        transportation_not_provided: false,
        hotel_name: "",
        hotel_address: "",
        hotel_check_in_time: "",
        hotel_check_out_date: "",
        hotel_check_out_time: "",
        hotel_notes: "",
        general_notes: ""
      });
    }
    setDateDialogOpen(true);
  };

  const handleSaveTourDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tourId || !dateFormData.venue.trim()) return;

    try {
      const [hours, minutes] = dateFormData.show_time.split(":").map(Number);
      const dateTime = new Date(dateFormData.date);
      dateTime.setHours(hours, minutes, 0, 0);

      const dateData = {
        tour_id: tourId,
        date: dateTime.toISOString(),
        venue: dateFormData.venue.trim(),
        venue_name: dateFormData.venue_name.trim() || null,
        venue_lat: dateFormData.venue_lat,
        venue_lng: dateFormData.venue_lng,
        show_time: dateFormData.show_time,
        loading_time: dateFormData.loading_time.trim() || null,
        sound_check_time: dateFormData.sound_check_time.trim() || null,
        end_time: dateFormData.end_time || null,
        attire: dateFormData.attire.trim() || null,
        food_provided: dateFormData.food_provided.trim() || null,
        venue_contact_person: dateFormData.venue_contact_person.trim() || null,
        sound_man_info: dateFormData.sound_man_info.trim() || null,
        notes: dateFormData.notes.trim() || null,
        payment_amount: dateFormData.payment_amount ? parseFloat(dateFormData.payment_amount) : null,
        per_diem: dateFormData.per_diem ? parseFloat(dateFormData.per_diem) : null,
        ground_transportation: dateFormData.ground_transportation.trim() || null,
        transportation_not_provided: dateFormData.transportation_not_provided,
        hotel_name: dateFormData.hotel_name.trim() || null,
        hotel_address: dateFormData.hotel_address.trim() || null,
        hotel_check_in_time: dateFormData.hotel_check_in_time.trim() || null,
        hotel_check_out_date: dateFormData.hotel_check_out_date.trim() || null,
        hotel_check_out_time: dateFormData.hotel_check_out_time.trim() || null,
        hotel_notes: dateFormData.hotel_notes.trim() || null,
        general_notes: dateFormData.general_notes.trim() || null
      };

      let error;
      if (editingDate) {
        ({ error } = await supabase
          .from("tour_dates")
          .update(dateData)
          .eq("id", editingDate.id));
      } else {
        ({ error } = await supabase
          .from("tour_dates")
          .insert(dateData));
      }

      if (error) throw error;

      toast({
        title: "Success",
        description: editingDate ? "Tour date updated" : "Tour date added"
      });

      setDateDialogOpen(false);
      fetchTourData();
    } catch (error) {
      console.error("Error saving tour date:", error);
      toast({
        title: "Error",
        description: "Failed to save tour date",
        variant: "destructive"
      });
    }
  };

  const handleDeleteTourDate = async (dateId: string) => {
    if (!confirm("Are you sure you want to delete this tour date?")) return;

    try {
      const { error } = await supabase
        .from("tour_dates")
        .delete()
        .eq("id", dateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Tour date deleted"
      });

      fetchTourData();
    } catch (error) {
      console.error("Error deleting tour date:", error);
      toast({
        title: "Error",
        description: "Failed to delete tour date",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="container mx-auto p-6">
        <p>Tour not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Button variant="ghost" onClick={() => navigate("/tours")} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Tours
      </Button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{tour.name}</h1>
          {tour.description && (
            <p className="text-muted-foreground">{tour.description}</p>
          )}
          {tour.start_date && (
            <p className="text-sm text-muted-foreground mt-2">
              {format(new Date(tour.start_date), "MMM d, yyyy")}
              {tour.end_date && ` - ${format(new Date(tour.end_date), "MMM d, yyyy")}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Existing Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Existing Member</DialogTitle>
                <DialogDescription>
                  Select an existing profile to add to this tour
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="profile">Select Member *</Label>
                  <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                    <SelectTrigger id="profile">
                      <SelectValue placeholder="Choose a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="memberCrewType">Crew Type *</Label>
                  <Select value={selectedCrewType} onValueChange={(value: any) => setSelectedCrewType(value)}>
                    <SelectTrigger id="memberCrewType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="band_members">Band Members</SelectItem>
                      <SelectItem value="singer">Singer</SelectItem>
                      <SelectItem value="sound_crew">Sound Crew</SelectItem>
                      <SelectItem value="lighting_crew">Lighting Crew</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddExistingMember} disabled={!selectedProfileId}>
                    Add Member
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Mail className="mr-2 h-4 w-4" />
                Invite Crew Member
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Crew Member</DialogTitle>
              <DialogDescription>
                Enter the email address of the crew member you want to invite
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="crew@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="crewType">Crew Type *</Label>
                <Select value={inviteCrewType} onValueChange={(value: any) => setInviteCrewType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="band_members">Band Members</SelectItem>
                    <SelectItem value="singer">Singer</SelectItem>
                    <SelectItem value="sound_crew">Sound Crew</SelectItem>
                    <SelectItem value="lighting_crew">Lighting Crew</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Invite Link</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Crew Members ({crewMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {crewMembers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No crew members yet. Send invitations to get started.
              </p>
            ) : (
              <div className="space-y-6">
                {['band_members', 'singer', 'sound_crew', 'lighting_crew'].map((type) => {
                  const typeMembers = crewMembers.filter(m => m.crew_type === type);
                  if (typeMembers.length === 0) return null;
                  
                  const typeLabels = {
                    band_members: 'Band Members',
                    singer: 'Singer',
                    sound_crew: 'Sound Crew',
                    lighting_crew: 'Lighting Crew'
                  };
                  
                  return (
                    <div key={type}>
                      <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
                        {typeLabels[type as keyof typeof typeLabels]} ({typeMembers.length})
                      </h3>
                      <div className="space-y-2">
                        {typeMembers.map((member) => (
                          <div key={member.id} className="p-3 border rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <div 
                                className="cursor-pointer hover:underline flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/artist-profile/${member.crew_member_id}`);
                                }}
                              >
                                <p className="font-medium">{member.profiles.name}</p>
                                <p className="text-sm text-muted-foreground">{member.profiles.email}</p>
                                {member.role_title && (
                                  <p className="text-xs text-muted-foreground mt-1">{member.role_title}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  member.status === 'accepted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {member.status}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedMember(member);
                                    setDetailsDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            {(member.hotel_name || member.flight_confirmation) && (
                              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                                {member.flight_confirmation && (
                                  <p>✈️ Flight: {member.flight_confirmation}</p>
                                )}
                                {member.hotel_name && (
                                  <p>🏨 {member.hotel_name}{member.hotel_room_number ? ` - Room ${member.hotel_room_number}` : ''}</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invitations ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No pending invitations
              </p>
            ) : (
              <div className="space-y-3">
                {invitations.map((invite) => (
                  <div key={invite.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{invite.email}</p>
                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => copyInviteLink(invite.invite_token)}
                      >
                        {copiedToken === invite.invite_token ? (
                          <>
                            <Check className="mr-2 h-3 w-3" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-3 w-3" />
                            Copy Link
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1"
                        onClick={() => resendInvitation(invite)}
                      >
                        <Mail className="mr-2 h-3 w-3" />
                        Resend Email
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIconLucide className="h-5 w-5" />
              Tour Dates ({tourDates.length})
            </CardTitle>
            <Button onClick={() => openDateDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Date
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tourDates.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No tour dates scheduled yet
            </p>
          ) : (
            <div className="space-y-4">
              {tourDates.map((tourDate) => (
                <div key={tourDate.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {format(new Date(tourDate.date), "EEEE, MMMM d, yyyy")}
                      </h3>
                      {tourDate.show_time && (
                        <p className="text-sm text-muted-foreground">
                          Show Time: {tourDate.show_time}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDateDialog(tourDate)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteTourDate(tourDate.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Venue
                      </p>
                      <p className="font-medium">{tourDate.venue_name || tourDate.venue}</p>
                    </div>
                    
                    {tourDate.loading_time && (
                      <div>
                        <p className="text-muted-foreground">Loading Time</p>
                        <p>{tourDate.loading_time}</p>
                      </div>
                    )}
                    
                    {tourDate.sound_check_time && (
                      <div>
                        <p className="text-muted-foreground">Sound Check</p>
                        <p>{tourDate.sound_check_time}</p>
                      </div>
                    )}
                    
                    {tourDate.end_time && (
                      <div>
                        <p className="text-muted-foreground">End Time</p>
                        <p>{tourDate.end_time}</p>
                      </div>
                    )}
                    
                    {tourDate.attire && (
                      <div>
                        <p className="text-muted-foreground">Attire</p>
                        <p>{tourDate.attire}</p>
                      </div>
                    )}
                    
                    {tourDate.food_provided && (
                      <div>
                        <p className="text-muted-foreground">Food</p>
                        <p>{tourDate.food_provided}</p>
                      </div>
                    )}
                    
                    {tourDate.venue_contact_person && (
                      <div>
                        <p className="text-muted-foreground">Venue Contact</p>
                        <p>{tourDate.venue_contact_person}</p>
                      </div>
                    )}
                    
                    {tourDate.sound_man_info && (
                      <div>
                        <p className="text-muted-foreground">Sound Engineer</p>
                        <p>{tourDate.sound_man_info}</p>
                      </div>
                    )}
                    
                    {tourDate.payment_amount && (
                      <div>
                        <p className="text-muted-foreground">Payment</p>
                        <p>${tourDate.payment_amount.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                  
                  {tourDate.notes && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-muted-foreground text-sm">Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{tourDate.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDate ? "Edit Tour Date" : "Add Tour Date"}</DialogTitle>
            <DialogDescription>
              Schedule a date for this tour
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTourDate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFormData.date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIconLucide className="mr-2 h-4 w-4" />
                      {dateFormData.date ? format(dateFormData.date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFormData.date}
                      onSelect={(date) => date && setDateFormData(prev => ({ ...prev, date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateShowTime">Show Time *</Label>
                <Input
                  id="dateShowTime"
                  type="time"
                  value={dateFormData.show_time}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, show_time: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateLoadingTime">Loading Time</Label>
                <Input
                  id="dateLoadingTime"
                  type="time"
                  value={dateFormData.loading_time}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, loading_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateSoundCheckTime">Sound Check Time</Label>
                <Input
                  id="dateSoundCheckTime"
                  type="time"
                  value={dateFormData.sound_check_time}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, sound_check_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateEndTime">End Time</Label>
                <Input
                  id="dateEndTime"
                  type="time"
                  value={dateFormData.end_time}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateVenueName">Venue Name</Label>
                <Input
                  id="dateVenueName"
                  value={dateFormData.venue_name}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, venue_name: e.target.value }))}
                  placeholder="e.g., The Blue Note"
                />
              </div>

              <div className="space-y-2">
                <Label>Venue Location * <MapPin className="inline h-3 w-3" /></Label>
                <PlaceAutocomplete
                  value={dateFormData.venue}
                  onChange={handleDatePlaceSelect}
                  placeholder="Search for venue..."
                />
                {dateFormData.venue && (
                  <p className="text-xs text-muted-foreground mt-1">{dateFormData.venue}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="groundTransportation">Ground Transportation (Provided by Management)</Label>
                <Select
                  value={dateFormData.ground_transportation}
                  onValueChange={(value) => setDateFormData(prev => ({ ...prev, ground_transportation: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select transportation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hotel Shuttle">Hotel Shuttle</SelectItem>
                    <SelectItem value="Uber">Uber</SelectItem>
                    <SelectItem value="Limo">Limo</SelectItem>
                    <SelectItem value="Van">Van</SelectItem>
                    <SelectItem value="SUV">SUV</SelectItem>
                    <SelectItem value="Tour Bus">Tour Bus</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end pb-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="transportationNotProvided"
                    checked={dateFormData.transportation_not_provided}
                    onCheckedChange={(checked) => 
                      setDateFormData(prev => ({ ...prev, transportation_not_provided: checked as boolean }))
                    }
                  />
                  <Label htmlFor="transportationNotProvided" className="cursor-pointer">
                    Transportation not provided
                  </Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hotelName">Hotel Name</Label>
                <Input
                  id="hotelName"
                  value={dateFormData.hotel_name}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, hotel_name: e.target.value }))}
                  placeholder="e.g., Marriott Downtown"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hotelAddress">Hotel Address</Label>
                <Input
                  id="hotelAddress"
                  value={dateFormData.hotel_address}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, hotel_address: e.target.value }))}
                  placeholder="Full hotel address"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hotelCheckInTime">Hotel Check-in Time</Label>
                <Input
                  id="hotelCheckInTime"
                  type="time"
                  value={dateFormData.hotel_check_in_time}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, hotel_check_in_time: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hotelCheckOutDate">Check-out Date</Label>
                <Input
                  id="hotelCheckOutDate"
                  type="date"
                  value={dateFormData.hotel_check_out_date}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, hotel_check_out_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hotelCheckOutTime">Check-out Time</Label>
                <Input
                  id="hotelCheckOutTime"
                  type="time"
                  value={dateFormData.hotel_check_out_time}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, hotel_check_out_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hotelNotes">Hotel Notes</Label>
                <Textarea
                  id="hotelNotes"
                  value={dateFormData.hotel_notes}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, hotel_notes: e.target.value }))}
                  placeholder="Special requests, room preferences, etc."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="generalNotes">General Notes</Label>
                <Textarea
                  id="generalNotes"
                  value={dateFormData.general_notes}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, general_notes: e.target.value }))}
                  placeholder="Additional notes about this date..."
                  rows={3}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateAttire">Attire</Label>
                <Input
                  id="dateAttire"
                  value={dateFormData.attire}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, attire: e.target.value }))}
                  placeholder="e.g., Black attire"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFoodProvided">Food Provided</Label>
                <Input
                  id="dateFoodProvided"
                  value={dateFormData.food_provided}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, food_provided: e.target.value }))}
                  placeholder="e.g., Dinner included"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateVenueContact">Venue Contact</Label>
                <Input
                  id="dateVenueContact"
                  value={dateFormData.venue_contact_person}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, venue_contact_person: e.target.value }))}
                  placeholder="Contact person"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateSoundMan">Sound Man Info</Label>
                <Input
                  id="dateSoundMan"
                  value={dateFormData.sound_man_info}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, sound_man_info: e.target.value }))}
                  placeholder="Sound engineer details"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="datePaymentAmount">Payment Amount ($)</Label>
                <Input
                  id="datePaymentAmount"
                  type="number"
                  step="0.01"
                  value={dateFormData.payment_amount}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, payment_amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="perDiem">Per Diem ($)</Label>
                <Input
                  id="perDiem"
                  type="number"
                  step="0.01"
                  value={dateFormData.per_diem}
                  onChange={(e) => setDateFormData(prev => ({ ...prev, per_diem: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateNotes">Notes</Label>
              <Textarea
                id="dateNotes"
                value={dateFormData.notes}
                onChange={(e) => setDateFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional details..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingDate ? "Update Date" : "Add Date"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CrewMemberDetailsDialog
        member={selectedMember}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        onUpdate={fetchTourData}
      />
    </div>
  );
}
