import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBand } from "@/contexts/BandContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarIcon, Clock, MapPin, Plus, Trash2, Music, Navigation, Users, Send, Pencil, Filter, Mail, MailCheck, MailOpen, MousePointerClick, AlertCircle } from "lucide-react";
import { EmailTrackingStatus } from "@/components/EmailTrackingStatus";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { GigTemplateSelector } from "@/components/GigTemplateSelector";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { sendGigPushNotifications } from "@/utils/sendGigPushNotification";

interface Gig {
  id: string;
  date: string;
  venue: string;
  venue_name: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  notes: string | null;
  attire: string | null;
  food_provided: string | null;
  venue_contact_person: string | null;
  sound_man_info: string | null;
  end_time: string | null;
  loading_time: string | null;
  sound_check_time: string | null;
  status: string;
  user_id: string;
}

interface BandMember {
  id: string;
  name: string;
  email: string;
  instrument: string | null;
}

// Helper function to convert 24-hour time to 12-hour format
const formatTime12Hour = (time24: string | null): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return time24;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const monthIndexes: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const calendarDate = (year: number, month: number, day: number) => new Date(year, month, day, 12, 0, 0, 0);

const normalizeCalendarSelection = (date: Date) => calendarDate(date.getFullYear(), date.getMonth(), date.getDate());

type BookingRequestCalendarSource = {
  dates_text?: string | null;
  event_date?: string | null;
};

const getBookingRequestCalendarDates = (request: BookingRequestCalendarSource): Date[] => {
  const datesText = typeof request?.dates_text === "string" ? request.dates_text : "";
  const parsedDates = [...datesText.matchAll(/\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/g)]
    .map((match) => {
      const month = monthIndexes[match[1].toLowerCase()];
      const day = Number(match[2]);
      const year = Number(match[3]);
      return month === undefined || Number.isNaN(day) || Number.isNaN(year) ? null : calendarDate(year, month, day);
    })
    .filter((date): date is Date => Boolean(date));

  if (parsedDates.length > 0) return parsedDates;

  if (!request?.event_date) return [];
  const fallback = new Date(request.event_date);
  return Number.isNaN(fallback.getTime()) ? [] : [calendarDate(fallback.getFullYear(), fallback.getMonth(), fallback.getDate())];
};

const Bookings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedBandId, setSelectedBandId } = useBand();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [gigRehearsals, setGigRehearsals] = useState<Record<string, { date: string; venue: string; end_time: string | null }>>({});
  const [gigResponseCounts, setGigResponseCounts] = useState<Record<string, { pending: number; accepted: number; declined: number }>>({});
  const [bookingRequests, setBookingRequests] = useState<any[]>([]);
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ venue: "", dates_text: "", time_text: "", budget: "", note: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [gigInvitations, setGigInvitations] = useState<any[]>([]);
  const [bands, setBands] = useState<{ id: string; name: string }[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [currentGigForInvite, setCurrentGigForInvite] = useState<string | null>(null);
  const [currentGigInvitedMembers, setCurrentGigInvitedMembers] = useState<{ member_id: string; status: string }[]>([]);
  const [currentGigEmailTracking, setCurrentGigEmailTracking] = useState<Record<string, { status: string; delivered_at: string | null; opened_at: string | null; clicked_at: string | null }>>({});
  const [resendingMemberId, setResendingMemberId] = useState<string | null>(null);
  const [resendingAll, setResendingAll] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [managedArtists, setManagedArtists] = useState<{ artist_id: string; name: string; email: string | null }[]>([]);
  const [quickBookPerformerId, setQuickBookPerformerId] = useState<string>("");
  const [quickBookVenue, setQuickBookVenue] = useState<string>("");
  const [quickBookVenueLat, setQuickBookVenueLat] = useState<number | null>(null);
  const [quickBookVenueLng, setQuickBookVenueLng] = useState<number | null>(null);
  const [quickBookVenuePhone, setQuickBookVenuePhone] = useState<string>("");
  const [quickBookContactPerson, setQuickBookContactPerson] = useState<string>("");
  const [quickBookDressCode, setQuickBookDressCode] = useState<string>("");
  const [quickBookNote, setQuickBookNote] = useState<string>("");
  const [quickBookStart, setQuickBookStart] = useState<string>("19:00");
  const [quickBookEnd, setQuickBookEnd] = useState<string>("22:00");
  const [quickBookBudget, setQuickBookBudget] = useState<string>("");
  const [quickBookSubmitting, setQuickBookSubmitting] = useState(false);
  
  // Form state
  const [date, setDate] = useState<Date>();
  const [showTime, setShowTime] = useState("19:00");
  const [endTime, setEndTime] = useState("23:00");
  const [loadingTime, setLoadingTime] = useState("");
  const [soundCheckTime, setSoundCheckTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venue, setVenue] = useState("");
  const [venueLat, setVenueLat] = useState<number | null>(null);
  const [venueLng, setVenueLng] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [attire, setAttire] = useState("");
  const [foodProvided, setFoodProvided] = useState("");
  const [venueContactPerson, setVenueContactPerson] = useState("");
  const [soundManInfo, setSoundManInfo] = useState("");
  const [responseDeadlineHours, setResponseDeadlineHours] = useState("2");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Rehearsal state
  const [includeRehearsal, setIncludeRehearsal] = useState(false);
  const [rehearsalDate, setRehearsalDate] = useState<Date>();
  const [rehearsalTime, setRehearsalTime] = useState("18:00");
  const [rehearsalEndTime, setRehearsalEndTime] = useState("21:00");
  const [rehearsalVenue, setRehearsalVenue] = useState("");
  const [rehearsalVenueLat, setRehearsalVenueLat] = useState<number | null>(null);
  const [rehearsalVenueLng, setRehearsalVenueLng] = useState<number | null>(null);
  const [rehearsalNotes, setRehearsalNotes] = useState("");
  const [useGigVenueForRehearsal, setUseGigVenueForRehearsal] = useState(false);

  // Edit gig state
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDate, setEditDate] = useState<Date>();
  const [editShowTime, setEditShowTime] = useState("19:00");
  const [editEndTime, setEditEndTime] = useState("23:00");
  const [editLoadingTime, setEditLoadingTime] = useState("");
  const [editSoundCheckTime, setEditSoundCheckTime] = useState("");
  const [editVenueName, setEditVenueName] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editVenueLat, setEditVenueLat] = useState<number | null>(null);
  const [editVenueLng, setEditVenueLng] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editAttire, setEditAttire] = useState("");
  const [editFoodProvided, setEditFoodProvided] = useState("");
  const [editVenueContactPerson, setEditVenueContactPerson] = useState("");
  const [editSoundManInfo, setEditSoundManInfo] = useState("");
  const [editAutoRemindersDisabled, setEditAutoRemindersDisabled] = useState(false);

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  // Real-time updates for gig member responses
  useEffect(() => {
    if (userRole !== "booking_manager") return;

    const channel = supabase
      .channel('gig-members-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gig_members'
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const update = payload.new as { member_id: string; status: string; gig_id: string };
            const oldData = payload.old as { status?: string } | null;
            
            // Check if this gig is in our current list
            const matchingGig = gigs.find(g => g.id === update.gig_id);
            if (!matchingGig) return;
            
            // Update the response counts
            setGigResponseCounts(prev => {
              const current = prev[update.gig_id] || { pending: 0, accepted: 0, declined: 0 };
              const updated = { ...current };
              
              // Decrement old status count if this is an update
              if (payload.eventType === 'UPDATE' && oldData?.status) {
                if (oldData.status === 'pending') updated.pending = Math.max(0, updated.pending - 1);
                else if (oldData.status === 'accepted') updated.accepted = Math.max(0, updated.accepted - 1);
                else if (oldData.status === 'declined') updated.declined = Math.max(0, updated.declined - 1);
              }
              
              // Increment new status count
              if (update.status === 'pending') updated.pending++;
              else if (update.status === 'accepted') updated.accepted++;
              else if (update.status === 'declined') updated.declined++;
              
              return { ...prev, [update.gig_id]: updated };
            });
            
            // Get member name
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', update.member_id)
              .single();
            
            const memberName = profile?.name || 'A member';
            const statusEmoji = update.status === 'accepted' ? '✅' : update.status === 'declined' ? '❌' : '⏳';
            
            toast({
              title: "Gig RSVP Update",
              description: `${statusEmoji} ${memberName} has ${update.status} the gig at ${matchingGig.venue_name || matchingGig.venue}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole, gigs, toast]);

  const checkAuthAndFetchData = async () => {
    const { waitForUser } = await import("@/lib/requireAuth");
    const user = await waitForUser();

    if (!user) {
      navigate("/auth");
      return;
    }

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    setUserRole(roleData?.role || null);
    setCurrentUserId(user.id);

    // Fetch managed artists (for quick-book from calendar) — booking managers & band leaders
    if (
      roleData?.role === "booking_manager" ||
      roleData?.role === "admin" ||
      roleData?.role === "super_admin"
    ) {
      const { data: links } = await supabase
        .from("booking_manager_artists")
        .select("artist_id")
        .eq("booking_manager_id", user.id);
      const ids = (links || []).map((l: any) => l.artist_id);
      let artists: { artist_id: string; name: string; email: string | null }[] = [];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", ids);
        artists = (profs || []).map((p: any) => ({ artist_id: p.id, name: p.name, email: p.email }));
      }
      // Fallback: if no managed artists, allow booking any public entertainer from this calendar
      if (artists.length === 0) {
        const { data: pub } = await supabase.rpc("get_public_performers");
        artists = (pub || []).map((p: any) => ({
          artist_id: p.user_id,
          name: p.stage_name || p.name,
          email: null,
        }));
      }
      setManagedArtists(artists);
    }

    // Fetch bands for band leaders
    if (roleData?.role === "booking_manager" || roleData?.role === "super_admin") {
      const { data: bandsData } = await supabase
        .from("bands")
        .select("id, name")
        .eq("band_leader_id", user.id)
        .order("created_at", { ascending: true });
      
      setBands(bandsData || []);
      
      // Auto-select first band if none selected
      if (bandsData && bandsData.length > 0 && !selectedBandId) {
        setSelectedBandId(bandsData[0].id);
      }
      
      // Validate selected band exists
      if (selectedBandId) {
        const bandExists = bandsData?.some(b => b.id === selectedBandId);
        if (!bandExists) {
          setSelectedBandId(bandsData?.[0]?.id || null);
        }
      }
    }

    // Fetch gigs filtered by selected band
    let query = supabase
      .from("gigs")
      .select("*")
      .order("date", { ascending: true });
    
    if (selectedBandId) {
      query = query.eq("band_id", selectedBandId);
    }
    
    const { data: gigData } = await query;

    setGigs((gigData as unknown as Gig[]) || []);
    
    // Fetch gig member response counts and linked rehearsals
    if (gigData && gigData.length > 0) {
      const gigIds = gigData.map((g: any) => g.id);
      
      // Fetch responses
      const { data: responses } = await supabase
        .from('gig_members')
        .select('gig_id, status')
        .in('gig_id', gigIds);
      
      const counts: Record<string, { pending: number; accepted: number; declined: number }> = {};
      responses?.forEach((r: any) => {
        if (!counts[r.gig_id]) {
          counts[r.gig_id] = { pending: 0, accepted: 0, declined: 0 };
        }
        if (r.status === 'pending') counts[r.gig_id].pending++;
        else if (r.status === 'accepted') counts[r.gig_id].accepted++;
        else if (r.status === 'declined') counts[r.gig_id].declined++;
      });
      setGigResponseCounts(counts);

      // Fetch linked rehearsals
      const { data: rehearsalsData } = await supabase
        .from('rehearsals')
        .select('gig_id, date, venue, end_time')
        .in('gig_id', gigIds)
        .not('gig_id', 'is', null);
      
      const rehearsalsMap: Record<string, { date: string; venue: string; end_time: string | null }> = {};
      rehearsalsData?.forEach((r: any) => {
        if (r.gig_id) {
          rehearsalsMap[r.gig_id] = { date: r.date, venue: r.venue, end_time: r.end_time };
        }
      });
      setGigRehearsals(rehearsalsMap);
    }
    
    // Fetch band members if a band is selected
    if (selectedBandId && (roleData?.role === "booking_manager" || roleData?.role === "super_admin")) {
      const { data: membersData } = await supabase
        .from("profiles")
        .select("id, name, email, instrument")
        .neq("id", user.id); // Exclude the band leader
      
      setBandMembers((membersData as BandMember[]) || []);
    }

    // Fetch booking requests — performer OR booker (so booking managers see what they booked).
    const { data: brData } = await supabase
      .from("booking_requests")
      .select("id, status, booker_name, performer_name, dates_text, time_text, venue, budget, contact_person, event_date, created_at, performer_id, booker_id")
      .or(`performer_id.eq.${user.id},booker_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    setBookingRequests(brData || []);

    // Fetch gig invitations from bands (gigs the user has been invited to)
    const { data: giData } = await supabase
      .from("gig_members")
      .select("id, status, location_sharing_enabled, gigs!inner(id, date, venue, venue_name, notes)")
      .eq("member_id", user.id)
      .order("status", { ascending: true });
    setGigInvitations(giData || []);

    setLoading(false);
  };

  const handleAddGig = async () => {
    if (!date || !venue.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a date and enter a venue.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      if (!selectedBandId) {
        toast({
          variant: "destructive",
          title: "No group selected",
          description: "Please select a group from the dashboard first.",
        });
        return;
      }

      // Combine date and time
      const [hours, minutes] = showTime.split(":").map(Number);
      const gigDateTime = new Date(date);
      gigDateTime.setHours(hours, minutes, 0, 0);

      const { data: newGig, error } = await supabase
        .from("gigs")
        .insert({
          user_id: user.id,
          band_id: selectedBandId,
          date: gigDateTime.toISOString(),
          end_time: endTime,
          loading_time: loadingTime.trim() || null,
          sound_check_time: soundCheckTime.trim() || null,
          venue_name: venueName.trim() || null,
          venue: venue.trim(),
          venue_lat: venueLat,
          venue_lng: venueLng,
          notes: notes.trim() || null,
          attire: attire.trim() || null,
          food_provided: foodProvided.trim() || null,
          venue_contact_person: venueContactPerson.trim() || null,
          sound_man_info: soundManInfo.trim() || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Create linked rehearsal if included
      let rehearsalId = null;
      if (includeRehearsal && rehearsalDate && newGig) {
        const [rHours, rMinutes] = rehearsalTime.split(":").map(Number);
        const rehearsalDateTime = new Date(rehearsalDate);
        rehearsalDateTime.setHours(rHours, rMinutes, 0, 0);

        const rehearsalVenueToUse = useGigVenueForRehearsal ? venue.trim() : rehearsalVenue.trim();
        const rehearsalLatToUse = useGigVenueForRehearsal ? venueLat : rehearsalVenueLat;
        const rehearsalLngToUse = useGigVenueForRehearsal ? venueLng : rehearsalVenueLng;

        const { data: newRehearsal, error: rehearsalError } = await supabase
          .from("rehearsals")
          .insert({
            band_leader_id: user.id,
            band_id: selectedBandId,
            gig_id: newGig.id,
            date: rehearsalDateTime.toISOString(),
            end_time: rehearsalEndTime,
            venue: rehearsalVenueToUse,
            venue_lat: rehearsalLatToUse,
            venue_lng: rehearsalLngToUse,
            notes: rehearsalNotes.trim() || null,
            attire: attire.trim() || null,
          })
          .select()
          .single();

        if (rehearsalError) {
          console.error("Failed to create rehearsal:", rehearsalError);
        } else {
          rehearsalId = newRehearsal?.id;
        }
      }

      // Auto-invite selected members
      if (selectedMembers.length > 0 && newGig) {
        // Calculate response deadline
        const deadlineHours = parseInt(responseDeadlineHours) || 2;
        const responseDeadline = new Date();
        responseDeadline.setHours(responseDeadline.getHours() + deadlineHours);

        const invites = selectedMembers.map(memberId => ({
          gig_id: newGig.id,
          member_id: memberId,
          status: 'pending',
          response_deadline: responseDeadline.toISOString(),
        }));

        const { error: inviteError } = await supabase
          .from("gig_members")
          .insert(invites);

        if (inviteError) throw inviteError;

        // Send push notifications and emails to invited members
        sendGigPushNotifications({
          gigId: newGig.id,
          memberIds: selectedMembers,
          venueName: venueName.trim() || null,
          venue: venue.trim(),
          gigDate: new Date(newGig.date),
          bandId: selectedBandId,
          responseDeadline: responseDeadline,
          notes: notes.trim() || null,
          attire: attire.trim() || null,
          rehearsalInfo: includeRehearsal && rehearsalDate ? {
            date: new Date(rehearsalDate),
            time: rehearsalTime,
            venue: useGigVenueForRehearsal ? venue.trim() : rehearsalVenue.trim(),
          } : null,
        });

        toast({
          title: includeRehearsal ? "Gig & Rehearsal added" : "Gig added & invites sent",
          description: `Successfully scheduled gig${includeRehearsal ? ' with rehearsal' : ''} and invited ${selectedMembers.length} member(s).${includeRehearsal && rehearsalDate ? `\n\nRehearsal scheduled for ${format(rehearsalDate, "PPP")} at ${rehearsalTime}` : ''}`,
        });
      } else {
        toast({
          title: includeRehearsal ? "Gig & Rehearsal added" : "Gig added",
          description: includeRehearsal 
            ? "The gig and rehearsal have been scheduled successfully."
            : "The gig has been scheduled successfully.",
        });
      }

      // Reset form and refresh data
      setDate(undefined);
      setShowTime("19:00");
      setEndTime("23:00");
      setLoadingTime("");
      setSoundCheckTime("");
      setVenueName("");
      setVenue("");
      setVenueLat(null);
      setVenueLng(null);
      setNotes("");
      setAttire("");
      setFoodProvided("");
      setVenueContactPerson("");
      setSoundManInfo("");
      setSelectedMembers([]);
      // Reset rehearsal fields
      setIncludeRehearsal(false);
      setRehearsalDate(undefined);
      setRehearsalTime("18:00");
      setRehearsalEndTime("21:00");
      setRehearsalVenue("");
      setRehearsalVenueLat(null);
      setRehearsalVenueLng(null);
      setRehearsalNotes("");
      setUseGigVenueForRehearsal(false);
      checkAuthAndFetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to add gig",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteMembers = async () => {
    if (!currentGigForInvite || selectedMembers.length === 0) {
      toast({
        variant: "destructive",
        title: "No members selected",
        description: "Please select at least one group member to invite.",
      });
      return;
    }

    try {
      // Check for existing invitations to avoid duplicates
      const { data: existingInvites } = await supabase
        .from("gig_members")
        .select("member_id")
        .eq("gig_id", currentGigForInvite)
        .in("member_id", selectedMembers);

      const alreadyInvitedIds = new Set(existingInvites?.map(i => i.member_id) || []);
      const newMembers = selectedMembers.filter(id => !alreadyInvitedIds.has(id));

      if (newMembers.length === 0) {
        toast({
          variant: "destructive",
          title: "Already invited",
          description: "All selected members have already been invited to this gig.",
        });
        return;
      }

      // Calculate response deadline (default 2 hours for additional invites)
      const responseDeadline = new Date();
      responseDeadline.setHours(responseDeadline.getHours() + 2);

      const invites = newMembers.map(memberId => ({
        gig_id: currentGigForInvite,
        member_id: memberId,
        status: 'pending',
        response_deadline: responseDeadline.toISOString(),
      }));

      const { error } = await supabase
        .from("gig_members")
        .insert(invites);

      if (error) throw error;

      // Send push notifications and emails to newly invited members
      const gig = gigs.find(g => g.id === currentGigForInvite);
      const rehearsal = gigRehearsals[currentGigForInvite];
      if (gig && newMembers.length > 0) {
        sendGigPushNotifications({
          gigId: currentGigForInvite,
          memberIds: newMembers,
          venueName: gig.venue_name,
          venue: gig.venue,
          gigDate: new Date(gig.date),
          bandId: selectedBandId,
          responseDeadline: responseDeadline,
          notes: gig.notes,
          attire: gig.attire,
          rehearsalInfo: rehearsal ? {
            date: new Date(rehearsal.date),
            time: format(new Date(rehearsal.date), 'h:mm a'),
            venue: rehearsal.venue,
          } : null,
        });
      }

      const skippedCount = selectedMembers.length - newMembers.length;
      toast({
        title: "Invitations sent",
        description: skippedCount > 0 
          ? `Invited ${newMembers.length} member(s). ${skippedCount} already invited.`
          : `Successfully invited ${newMembers.length} member(s) to the gig.`,
      });

      setInviteDialogOpen(false);
      setSelectedMembers([]);
      setCurrentGigForInvite(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send invitations",
        description: error.message,
      });
    }
  };

  const handleResendInvitation = async (memberId: string) => {
    if (!currentGigForInvite) return;
    
    setResendingMemberId(memberId);
    try {
      const gig = gigs.find(g => g.id === currentGigForInvite);
      const rehearsal = gigRehearsals[currentGigForInvite];
      
      if (!gig) throw new Error("Gig not found");

      // Update the response deadline
      const responseDeadline = new Date();
      responseDeadline.setHours(responseDeadline.getHours() + 2);

      await supabase
        .from("gig_members")
        .update({ 
          response_deadline: responseDeadline.toISOString(),
          status: 'pending' // Reset to pending if they want to re-respond
        })
        .eq("gig_id", currentGigForInvite)
        .eq("member_id", memberId);

      // Resend notifications
      await sendGigPushNotifications({
        gigId: currentGigForInvite,
        memberIds: [memberId],
        venueName: gig.venue_name,
        venue: gig.venue,
        gigDate: new Date(gig.date),
        bandId: selectedBandId,
        responseDeadline: responseDeadline,
        notes: gig.notes,
        attire: gig.attire,
        rehearsalInfo: rehearsal ? {
          date: new Date(rehearsal.date),
          time: format(new Date(rehearsal.date), 'h:mm a'),
          venue: rehearsal.venue,
        } : null,
      });

      const member = bandMembers.find(m => m.id === memberId);
      toast({
        title: "Invitation resent",
        description: `Resent invitation to ${member?.name || 'member'}.`,
      });

      // Update local state
      setCurrentGigInvitedMembers(prev => 
        prev.map(m => m.member_id === memberId ? { ...m, status: 'pending' } : m)
      );
    } catch (error: any) {
      console.error("Error resending invitation:", error);
      toast({
        variant: "destructive",
        title: "Failed to resend",
        description: error.message,
      });
    } finally {
      setResendingMemberId(null);
    }
  };

  const handleResendAllPending = async () => {
    if (!currentGigForInvite) return;
    
    const pendingMembers = currentGigInvitedMembers.filter(m => m.status === 'pending');
    if (pendingMembers.length === 0) {
      toast({
        title: "No pending invitations",
        description: "There are no pending invitations to resend.",
      });
      return;
    }

    setResendingAll(true);
    try {
      const gig = gigs.find(g => g.id === currentGigForInvite);
      const rehearsal = gigRehearsals[currentGigForInvite];
      
      if (!gig) throw new Error("Gig not found");

      // Update response deadlines for all pending members
      const responseDeadline = new Date();
      responseDeadline.setHours(responseDeadline.getHours() + 2);
      const pendingMemberIds = pendingMembers.map(m => m.member_id);

      await supabase
        .from("gig_members")
        .update({ response_deadline: responseDeadline.toISOString() })
        .eq("gig_id", currentGigForInvite)
        .in("member_id", pendingMemberIds);

      // Resend notifications to all pending members
      await sendGigPushNotifications({
        gigId: currentGigForInvite,
        memberIds: pendingMemberIds,
        venueName: gig.venue_name,
        venue: gig.venue,
        gigDate: new Date(gig.date),
        bandId: selectedBandId,
        responseDeadline: responseDeadline,
        notes: gig.notes,
        attire: gig.attire,
        rehearsalInfo: rehearsal ? {
          date: new Date(rehearsal.date),
          time: format(new Date(rehearsal.date), 'h:mm a'),
          venue: rehearsal.venue,
        } : null,
      });

      toast({
        title: "All invitations resent",
        description: `Resent invitations to ${pendingMembers.length} pending member(s).`,
      });
    } catch (error: any) {
      console.error("Error resending all invitations:", error);
      toast({
        variant: "destructive",
        title: "Failed to resend",
        description: error.message,
      });
    } finally {
      setResendingAll(false);
    }
  };

  const openInviteDialog = async (gigId: string) => {
    setCurrentGigForInvite(gigId);
    
    // Fetch already invited members and email tracking for this gig
    const [invitedMembersRes, emailTrackingRes] = await Promise.all([
      supabase
        .from("gig_members")
        .select("member_id, status")
        .eq("gig_id", gigId),
      supabase
        .from("email_tracking")
        .select("member_id, status, delivered_at, opened_at, clicked_at")
        .eq("gig_id", gigId)
    ]);
    
    setCurrentGigInvitedMembers(invitedMembersRes.data || []);
    
    // Create a map of member_id to email tracking data
    const trackingMap: Record<string, { status: string; delivered_at: string | null; opened_at: string | null; clicked_at: string | null }> = {};
    emailTrackingRes.data?.forEach(t => {
      trackingMap[t.member_id] = {
        status: t.status,
        delivered_at: t.delivered_at,
        opened_at: t.opened_at,
        clicked_at: t.clicked_at
      };
    });
    setCurrentGigEmailTracking(trackingMap);
    
    setInviteDialogOpen(true);
  };

  const handleDeleteGig = async (id: string) => {
    try {
      const { error } = await supabase
        .from("gigs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Gig deleted",
        description: "The gig has been removed.",
      });

      checkAuthAndFetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to delete gig",
        description: error.message,
      });
    }
  };

  const handleDeleteBookingRequest = async (id: string) => {
    if (!confirm("Delete this booking request? This cannot be undone.")) return;
    try {
      const { error } = await supabase.from("booking_requests").delete().eq("id", id);
      if (error) throw error;
      setBookingRequests((prev) => prev.filter((b: any) => b.id !== id));
      toast({ title: "Booking request deleted" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: error.message });
    }
  };

  const handleDeleteGigInvitation = async (id: string) => {
    if (!confirm("Delete this gig invitation?")) return;
    try {
      const { error } = await supabase.from("gig_members").delete().eq("id", id);
      if (error) throw error;
      setGigInvitations((prev: any) => prev.filter((g: any) => g.id !== id));
      toast({ title: "Invitation deleted" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: error.message });
    }
  };

  const openEditGigDialog = (gig: Gig) => {
    setEditingGig(gig);
    const gigDate = new Date(gig.date);
    setEditDate(gigDate);
    setEditShowTime(format(gigDate, "HH:mm"));
    setEditEndTime(gig.end_time || "23:00");
    setEditLoadingTime(gig.loading_time || "");
    setEditSoundCheckTime(gig.sound_check_time || "");
    setEditVenueName(gig.venue_name || "");
    setEditVenue(gig.venue);
    setEditVenueLat(gig.venue_lat);
    setEditVenueLng(gig.venue_lng);
    setEditNotes(gig.notes || "");
    setEditAttire(gig.attire || "");
    setEditFoodProvided(gig.food_provided || "");
    setEditVenueContactPerson(gig.venue_contact_person || "");
    setEditSoundManInfo(gig.sound_man_info || "");
    setEditAutoRemindersDisabled((gig as any).auto_reminders_disabled ?? false);
    setEditDialogOpen(true);
  };

  const handleUpdateGig = async () => {
    if (!editingGig || !editDate || !editVenue.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a date and enter a venue.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const [hours, minutes] = editShowTime.split(":").map(Number);
      const gigDateTime = new Date(editDate);
      gigDateTime.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from("gigs")
        .update({
          date: gigDateTime.toISOString(),
          end_time: editEndTime,
          loading_time: editLoadingTime.trim() || null,
          sound_check_time: editSoundCheckTime.trim() || null,
          venue_name: editVenueName.trim() || null,
          venue: editVenue.trim(),
          venue_lat: editVenueLat,
          venue_lng: editVenueLng,
          notes: editNotes.trim() || null,
          attire: editAttire.trim() || null,
          food_provided: editFoodProvided.trim() || null,
          venue_contact_person: editVenueContactPerson.trim() || null,
          sound_man_info: editSoundManInfo.trim() || null,
          auto_reminders_disabled: editAutoRemindersDisabled,
        })
        .eq("id", editingGig.id);

      if (error) throw error;

      toast({
        title: "Gig updated",
        description: "The gig has been updated successfully.",
      });

      setEditDialogOpen(false);
      setEditingGig(null);
      checkAuthAndFetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update gig",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const isBandLeader = userRole === "booking_manager" || userRole === "super_admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 pb-20">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Gigs & Bookings
            </h1>
            <p className="text-muted-foreground mt-1">
              {isBandLeader ? "Manage your group's performance schedule" : "View upcoming gigs"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/rehearsals")}>
              <Music className="h-4 w-4 mr-2" />
              Rehearsals
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        {isBandLeader && bands.length > 0 && (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Label htmlFor="group-select" className="text-sm font-medium whitespace-nowrap">
                  Current Group:
                </Label>
                <Select value={selectedBandId || undefined} onValueChange={setSelectedBandId}>
                  <SelectTrigger id="group-select" className="w-full max-w-sm">
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {bands.map((band) => (
                      <SelectItem key={band.id} value={band.id}>
                        {band.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {isBandLeader && bands.length === 0 && (
          <Card className="border-border/50 shadow-lg bg-gradient-to-br from-destructive/5 to-destructive/10">
            <CardContent className="pt-6 text-center">
              <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Groups Created</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You need to create a group first before you can add gigs.
              </p>
              <Button onClick={() => navigate("/dashboard")}>
                Go to Dashboard to Create Group
              </Button>
            </CardContent>
          </Card>
        )}

        {isBandLeader && selectedBandId && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Schedule New Gig
              </CardTitle>
              <CardDescription>Add a new performance to your calendar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GigTemplateSelector
                currentValues={{
                  venueName,
                  venue,
                  venueLat,
                  venueLng,
                  showTime,
                  endTime,
                  loadingTime,
                  soundCheckTime,
                  attire,
                  foodProvided,
                  venueContactPerson,
                  soundManInfo,
                  notes,
                }}
                onSelectTemplate={(values) => {
                  setVenueName(values.venueName);
                  setVenue(values.venue);
                  setVenueLat(values.venueLat);
                  setVenueLng(values.venueLng);
                  setShowTime(values.showTime);
                  setEndTime(values.endTime);
                  setLoadingTime(values.loadingTime);
                  setSoundCheckTime(values.soundCheckTime);
                  setAttire(values.attire);
                  setFoodProvided(values.foodProvided);
                  setVenueContactPerson(values.venueContactPerson);
                  setSoundManInfo(values.soundManInfo);
                  setNotes(values.notes);
                }}
              />
              
              <div className="space-y-2">
                <Label htmlFor="venueName">Venue Name (Optional)</Label>
                <Input
                  id="venueName"
                  placeholder="e.g., Blue Note Jazz Club, City Arena..."
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue">Venue Address</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <PlaceAutocomplete
                    value={venue}
                    onChange={async (value, placeDetails) => {
                      setVenue(value);
                      let lat: number | null = null;
                      let lng: number | null = null;
                      let placeName: string | null = null;
                      
                      if (placeDetails?.geometry?.location) {
                        lat = placeDetails.geometry.location.lat();
                        lng = placeDetails.geometry.location.lng();
                        setVenueLat(lat);
                        setVenueLng(lng);
                      }
                      
                      // Extract venue name from place details
                      if (placeDetails?.name) {
                        placeName = placeDetails.name;
                        setVenueName(placeName);
                      }
                      
                      // Auto-save as template if venue has coordinates
                      if (value && lat && lng) {
                        try {
                          const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
                          if (!user) return;
                          
                          // Check if template already exists for this venue
                          const { data: existingTemplates } = await supabase
                            .from("gig_templates")
                            .select("id")
                            .eq("user_id", user.id)
                            .eq("venue", value)
                            .limit(1);
                          
                          // Only create if no existing template
                          if (!existingTemplates || existingTemplates.length === 0) {
                            await supabase.from("gig_templates").insert({
                              user_id: user.id,
                              name: placeName || value.split(",")[0],
                              venue: value,
                              venue_name: placeName,
                              venue_lat: lat,
                              venue_lng: lng,
                            });
                            
                            toast({
                              title: "Venue saved",
                              description: "This venue has been saved as a template for quick access.",
                            });
                          }
                        } catch (error) {
                          console.error("Failed to auto-save template:", error);
                        }
                      }
                    }}
                    placeholder="Start typing a venue address..."
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="showTime">Show Time</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="showTime"
                        type="time"
                        value={showTime}
                        onChange={(e) => setShowTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loadingTime">Load-in Time (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="loadingTime"
                      type="time"
                      value={loadingTime}
                      onChange={(e) => setLoadingTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="soundCheckTime">Sound Check Time (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="soundCheckTime"
                      type="time"
                      value={soundCheckTime}
                      onChange={(e) => setSoundCheckTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Performance details, setlist info, special requirements..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attire">Attire (Optional)</Label>
                <Input
                  id="attire"
                  placeholder="e.g., Black tie, Casual, Group uniform..."
                  value={attire}
                  onChange={(e) => setAttire(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="foodProvided">Food Provided (Optional)</Label>
                <Input
                  id="foodProvided"
                  placeholder="e.g., Dinner included, Refreshments only..."
                  value={foodProvided}
                  onChange={(e) => setFoodProvided(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venueContactPerson">Venue Contact Person (Optional)</Label>
                <Input
                  id="venueContactPerson"
                  placeholder="e.g., John Smith, 555-1234..."
                  value={venueContactPerson}
                  onChange={(e) => setVenueContactPerson(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="soundManInfo">Sound Man Information (Optional)</Label>
                <Input
                  id="soundManInfo"
                  placeholder="e.g., Mike Johnson, 555-5678..."
                  value={soundManInfo}
                  onChange={(e) => setSoundManInfo(e.target.value)}
                />
              </div>

              {/* Rehearsal Section */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Music className="h-4 w-4" />
                    Include Rehearsal
                  </Label>
                  <Switch
                    checked={includeRehearsal}
                    onCheckedChange={setIncludeRehearsal}
                  />
                </div>
                
                {includeRehearsal && (
                  <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Rehearsal Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !rehearsalDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {rehearsalDate ? format(rehearsalDate, "PPP") : <span>Pick rehearsal date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={rehearsalDate}
                              onSelect={setRehearsalDate}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label htmlFor="rehearsalTime">Start Time</Label>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input
                              id="rehearsalTime"
                              type="time"
                              value={rehearsalTime}
                              onChange={(e) => setRehearsalTime(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="rehearsalEndTime">End Time</Label>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input
                              id="rehearsalEndTime"
                              type="time"
                              value={rehearsalEndTime}
                              onChange={(e) => setRehearsalEndTime(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Rehearsal Location</Label>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="useGigVenue"
                            checked={useGigVenueForRehearsal}
                            onCheckedChange={(checked) => setUseGigVenueForRehearsal(checked as boolean)}
                          />
                          <label htmlFor="useGigVenue" className="text-sm text-muted-foreground cursor-pointer">
                            Same as gig venue
                          </label>
                        </div>
                      </div>
                      {!useGigVenueForRehearsal && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <PlaceAutocomplete
                            value={rehearsalVenue}
                            onChange={(value, placeDetails) => {
                              setRehearsalVenue(value);
                              if (placeDetails?.geometry?.location) {
                                setRehearsalVenueLat(placeDetails.geometry.location.lat());
                                setRehearsalVenueLng(placeDetails.geometry.location.lng());
                              }
                            }}
                            placeholder="Enter rehearsal location..."
                          />
                        </div>
                      )}
                      {useGigVenueForRehearsal && venue && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {venueName || venue}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rehearsalNotes">Rehearsal Notes (Optional)</Label>
                      <Textarea
                        id="rehearsalNotes"
                        placeholder="Songs to practice, focus areas, what to bring..."
                        value={rehearsalNotes}
                        onChange={(e) => setRehearsalNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Invite Group Members (Optional)
                </Label>
                
                {/* Response Deadline Selector */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label htmlFor="responseDeadline" className="text-xs text-muted-foreground">
                      Response deadline
                    </Label>
                    <Select value={responseDeadlineHours} onValueChange={setResponseDeadlineHours}>
                      <SelectTrigger id="responseDeadline" className="h-8 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hour</SelectItem>
                        <SelectItem value="2">2 hours</SelectItem>
                        <SelectItem value="4">4 hours</SelectItem>
                        <SelectItem value="8">8 hours</SelectItem>
                        <SelectItem value="24">24 hours</SelectItem>
                        <SelectItem value="48">48 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-[140px]">
                    Auto-replacement if no response
                  </p>
                </div>
                {bandMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No group members available to invite</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                    {bandMembers.map((member) => (
                      <div key={member.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`invite-${member.id}`}
                          checked={selectedMembers.includes(member.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedMembers([...selectedMembers, member.id]);
                            } else {
                              setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={`invite-${member.id}`}
                          className="text-sm flex-1 cursor-pointer"
                        >
                          {member.name}
                          {member.instrument && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({member.instrument})
                            </span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleAddGig} disabled={isSubmitting} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {includeRehearsal ? "Add Gig & Rehearsal" : "Add Gig"} {selectedMembers.length > 0 && `& Invite ${selectedMembers.length}`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Calendar overview — highlights all booking dates */}
        {(() => {
          const requestDatesRaw: Date[] = [];
          const invitationDatesRaw: Date[] = [];
          const confirmedDates: Date[] = [];
          // Booking requests created from the calendar should reserve the date immediately.
          bookingRequests.forEach((br: any) => {
            const dates = getBookingRequestCalendarDates(br);
            const status = (br.status || "").toLowerCase();
            if (status !== "declined" && status !== "rejected" && status !== "cancelled" && status !== "expired") {
              confirmedDates.push(...dates);
            }
          });
          // Gig invitations: accepted -> booked (blue), pending -> tentative (yellow)
          gigInvitations.forEach((gi: any) => {
            if (!gi.gigs?.date) return;
            const d = new Date(gi.gigs.date);
            const status = (gi.status || "").toLowerCase();
            if (status === "accepted" || status === "confirmed") {
              confirmedDates.push(d);
            } else if (status !== "declined" && status !== "rejected") {
              invitationDatesRaw.push(d);
            }
          });
          gigs.forEach((g) => {
            if (g.date) confirmedDates.push(new Date(g.date));
          });
          // Priority: confirmed (booked) > invitation (tentative) > request (unavailable)
          const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isFutureOrToday = (d: Date) => {
            const x = new Date(d);
            x.setHours(0, 0, 0, 0);
            return x.getTime() >= today.getTime();
          };
          const confirmedDatesFiltered = confirmedDates.filter(isFutureOrToday);
          const confirmedKeys = new Set(confirmedDatesFiltered.map(dayKey));
          const invitationDates = invitationDatesRaw
            .filter(isFutureOrToday)
            .filter((d) => !confirmedKeys.has(dayKey(d)));
          const invitationKeys = new Set(invitationDates.map(dayKey));
          const requestDates = requestDatesRaw
            .filter(isFutureOrToday)
            .filter((d) => !confirmedKeys.has(dayKey(d)) && !invitationKeys.has(dayKey(d)));
          const allDates = [...requestDates, ...invitationDates, ...confirmedDatesFiltered];
          return (
            <Card className="border-border/50 shadow-lg mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  Booking Calendar
                </CardTitle>
                <CardDescription>
                  Highlighted dates show all scheduled bookings across your performers
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center overflow-hidden">
                <div className="scale-[1.6] origin-top transform-gpu" style={{ marginBottom: 'calc(1.6 * 350px - 350px)' }}>
                  <Calendar
                    mode="single"
                    selected={selectedCalendarDate ?? undefined}
                    onSelect={(d) => d && setSelectedCalendarDate(normalizeCalendarSelection(d))}
                    modifiers={{
                      confirmed: confirmedDatesFiltered,
                      invitation: invitationDates,
                      request: requestDates,
                    }}
                    modifiersClassNames={{
                      confirmed: "!bg-blue-500 !text-white hover:!bg-blue-500/90 rounded-full font-semibold cursor-pointer",
                      invitation: "!bg-yellow-400 !text-black hover:!bg-yellow-400/90 rounded-full font-semibold cursor-pointer",
                      request: "!bg-red-500 !text-white hover:!bg-red-500/90 rounded-full font-semibold cursor-pointer",
                    }}
                    className="rounded-md border border-border/50"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm mt-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-muted-foreground">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">Unavailable</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />
                    <span className="text-muted-foreground">Tentative</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-muted-foreground">Booked</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Date details dialog */}
        <Dialog open={!!selectedCalendarDate} onOpenChange={(o) => !o && setSelectedCalendarDate(null)}>
          <DialogContent className="max-w-lg bg-black/60 backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                {selectedCalendarDate && format(selectedCalendarDate, "EEEE, MMMM d, yyyy")}
              </DialogTitle>
              <DialogDescription>Bookings scheduled for this date</DialogDescription>
            </DialogHeader>
            {(() => {
              if (!selectedCalendarDate) return null;
              const sameDay = (a: string | Date | undefined) => {
                if (!a) return false;
                const d = new Date(a);
                return d.getFullYear() === selectedCalendarDate.getFullYear() &&
                  d.getMonth() === selectedCalendarDate.getMonth() &&
                  d.getDate() === selectedCalendarDate.getDate();
              };
              const dayConfirmed = gigs.filter((g) => sameDay(g.date));
              const dayInvites = gigInvitations.filter((gi: any) => sameDay(gi.gigs?.date));
              const dayRequests = bookingRequests.filter((br: any) => getBookingRequestCalendarDates(br).some(sameDay));
              const total = dayConfirmed.length + dayInvites.length + dayRequests.length;
              const canQuickBook = managedArtists.length > 0;
              return (
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  {total === 0 ? (
                    <p className="text-sm text-muted-foreground">No bookings on this date yet.</p>
                  ) : (
                    <>
                      {dayConfirmed.map((g) => (
                        <div key={`g-${g.id}`} className="rounded-lg border border-border/50 p-3 space-y-1 relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7"
                            onClick={() => handleDeleteGig(g.id)}
                            aria-label="Delete booking"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                            <Badge variant="secondary">Confirmed gig</Badge>
                          </div>
                          <div className="font-semibold pr-8">{g.venue_name || g.venue}</div>
                          {g.venue_name && <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{g.venue}</div>}
                        </div>
                      ))}
                      {dayInvites.map((gi: any) => (
                        <div key={`i-${gi.id}`} className="rounded-lg border border-border/50 p-3 space-y-1 relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7"
                            onClick={() => handleDeleteGigInvitation(gi.id)}
                            aria-label="Delete invitation"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                            <Badge variant="secondary">Gig invitation</Badge>
                          </div>
                          <div className="font-semibold pr-8">{gi.gigs?.venue_name || gi.gigs?.venue}</div>
                          {gi.gigs?.venue && <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{gi.gigs.venue}</div>}
                          <div className="text-xs text-muted-foreground">Status: {gi.status}</div>
                        </div>
                      ))}
                      {dayRequests.map((br: any) => (
                        <div key={`r-${br.id}`} className="rounded-lg border border-border/50 p-3 space-y-1 relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7"
                            onClick={() => handleDeleteBookingRequest(br.id)}
                            aria-label="Delete booking request"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              br.status === "declined" || br.status === "rejected" || br.status === "cancelled" || br.status === "expired" ? "bg-red-500" : "bg-blue-500"
                            )} />
                            <Badge variant="secondary">Booking request</Badge>
                          </div>
                          <div className="font-semibold pr-8">{br.venue}</div>
                          {br.performer_name && <div className="text-xs text-muted-foreground">Performer: {br.performer_name}</div>}
                          <div className="text-xs text-muted-foreground">Status: {br.status}</div>
                        </div>
                      ))}
                    </>
                  )}

                  {canQuickBook && (
                    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3">
                      <div className="font-semibold flex items-center gap-2">
                        <Send className="h-4 w-4 text-primary" />
                        Book a performer for this date
                      </div>
                      <div className="space-y-2">
                        <Label>Performer</Label>
                        <Select value={quickBookPerformerId} onValueChange={setQuickBookPerformerId}>
                          <SelectTrigger><SelectValue placeholder="Select performer" /></SelectTrigger>
                          <SelectContent>
                            {managedArtists.map((a) => (
                              <SelectItem key={a.artist_id} value={a.artist_id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>Start</Label>
                          <Input type="time" value={quickBookStart} onChange={(e) => setQuickBookStart(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>End</Label>
                          <Input type="time" value={quickBookEnd} onChange={(e) => setQuickBookEnd(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Venue *</Label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <PlaceAutocomplete
                              value={quickBookVenue}
                              onChange={(val, place) => {
                                const lat = place?.geometry?.location?.lat?.();
                                const lng = place?.geometry?.location?.lng?.();
                                const phone = (place as any)?.formatted_phone_number || (place as any)?.international_phone_number;
                                const placeName = (place as any)?.name as string | undefined;
                                const formatted = (place as any)?.formatted_address as string | undefined;
                                let combined = val;
                                if (placeName && formatted && !formatted.toLowerCase().startsWith(placeName.toLowerCase())) {
                                  combined = `${placeName} — ${formatted}`;
                                }
                                setQuickBookVenue(combined);
                                if (typeof lat === "number") setQuickBookVenueLat(lat);
                                if (typeof lng === "number") setQuickBookVenueLng(lng);
                                if (phone) setQuickBookVenuePhone(phone);
                              }}
                              placeholder="Search venue or address"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Navigate"
                            disabled={!quickBookVenue.trim() && quickBookVenueLat == null}
                            onClick={() => {
                              const dest = quickBookVenueLat != null && quickBookVenueLng != null
                                ? `${quickBookVenueLat},${quickBookVenueLng}`
                                : quickBookVenue.trim();
                              window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, "_blank");
                            }}
                          >
                            <Navigation className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Venue Phone</Label>
                        <Input type="tel" placeholder="In case you're running late" value={quickBookVenuePhone} onChange={(e) => setQuickBookVenuePhone(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Budget (optional)</Label>
                        <Input value={quickBookBudget} onChange={(e) => setQuickBookBudget(e.target.value)} placeholder="e.g. $500" />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Person</Label>
                        <Input placeholder="Venue contact name" value={quickBookContactPerson} onChange={(e) => setQuickBookContactPerson(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Dress Code</Label>
                        <Input placeholder="e.g. all black, formal" value={quickBookDressCode} onChange={(e) => setQuickBookDressCode(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Note (optional)</Label>
                        <Textarea placeholder="Any extra details..." value={quickBookNote} onChange={(e) => setQuickBookNote(e.target.value)} />
                      </div>
                      <Button
                        className="w-full"
                        disabled={quickBookSubmitting || !quickBookPerformerId || !quickBookVenue.trim()}
                        onClick={async () => {
                          if (!selectedCalendarDate || !quickBookPerformerId || !quickBookVenue.trim()) return;
                          setQuickBookSubmitting(true);
                          try {
                            const { data: { session } } = await supabase.auth.getSession();
                            const user = session?.user;
                            if (!user) throw new Error("Not authenticated");
                            const performer = managedArtists.find((a) => a.artist_id === quickBookPerformerId);
                            if (!performer?.email) throw new Error("Performer has no email on file.");
                            const eventDate = new Date(selectedCalendarDate);
                            const [hh, mm] = (quickBookStart || "19:00").split(":").map(Number);
                            eventDate.setHours(hh || 19, mm || 0, 0, 0);
                            const { data: senderProfile } = await supabase
                              .from("profiles")
                              .select("name, email")
                              .eq("id", user.id)
                              .maybeSingle();
                            const datesStr = format(selectedCalendarDate, "EEE, MMM d, yyyy");
                            const timeStr = `(${quickBookStart}${quickBookEnd ? ` – ${quickBookEnd}` : ""})`;

                            const lines = [
                              `Booking request for ${performer.name}`,
                              `Date: ${datesStr} ${timeStr}`,
                              `Venue: ${quickBookVenue.trim()}`,
                              quickBookVenuePhone.trim() ? `Venue Phone: ${quickBookVenuePhone.trim()}` : null,
                              quickBookBudget.trim() ? `Budget: ${quickBookBudget.trim()}` : null,
                              quickBookContactPerson.trim() ? `Contact Person: ${quickBookContactPerson.trim()}` : null,
                              quickBookDressCode.trim() ? `Dress Code: ${quickBookDressCode.trim()}` : null,
                              quickBookNote.trim() ? `Note: ${quickBookNote.trim()}` : null,
                            ].filter(Boolean).join("\n");

                            await supabase.from("messages").insert({
                              sender_id: user.id,
                              recipient_id: quickBookPerformerId,
                              content: lines,
                              is_group_message: false,
                            });

                            const { data: bookingEmailData, error } = await supabase.functions.invoke("send-booking-request-email", {
                              body: {
                                performerId: quickBookPerformerId,
                                performerEmail: performer.email,
                                performerName: performer.name,
                                bookerName: senderProfile?.name,
                                bookerEmail: senderProfile?.email || user.email,
                                dates: datesStr,
                                time: timeStr,
                                venue: quickBookVenue.trim(),
                                venuePhone: quickBookVenuePhone.trim() || undefined,
                                budget: quickBookBudget.trim() || undefined,
                                contactPerson: quickBookContactPerson.trim() || undefined,
                                dressCode: quickBookDressCode.trim() || undefined,
                                note: quickBookNote.trim() || undefined,
                                eventDate: eventDate.toISOString(),
                                appUrl: window.location.hostname.endsWith("lovable.app") || window.location.hostname.endsWith("lovable.dev") ? "https://giggme.com" : window.location.origin,
                              },
                            });
                            if (error) throw error;

                            if (bookingEmailData?.bookingRequestId) {
                              setBookingRequests((prev) => [{
                                id: bookingEmailData.bookingRequestId,
                                status: "pending",
                                booker_name: senderProfile?.name,
                                performer_name: performer.name,
                                dates_text: datesStr,
                                time_text: timeStr,
                                venue: quickBookVenue.trim(),
                                budget: quickBookBudget.trim() || null,
                                contact_person: quickBookContactPerson.trim() || null,
                                event_date: eventDate.toISOString(),
                                created_at: new Date().toISOString(),
                                performer_id: quickBookPerformerId,
                                booker_id: user.id,
                              }, ...prev]);
                            }

                            // Fire push notification to the performer
                            try {
                              await supabase.functions.invoke("send-push-notification", {
                                body: {
                                  user_id: quickBookPerformerId,
                                  title: "🎤 New Booking Request",
                                  body: `${senderProfile?.name || "Someone"} sent you a booking request for ${datesStr} at ${quickBookVenue.trim()}`,
                                  url: "/bookings",
                                  data: { type: "booking_request", performer_id: quickBookPerformerId },
                                },
                              });
                            } catch (pushErr) {
                              console.warn("Push notification failed", pushErr);
                            }

                            toast({ title: "Booking request sent", description: `Sent to ${performer.name}.` });
                            setQuickBookPerformerId("");
                            setQuickBookVenue("");
                            setQuickBookVenueLat(null);
                            setQuickBookVenueLng(null);
                            setQuickBookVenuePhone("");
                            setQuickBookBudget("");
                            setQuickBookContactPerson("");
                            setQuickBookDressCode("");
                            setQuickBookNote("");
                            setSelectedCalendarDate(null);
                            await checkAuthAndFetchData();
                          } catch (err: any) {
                            toast({ variant: "destructive", title: "Could not send request", description: err.message });
                          } finally {
                            setQuickBookSubmitting(false);
                          }
                        }}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {quickBookSubmitting ? "Sending..." : "Send Booking Request"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>


        {/* Current bookings (booking requests + gig invitations) */}

        {(bookingRequests.length > 0 || gigInvitations.length > 0) && (
          <Card className="border-border/50 shadow-lg mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                Current Bookings
              </CardTitle>
              <CardDescription>Your booking requests and gig invitations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bookingRequests.map((br) => (
                <div
                  key={`br-${br.id}`}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-accent/40 transition-colors"
                  onClick={() => navigate(`/booking-request/${br.id}`)}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={br.status === 'accepted' ? 'default' : br.status === 'pending' ? 'secondary' : 'outline'}>
                          {br.status}
                        </Badge>
                        <Badge variant="outline">Booking Request</Badge>
                      </div>
                      <p className="font-semibold truncate">{br.venue}</p>
                      <p className="text-sm text-muted-foreground">
                        {br.booker_id === br.performer_id
                          ? `${br.dates_text}`
                          : br.performer_id && br.booker_name && br.performer_name
                            ? `${br.booker_name} → ${br.performer_name} · ${br.dates_text}`
                            : `From ${br.booker_name || 'a client'} · ${br.dates_text}`}
                        {br.time_text && ` · ${br.time_text}`}
                      </p>
                      {br.budget && (
                        <p className="text-xs text-muted-foreground mt-1">Budget: {br.budget}</p>
                      )}
                    </div>
                    {br.booker_id === currentUserId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRequest(br);
                          setEditForm({
                            venue: br.venue || "",
                            dates_text: br.dates_text || "",
                            time_text: br.time_text || "",
                            budget: br.budget || "",
                            note: br.note || "",
                          });
                        }}
                        aria-label="Edit booking request"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {gigInvitations.map((gi: any) => (
                <div key={`gi-${gi.id}`} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant={gi.status === 'accepted' ? 'default' : gi.status === 'pending' ? 'secondary' : 'outline'}>
                      {gi.status}
                    </Badge>
                    <Badge variant="outline">Group Gig</Badge>
                  </div>
                  <p className="font-semibold truncate">{gi.gigs?.venue_name || gi.gigs?.venue}</p>
                  <p className="text-sm text-muted-foreground">
                    {gi.gigs?.date && format(new Date(gi.gigs.date), "PPP p")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Dialog open={!!editingRequest} onOpenChange={(open) => !open && setEditingRequest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Booking Request</DialogTitle>
              <DialogDescription>Update the details for this booking request.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="edit-venue">Venue</Label>
                <Input id="edit-venue" value={editForm.venue} onChange={(e) => setEditForm((f) => ({ ...f, venue: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="edit-dates">Date(s)</Label>
                <Input id="edit-dates" value={editForm.dates_text} onChange={(e) => setEditForm((f) => ({ ...f, dates_text: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="edit-time">Time</Label>
                <Input id="edit-time" value={editForm.time_text} onChange={(e) => setEditForm((f) => ({ ...f, time_text: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="edit-budget">Budget</Label>
                <Input id="edit-budget" value={editForm.budget} onChange={(e) => setEditForm((f) => ({ ...f, budget: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="edit-note">Note</Label>
                <Textarea id="edit-note" value={editForm.note} onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingRequest(null)} disabled={savingEdit}>Cancel</Button>
                <Button
                  disabled={savingEdit}
                  onClick={async () => {
                    if (!editingRequest) return;
                    setSavingEdit(true);
                    const { error } = await supabase
                      .from("booking_requests")
                      .update({
                        venue: editForm.venue,
                        dates_text: editForm.dates_text,
                        time_text: editForm.time_text || null,
                        budget: editForm.budget || null,
                        note: editForm.note || null,
                      })
                      .eq("id", editingRequest.id);
                    setSavingEdit(false);
                    if (error) {
                      toast({ title: "Update failed", description: error.message, variant: "destructive" });
                      return;
                    }
                    setBookingRequests((prev) => prev.map((b: any) => b.id === editingRequest.id ? { ...b, ...editForm, time_text: editForm.time_text || null, budget: editForm.budget || null, note: editForm.note || null } : b));
                    setEditingRequest(null);
                    toast({ title: "Booking request updated" });
                  }}
                >
                  {savingEdit ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>


        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-primary" />
                  Scheduled Gigs
                </CardTitle>
                <CardDescription>Upcoming performances and bookings</CardDescription>
              </div>
              {userRole === "booking_manager" && (
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="pending-filter" className="text-sm text-muted-foreground cursor-pointer">
                    Pending only
                  </Label>
                  <Switch
                    id="pending-filter"
                    checked={showPendingOnly}
                    onCheckedChange={setShowPendingOnly}
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {gigs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No gigs scheduled yet
              </p>
            ) : (
              <div className="space-y-3">
                {gigs
                  .filter(gig => !showPendingOnly || (gigResponseCounts[gig.id]?.pending > 0))
                  .map((gig) => (
                  <div key={gig.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant={gig.status === 'confirmed' ? 'default' : 'secondary'}>
                            {gig.status}
                          </Badge>
                          {gigResponseCounts[gig.id] && (
                            <>
                              {gigResponseCounts[gig.id].pending > 0 && (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                  ⏳ {gigResponseCounts[gig.id].pending} pending
                                </Badge>
                              )}
                              {gigResponseCounts[gig.id].accepted > 0 && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  ✅ {gigResponseCounts[gig.id].accepted} accepted
                                </Badge>
                              )}
                              {gigResponseCounts[gig.id].declined > 0 && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                  ❌ {gigResponseCounts[gig.id].declined} declined
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                        
                        {/* Email Tracking Status */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Email status:</span>
                          <EmailTrackingStatus 
                            gigId={gig.id} 
                            memberProfiles={bandMembers.map(m => ({ id: m.id, name: m.name }))}
                          />
                        </div>
                        
                        {/* Visual Timeline */}
                        {gigRehearsals[gig.id] ? (
                          <div className="my-4 p-3 rounded-lg bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Music className="h-4 w-4 text-primary" />
                              <span className="text-sm font-semibold text-primary">Event Timeline</span>
                            </div>
                            <div className="relative">
                              {/* Timeline line */}
                              <div className="absolute left-3 top-6 bottom-6 w-0.5 bg-primary/30" />
                              
                              {/* Rehearsal */}
                              <div className="flex items-start gap-3 mb-4">
                                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center z-10 shrink-0">
                                  <Music className="h-3 w-3 text-secondary-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">Rehearsal</p>
                              <p className="text-xs text-muted-foreground">
                                    {format(new Date(gigRehearsals[gig.id].date), "EEE, MMM d")} at {format(new Date(gigRehearsals[gig.id].date), "p")}
                                    {gigRehearsals[gig.id].end_time && ` - ${formatTime12Hour(gigRehearsals[gig.id].end_time)}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">{gigRehearsals[gig.id].venue}</p>
                                </div>
                              </div>
                              
                              {/* Gig */}
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10 shrink-0">
                                  <CalendarIcon className="h-3 w-3 text-primary-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">Gig</p>
                                <p className="text-xs text-muted-foreground">
                                    {format(new Date(gig.date), "EEE, MMM d")} at {format(new Date(gig.date), "p")}
                                    {gig.end_time && ` - ${formatTime12Hour(gig.end_time)}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">{gig.venue_name || gig.venue}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <CalendarIcon className="h-4 w-4" />
                              {format(new Date(gig.date), "PPP")}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <Clock className="h-4 w-4" />
                              {format(new Date(gig.date), "p")}
                              {gig.end_time && ` - ${formatTime12Hour(gig.end_time)}`}
                            </div>
                          </>
                        )}
                        {gig.loading_time && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">Load-in:</span> {formatTime12Hour(gig.loading_time)}
                          </div>
                        )}
                        {gig.sound_check_time && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">Sound Check:</span> {formatTime12Hour(gig.sound_check_time)}
                          </div>
                        )}
                        {gig.venue_name && (
                          <h3 className="font-bold text-lg mb-2">{gig.venue_name}</h3>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">{gig.venue}</h4>
                          {(gig.venue_lat && gig.venue_lng) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${gig.venue_lat},${gig.venue_lng}`;
                                window.open(mapsUrl, '_blank');
                              }}
                            >
                              <Navigation className="h-4 w-4 mr-1" />
                              Navigate
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gig.venue)}`;
                                window.open(mapsUrl, '_blank');
                              }}
                            >
                              <Navigation className="h-4 w-4 mr-1" />
                              Search
                            </Button>
                          )}
                        </div>
                        {gig.notes && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {gig.notes}
                          </p>
                        )}
                        {gig.attire && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">Attire:</span> {gig.attire}
                          </p>
                        )}
                        {gig.food_provided && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">Food Provided:</span> {gig.food_provided}
                          </p>
                        )}
                        {gig.venue_contact_person && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">Venue Contact Person:</span> {gig.venue_contact_person}
                          </p>
                        )}
                        {gig.sound_man_info && (
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">Sound Man Information:</span> {gig.sound_man_info}
                          </p>
                        )}
                      </div>
                      {isBandLeader && (
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditGigDialog(gig)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Dialog open={inviteDialogOpen && currentGigForInvite === gig.id} onOpenChange={(open) => {
                            setInviteDialogOpen(open);
                            if (!open) {
                              setCurrentGigForInvite(null);
                              setSelectedMembers([]);
                              setCurrentGigInvitedMembers([]);
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openInviteDialog(gig.id)}
                              >
                                <Users className="h-4 w-4 mr-2" />
                                Invite Members
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Manage Gig Invitations</DialogTitle>
                                <DialogDescription>
                                  Invite new members or resend invitations to existing ones
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                {/* Already Invited Members */}
                                {currentGigInvitedMembers.length > 0 && (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-sm font-semibold text-muted-foreground">Already Invited</h4>
                                      {currentGigInvitedMembers.filter(m => m.status === 'pending').length > 0 && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={handleResendAllPending}
                                          disabled={resendingAll || resendingMemberId !== null}
                                        >
                                          {resendingAll ? (
                                            <>
                                              <Mail className="h-3 w-3 mr-1 animate-pulse" />
                                              Sending...
                                            </>
                                          ) : (
                                            <>
                                              <Send className="h-3 w-3 mr-1" />
                                              Resend All Pending ({currentGigInvitedMembers.filter(m => m.status === 'pending').length})
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                    {currentGigInvitedMembers.map((invite) => {
                                      const member = bandMembers.find(m => m.id === invite.member_id);
                                      const emailTracking = currentGigEmailTracking[invite.member_id];
                                      if (!member) return null;
                                      
                                      const getEmailStatusIcon = () => {
                                        if (!emailTracking) return null;
                                        if (emailTracking.clicked_at) return <MousePointerClick className="h-3 w-3 text-green-600" />;
                                        if (emailTracking.opened_at) return <MailOpen className="h-3 w-3 text-blue-600" />;
                                        if (emailTracking.delivered_at) return <MailCheck className="h-3 w-3 text-cyan-600" />;
                                        if (emailTracking.status === 'bounced' || emailTracking.status === 'complained') return <AlertCircle className="h-3 w-3 text-destructive" />;
                                        return <Mail className="h-3 w-3 text-muted-foreground" />;
                                      };
                                      
                                      const getEmailStatusText = () => {
                                        if (!emailTracking) return null;
                                        if (emailTracking.clicked_at) return 'Clicked';
                                        if (emailTracking.opened_at) return 'Opened';
                                        if (emailTracking.delivered_at) return 'Delivered';
                                        if (emailTracking.status === 'bounced') return 'Bounced';
                                        if (emailTracking.status === 'complained') return 'Complained';
                                        return 'Sent';
                                      };
                                      
                                      return (
                                        <div key={invite.member_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                                          <div className="flex-1">
                                            <p className="font-semibold text-sm">{member.name}</p>
                                            <p className="text-xs text-muted-foreground">{member.email}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                              <Badge 
                                                variant={invite.status === 'accepted' ? 'default' : invite.status === 'declined' ? 'destructive' : 'secondary'}
                                                className="text-xs"
                                              >
                                                {invite.status}
                                              </Badge>
                                              {emailTracking && (
                                                <Badge 
                                                  variant="outline" 
                                                  className={cn(
                                                    "text-xs flex items-center gap-1",
                                                    emailTracking.clicked_at && "border-green-500/30 text-green-700 bg-green-500/10",
                                                    emailTracking.opened_at && !emailTracking.clicked_at && "border-blue-500/30 text-blue-700 bg-blue-500/10",
                                                    emailTracking.delivered_at && !emailTracking.opened_at && "border-cyan-500/30 text-cyan-700 bg-cyan-500/10",
                                                    (emailTracking.status === 'bounced' || emailTracking.status === 'complained') && "border-destructive/30 text-destructive bg-destructive/10"
                                                  )}
                                                >
                                                  {getEmailStatusIcon()}
                                                  {getEmailStatusText()}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleResendInvitation(invite.member_id)}
                                            disabled={resendingMemberId === invite.member_id || resendingAll}
                                          >
                                            {resendingMemberId === invite.member_id ? (
                                              <>
                                                <Mail className="h-3 w-3 mr-1 animate-pulse" />
                                                Sending...
                                              </>
                                            ) : (
                                              <>
                                                <Mail className="h-3 w-3 mr-1" />
                                                Resend
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Uninvited Members */}
                                {(() => {
                                  const invitedIds = new Set(currentGigInvitedMembers.map(i => i.member_id));
                                  const uninvitedMembers = bandMembers.filter(m => !invitedIds.has(m.id));
                                  
                                  if (uninvitedMembers.length === 0 && currentGigInvitedMembers.length === 0) {
                                    return (
                                      <p className="text-sm text-muted-foreground text-center py-4">
                                        No other group members found. Members need to sign up first.
                                      </p>
                                    );
                                  }
                                  
                                  if (uninvitedMembers.length === 0) {
                                    return null;
                                  }
                                  
                                  return (
                                    <div className="space-y-3">
                                      <h4 className="text-sm font-semibold text-muted-foreground">Invite New Members</h4>
                                      {uninvitedMembers.map((member) => (
                                        <div key={member.id} className="flex items-center space-x-3">
                                          <Checkbox
                                            id={`invite-${member.id}`}
                                            checked={selectedMembers.includes(member.id)}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                setSelectedMembers([...selectedMembers, member.id]);
                                              } else {
                                                setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                                              }
                                            }}
                                          />
                                          <label
                                            htmlFor={`invite-${member.id}`}
                                            className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                          >
                                            <div>
                                              <p className="font-semibold">{member.name}</p>
                                              <p className="text-xs text-muted-foreground">{member.email}</p>
                                              {member.instrument && (
                                                <p className="text-xs text-muted-foreground">{member.instrument}</p>
                                              )}
                                            </div>
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                              {(() => {
                                const invitedIds = new Set(currentGigInvitedMembers.map(i => i.member_id));
                                const uninvitedMembers = bandMembers.filter(m => !invitedIds.has(m.id));
                                if (uninvitedMembers.length > 0) {
                                  return (
                                    <Button onClick={handleInviteMembers} className="w-full" disabled={selectedMembers.length === 0}>
                                      <Send className="h-4 w-4 mr-2" />
                                      Send Invitations ({selectedMembers.length})
                                    </Button>
                                  );
                                }
                                return null;
                              })()}
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteGig(gig.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Gig Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Gig</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? format(editDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editDate}
                    onSelect={setEditDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Show Time</Label>
                <Input
                  type="time"
                  value={editShowTime}
                  onChange={(e) => setEditShowTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Load-in Time</Label>
                <Input
                  type="time"
                  value={editLoadingTime}
                  onChange={(e) => setEditLoadingTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sound Check</Label>
                <Input
                  type="time"
                  value={editSoundCheckTime}
                  onChange={(e) => setEditSoundCheckTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Venue Name</Label>
              <Input
                value={editVenueName}
                onChange={(e) => setEditVenueName(e.target.value)}
                placeholder="e.g., Blue Note Jazz Club"
              />
            </div>

            <div className="space-y-2">
              <Label>Venue Address</Label>
              <PlaceAutocomplete
                value={editVenue}
                onChange={(value, placeDetails) => {
                  setEditVenue(value);
                  if (placeDetails?.geometry?.location) {
                    setEditVenueLat(placeDetails.geometry.location.lat());
                    setEditVenueLng(placeDetails.geometry.location.lng());
                  }
                }}
                placeholder="Start typing an address..."
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Attire</Label>
              <Input
                value={editAttire}
                onChange={(e) => setEditAttire(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Food Provided</Label>
              <Input
                value={editFoodProvided}
                onChange={(e) => setEditFoodProvided(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Venue Contact Person</Label>
              <Input
                value={editVenueContactPerson}
                onChange={(e) => setEditVenueContactPerson(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Sound Man Info</Label>
              <Input
                value={editSoundManInfo}
                onChange={(e) => setEditSoundManInfo(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5 pr-3">
                <Label>Disable automatic reminders</Label>
                <p className="text-xs text-muted-foreground">
                  Turn off the auto 1-day and 2-hour reminder emails for this gig.
                </p>
              </div>
              <Switch
                checked={editAutoRemindersDisabled}
                onCheckedChange={setEditAutoRemindersDisabled}
              />
            </div>


            <Button onClick={handleUpdateGig} disabled={isSubmitting} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Bookings;
