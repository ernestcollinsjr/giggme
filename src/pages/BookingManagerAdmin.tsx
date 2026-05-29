import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Trash2,
  Search,
  UserPlus,
  Calendar,
  User,
  Users,
  Music2,
  X,
  Bell,
  CalendarPlus,
  MessageSquare,
  Send,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import { AppShell } from "@/components/AppShell";
import { SentBookingRequests } from "@/components/SentBookingRequests";
import { PaymentScheduler } from "@/components/PaymentScheduler";
import { UpcomingGigLocationTracker } from "@/components/UpcomingGigLocationTracker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AdminsManager } from "@/components/AdminsManager";
import { BandInvitationManager } from "@/components/BandInvitationManager";

const CATEGORIES = ["Soloist", "Duo", "Band"] as const;
type Category = typeof CATEGORIES[number];
const DEFAULT_GIG_DURATION_MS = 2 * 60 * 60 * 1000;

const CATEGORY_ICON: Record<Category, typeof User> = {
  Soloist: User,
  Duo: Users,
  Band: Music2,
};

interface ManagedArtist {
  id: string;
  artist_id: string;
  group_type: string | null;
  group_name: string | null;
  notes: string | null;
  created_at: string;
  profile: {
    id: string;
    name: string;
    email: string;
    phone_number: string | null;
    instrument: string | null;
    photo_urls: string[] | null;
  };
}

const UNGROUPED = "Ungrouped";

interface UpcomingGig {
  id: string;
  date: string;
  end_time: string | null;
  venue: string;
  venue_name: string | null;
  status: string;
  artist_name: string;
  artist_id: string;
  source: "gig" | "booking_request";
}

interface PendingInvite {
  id: string;
  date: string;
  venue: string;
  venue_name: string | null;
  status: string;
  artist_name: string;
  artist_id: string;
  source: "gig" | "booking_request";
}

function normalizeCategory(value: string | null): Category {
  if (!value) return "Soloist";
  const v = value.toLowerCase();
  if (v.startsWith("band")) return "Band";
  if (v.startsWith("duo")) return "Duo";
  return "Soloist";
}

export default function BookingManagerAdmin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const artistFilter = searchParams.get("artist");
  const { toast } = useToast();

  const [managedArtists, setManagedArtists] = useState<ManagedArtist[]>([]);
  const [upcomingGigs, setUpcomingGigs] = useState<UpcomingGig[]>([]);
  const [pendingArtistIds, setPendingArtistIds] = useState<Set<string>>(new Set());
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [deleteConfirmArtist, setDeleteConfirmArtist] = useState<ManagedArtist | null>(null);
  const [deleteConfirmGig, setDeleteConfirmGig] = useState<UpcomingGig | null>(null);
  const [artistAvailability, setArtistAvailability] = useState<Array<{ date: string; status: string; notes: string | null }>>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, "paid" | "pending">>({});
  const [artistVenues, setArtistVenues] = useState<Record<string, string[]>>({});
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastVenue, setBroadcastVenue] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [myBand, setMyBand] = useState<{ id: string; name: string } | null>(null);
  const [ensuringBand, setEnsuringBand] = useState(false);

  const paymentKey = (gig: { source: string; id: string; artist_id: string }) =>
    `${gig.source}:${gig.id}:${gig.artist_id}`;

  const fetchPaymentStatuses = async (uid: string) => {
    const { data } = await supabase
      .from("booking_manager_payments")
      .select("source, source_id, artist_id, status")
      .eq("booking_manager_id", uid);
    const map: Record<string, "paid" | "pending"> = {};
    (data || []).forEach((r: any) => {
      map[`${r.source}:${r.source_id}:${r.artist_id}`] = r.status === "paid" ? "paid" : "pending";
    });
    setPaymentStatuses(map);
  };

  const togglePaymentStatus = async (gig: UpcomingGig) => {
    if (!userId) return;
    const key = paymentKey(gig);
    const current = paymentStatuses[key] || "pending";
    const next = current === "paid" ? "pending" : "paid";
    setPaymentStatuses((prev) => ({ ...prev, [key]: next }));
    const { error } = await supabase
      .from("booking_manager_payments")
      .upsert(
        {
          booking_manager_id: userId,
          source: gig.source,
          source_id: gig.id,
          artist_id: gig.artist_id,
          status: next,
        },
        { onConflict: "booking_manager_id,source,source_id,artist_id" }
      );
    if (error) {
      setPaymentStatuses((prev) => ({ ...prev, [key]: current }));
      toast({ variant: "destructive", title: "Failed to update payment", description: error.message });
    }
  };

  useEffect(() => {
    checkRoleAndFetchData();
  }, []);

  // Realtime: refresh when any booking_request changes (e.g., performer accepts/declines)
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`booking-manager-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_requests", filter: `booker_id=eq.${userId}` },
        () => {
          fetchUpcomingGigs(userId);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const checkRoleAndFetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "booking_manager")
        .maybeSingle();

      if (!roleData) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You don't have permission to access this page.",
        });
        navigate("/dashboard");
        return;
      }

      await Promise.all([fetchManagedArtists(user.id), fetchUpcomingGigs(user.id), fetchPaymentStatuses(user.id), fetchArtistVenues(user.id), fetchMyBand(user.id)]);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchManagedArtists = async (uid: string) => {
    const { data, error } = await supabase
      .from("booking_manager_artists")
      .select("id, artist_id, group_type, group_name, notes, created_at")
      .eq("booking_manager_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ variant: "destructive", title: "Error fetching artists", description: error.message });
      return;
    }

    if (!data || data.length === 0) {
      setManagedArtists([]);
      return;
    }

    const artistIds = data.map((a) => a.artist_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email, phone_number, instrument, photo_urls")
      .in("id", artistIds);

    setManagedArtists(
      data.map((artist) => ({
        ...artist,
        profile:
          profiles?.find((p) => p.id === artist.artist_id) ?? {
            id: artist.artist_id,
            name: "Unknown",
            email: "",
            phone_number: null,
            instrument: null,
            photo_urls: null,
          },
      }))
    );
  };

  const fetchArtistVenues = async (uid: string) => {
    // Collect venues this manager has previously booked each artist at.
    const { data: brs } = await supabase
      .from("booking_requests")
      .select("performer_id, venue")
      .eq("booker_id", uid);
    const map: Record<string, Set<string>> = {};
    (brs || []).forEach((r: any) => {
      if (!r.performer_id || !r.venue) return;
      (map[r.performer_id] ||= new Set()).add(String(r.venue));
    });
    const out: Record<string, string[]> = {};
    Object.entries(map).forEach(([k, v]) => (out[k] = Array.from(v)));
    setArtistVenues(out);
  };

  const fetchUpcomingGigs = async (uid: string) => {
    const { data: artistLinks } = await supabase
      .from("booking_manager_artists")
      .select("artist_id")
      .eq("booking_manager_id", uid);

    if (!artistLinks || artistLinks.length === 0) {
      setUpcomingGigs([]);
      return;
    }

    const artistIds = artistLinks.map((a) => a.artist_id);
    const { data: gigMembers } = await supabase
      .from("gig_members")
      .select(`member_id, gigs ( id, date, end_time, venue, venue_name, status )`)
      .in("member_id", artistIds)
      .eq("status", "accepted");

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", artistIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);

    const gigs: UpcomingGig[] = (gigMembers || [])
      .filter((gm: any) => gm.gigs)
      .map((gm: any) => ({
        id: gm.gigs.id,
        date: gm.gigs.date,
        end_time: gm.gigs.end_time,
        venue: gm.gigs.venue,
        venue_name: gm.gigs.venue_name,
        status: gm.gigs.status,
        artist_name: profileMap.get(gm.member_id) || "Unknown",
        artist_id: gm.member_id,
        source: "gig" as const,
      }));

    // Also include accepted booking requests (direct bookings without a gig record)
    const { data: bookingReqs } = await supabase
      .from("booking_requests")
      .select("id, performer_id, event_date, dates_text, venue, status")
      .in("performer_id", artistIds)
      .eq("status", "accepted");

    (bookingReqs || []).forEach((br: any) => {
      const dateStr = br.event_date || br.dates_text;
      if (!dateStr) return;
      const t = new Date(dateStr).getTime();
      if (isNaN(t)) return;
      const rawVenue = br.venue || "";
      const sep = rawVenue.includes(" — ") ? " — " : rawVenue.includes(" - ") ? " - " : null;
      const [vName, vAddr] = sep ? rawVenue.split(sep, 2) : [null, rawVenue];
      gigs.push({
        id: br.id,
        date: br.event_date || br.dates_text,
        end_time: null,
        venue: vAddr || rawVenue,
        venue_name: vName,
        status: "confirmed",
        artist_name: profileMap.get(br.performer_id) || "Unknown",
        artist_id: br.performer_id,
        source: "booking_request" as const,
      });
    });

    gigs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setUpcomingGigs(gigs);

    // Fetch pending booking requests (sent invites awaiting response)
    const { data: pendingReqs } = await supabase
      .from("booking_requests")
      .select("id, performer_id, event_date, dates_text, venue, status, expires_at")
      .in("performer_id", artistIds)
      .eq("status", "pending");

    // Fetch pending gig invitations (gig_members not yet responded)
    const { data: pendingGigInvites } = await supabase
      .from("gig_members")
      .select(`id, member_id, status, gigs ( id, date, venue, venue_name )`)
      .in("member_id", artistIds)
      .eq("status", "pending");

    const invites: PendingInvite[] = [];

    (pendingReqs || []).forEach((br: any) => {
      const dateStr = br.event_date || br.dates_text;
      if (!dateStr) return;
      const expired = br.expires_at && new Date(br.expires_at).getTime() < Date.now();
      const rawVenue = br.venue || "";
      const sep = rawVenue.includes(" — ") ? " — " : rawVenue.includes(" - ") ? " - " : null;
      const [vName, vAddr] = sep ? rawVenue.split(sep, 2) : [null, rawVenue];
      invites.push({
        id: br.id,
        date: dateStr,
        venue: vAddr || rawVenue,
        venue_name: vName,
        status: expired ? "expired" : "pending",
        artist_name: profileMap.get(br.performer_id) || "Unknown",
        artist_id: br.performer_id,
        source: "booking_request",
      });
    });

    (pendingGigInvites || []).forEach((gm: any) => {
      if (!gm.gigs) return;
      invites.push({
        id: gm.id,
        date: gm.gigs.date,
        venue: gm.gigs.venue,
        venue_name: gm.gigs.venue_name,
        status: "pending",
        artist_name: profileMap.get(gm.member_id) || "Unknown",
        artist_id: gm.member_id,
        source: "gig",
      });
    });

    invites.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setPendingInvites(invites);
    setPendingArtistIds(new Set((pendingReqs || []).map((r: any) => r.performer_id)));
  };

  const getGigCompletionTime = (gig: UpcomingGig): number => {
    const startTime = new Date(gig.date).getTime();
    if (Number.isNaN(startTime)) return 0;

    if (!gig.end_time) return startTime + DEFAULT_GIG_DURATION_MS;

    const dateOnly = gig.date.split("T")[0];
    const endTime = new Date(`${dateOnly}T${gig.end_time}`).getTime();
    if (Number.isNaN(endTime)) return startTime + DEFAULT_GIG_DURATION_MS;

    return endTime < startTime ? endTime + 24 * 60 * 60 * 1000 : endTime;
  };

  const isGigCompleted = (gig: UpcomingGig): boolean => {
    return gig.status === "completed" || getGigCompletionTime(gig) < Date.now();
  };

  const getArtistStatus = (artistId: string): "booked" | "pending" | "none" => {
    if (upcomingGigs.some((g) => g.artist_id === artistId && !isGigCompleted(g))) return "booked";
    if (pendingArtistIds.has(artistId)) return "pending";
    return "none";
  };


  const handleAssignCategory = async (artist: ManagedArtist, category: Category) => {
    // Optimistic update
    setManagedArtists((prev) =>
      prev.map((a) => (a.id === artist.id ? { ...a, group_type: category } : a))
    );

    const { error } = await supabase
      .from("booking_manager_artists")
      .update({ group_type: category })
      .eq("id", artist.id);

    if (error) {
      toast({ variant: "destructive", title: "Couldn't update category", description: error.message });
      if (userId) fetchManagedArtists(userId);
    } else {
      toast({ title: "Category updated", description: `${artist.profile.name} → ${category}` });
    }
  };

  const handleAssignGroupName = async (artist: ManagedArtist, rawName: string) => {
    const trimmed = rawName.trim();
    const next = trimmed.length > 0 ? trimmed : null;
    setManagedArtists((prev) =>
      prev.map((a) => (a.id === artist.id ? { ...a, group_name: next } : a))
    );
    const { error } = await supabase
      .from("booking_manager_artists")
      .update({ group_name: next })
      .eq("id", artist.id);
    if (error) {
      toast({ variant: "destructive", title: "Couldn't update group", description: error.message });
      if (userId) fetchManagedArtists(userId);
    } else {
      toast({
        title: "Group updated",
        description: `${artist.profile.name} → ${next ?? UNGROUPED}`,
      });
    }
  };

  const handleRemoveArtist = async () => {
    if (!deleteConfirmArtist) return;
    const { error } = await supabase
      .from("booking_manager_artists")
      .delete()
      .eq("id", deleteConfirmArtist.id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }

    toast({ title: "Artist removed", description: deleteConfirmArtist.profile.name });
    setDeleteConfirmArtist(null);
    if (userId) {
      await Promise.all([fetchManagedArtists(userId), fetchUpcomingGigs(userId)]);
    }
  };

  const handleDeleteGig = async () => {
    if (!deleteConfirmGig) return;
    const table = deleteConfirmGig.source === "booking_request" ? "booking_requests" : "gigs";
    const { error } = await supabase.from(table).delete().eq("id", deleteConfirmGig.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }

    // Also remove any related booking_requests AND gigs for the same artist on the same date
    // (e.g., earlier invites that were superseded, or gigs auto-created when a request was confirmed).
    try {
      const dateOnly = deleteConfirmGig.date.split("T")[0];
      const dayStart = new Date(`${dateOnly}T00:00:00`).toISOString();
      const dayEnd = new Date(`${dateOnly}T23:59:59.999`).toISOString();
      await Promise.all([
        supabase
          .from("booking_requests")
          .delete()
          .eq("performer_id", deleteConfirmGig.artist_id)
          .eq("booker_id", userId)
          .gte("event_date", dayStart)
          .lte("event_date", dayEnd),
        supabase
          .from("gigs")
          .delete()
          .eq("user_id", deleteConfirmGig.artist_id)
          .gte("date", dayStart)
          .lte("date", dayEnd),
      ]);
    } catch (e) {
      console.warn("Cleanup of related bookings failed", e);
    }

    toast({ title: "Booking deleted", description: deleteConfirmGig.venue_name || deleteConfirmGig.venue });
    setDeleteConfirmGig(null);
    if (userId) await fetchUpcomingGigs(userId);
  };

  const grouped = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = managedArtists.filter((a) => {
      if (!q) return true;
      if (a.profile.name.toLowerCase().includes(q)) return true;
      const venues = artistVenues[a.artist_id] || [];
      return venues.some((v) => v.toLowerCase().includes(q));
    });
    const map = new Map<string, ManagedArtist[]>();
    filtered.forEach((a) => {
      const key = (a.group_name && a.group_name.trim()) || UNGROUPED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    const entries = Array.from(map.entries()).sort(([a], [b]) => {
      if (a === UNGROUPED) return 1;
      if (b === UNGROUPED) return -1;
      return a.localeCompare(b);
    });
    return entries;
  }, [managedArtists, searchTerm, artistVenues]);

  const allGroupNames = useMemo(() => {
    const set = new Set<string>();
    managedArtists.forEach((a) => {
      const n = a.group_name?.trim();
      if (n) set.add(n);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [managedArtists]);

  const broadcastRecipients = useMemo(() => {
    const all = grouped.flatMap(([, items]) => items);
    const vq = broadcastVenue.trim().toLowerCase();
    if (!vq) return all;
    return all.filter((a) =>
      (artistVenues[a.artist_id] || []).some((v) => v.toLowerCase().includes(vq))
    );
  }, [grouped, broadcastVenue, artistVenues]);

  const sendBroadcastMessage = async () => {
    if (!userId) return;
    const text = broadcastText.trim();
    if (!text) {
      toast({ variant: "destructive", title: "Message is empty" });
      return;
    }
    if (broadcastRecipients.length === 0) {
      toast({ variant: "destructive", title: "No recipients" });
      return;
    }
    setBroadcastSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-replacement-request", {
        body: {
          performer_ids: broadcastRecipients.map((a) => a.artist_id),
          message: text,
          venue: broadcastVenue.trim() || null,
        },
      });
      if (error) throw error;

      const deadline = data?.deadline_at ? new Date(data.deadline_at) : null;
      toast({
        title: "Cover request sent",
        description: `Emailed ${data?.recipients ?? broadcastRecipients.length} performer${
          (data?.recipients ?? broadcastRecipients.length) === 1 ? "" : "s"
        }. They have 30 min to respond${
          deadline ? ` (by ${deadline.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})` : ""
        } or they're auto-ruled-out.`,
      });
      setBroadcastText("");
      setBroadcastVenue("");
      setBroadcastOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Send failed", description: e.message });
    } finally {
      setBroadcastSending(false);
    }
  };

  const selectedArtist = useMemo(
    () => managedArtists.find((a) => a.artist_id === artistFilter) || null,
    [managedArtists, artistFilter]
  );

  const visibleGigs = useMemo(() => {
    if (!artistFilter) return upcomingGigs;
    return upcomingGigs.filter((g) => g.artist_id === artistFilter);
  }, [upcomingGigs, artistFilter]);

  const visibleInvites = useMemo(() => {
    if (!artistFilter) return pendingInvites;
    return pendingInvites.filter((i) => i.artist_id === artistFilter);
  }, [pendingInvites, artistFilter]);

  // Tick every 30s so gigs that just ended re-sort to the bottom without a refetch
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const upcomingVisible = useMemo(() => {
    const byDateAsc = (a: UpcomingGig, b: UpcomingGig) => new Date(a.date).getTime() - new Date(b.date).getTime();
    const upcoming = visibleGigs.filter((g) => !isGigCompleted(g)).sort(byDateAsc);
    const completed = visibleGigs.filter((g) => isGigCompleted(g)).sort(byDateAsc);
    return [...upcoming, ...completed];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleGigs, nowTick]);
  const completedVisible: UpcomingGig[] = [];

  const setArtistFilter = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("artist", id);
    else next.delete("artist");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!artistFilter) {
      setArtistAvailability([]);
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("member_availability")
      .select("date, status, notes")
      .eq("user_id", artistFilter)
      .gte("date", today)
      .order("date", { ascending: true })
      .then(({ data }) => setArtistAvailability(data || []));
  }, [artistFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <AppShell userRole="booking_manager">
    <div className="min-h-screen bg-background pb-24 lg:pb-6 overflow-x-hidden">
      <TopNav userRole="booking_manager" />

      <main className="container mx-auto px-3 sm:px-4 py-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Booking Manager</h1>
            <p className="text-sm text-muted-foreground">
              Organize your roster by group type and track booked dates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 self-start sm:self-auto">
            <Button
              onClick={() => navigate("/schedule-reminder?type=custom")}
              size="sm"
              variant="outline"
              className="gap-1 text-xs sm:text-sm"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Schedule</span> Reminder
            </Button>
            <Button
              onClick={() => navigate("/admin")}
              size="sm"
              className="gap-1 text-xs sm:text-sm"
            >
              <CalendarPlus className="h-4 w-4" />
              Admin
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {/* TOP: Categorized roster (3 columns) */}
          <aside className="bg-card border rounded-lg p-3">
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search roster or venue..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                  list="bm-venue-suggestions"
                />
                <datalist id="bm-venue-suggestions">
                  {Array.from(new Set(Object.values(artistVenues).flat())).sort().map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 self-start sm:self-auto"
                onClick={() => setBroadcastOpen(true)}
                disabled={broadcastRecipients.length === 0}
                title="Message everyone in the current search results — useful for last-minute cover requests"
              >
                <MessageSquare className="h-4 w-4" />
                Find Replacement
                <Badge variant="secondary" className="ml-1">{broadcastRecipients.length}</Badge>
              </Button>
            </div>

            {managedArtists.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No artists yet. Add some from Discover.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped.map(([groupName, items]) => {
                  const isUngrouped = groupName === UNGROUPED;
                  return (
                    <section key={groupName} className="bg-muted/30 rounded-md p-3">
                      <header className="flex items-center gap-2 mb-2 px-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <h2
                          className={cn(
                            "text-sm font-semibold truncate",
                            isUngrouped && "italic text-muted-foreground"
                          )}
                          title={groupName}
                        >
                          {groupName}
                        </h2>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {items.length}
                        </Badge>
                      </header>
                      <ul className="space-y-1">
                        {items.map((artist) => {
                          const isActive = selectedArtist?.artist_id === artist.artist_id;
                          const photo = artist.profile.photo_urls?.[0];
                          return (
                            <li key={artist.id}>
                              <div
                                className={cn(
                                  "group flex items-center gap-2 rounded-md p-1.5 transition-colors",
                                  isActive ? "bg-accent" : "hover:bg-muted/60"
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => navigate(`/artist-profile/${artist.artist_id}`)}
                                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                >
                                  <Avatar className="h-8 w-8">
                                    {photo && <AvatarImage src={photo} alt={artist.profile.name} />}
                                    <AvatarFallback className="text-xs">
                                      {artist.profile.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span
                                        className={cn(
                                          "h-2 w-2 rounded-full flex-shrink-0",
                                          getArtistStatus(artist.artist_id) === "booked" && "bg-green-500",
                                          getArtistStatus(artist.artist_id) === "pending" && "bg-yellow-500",
                                          getArtistStatus(artist.artist_id) === "none" && "bg-red-500"
                                        )}
                                        title={
                                          getArtistStatus(artist.artist_id) === "booked"
                                            ? "Booked"
                                            : getArtistStatus(artist.artist_id) === "pending"
                                            ? "Pending"
                                            : "Not booked"
                                        }
                                      />
                                      <p className="text-sm font-medium truncate">{artist.profile.name}</p>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {normalizeCategory(artist.group_type)}
                                    </p>
                                  </div>
                                </button>
                                <Input
                                  type="text"
                                  list="bm-group-name-suggestions"
                                  defaultValue={artist.group_name ?? ""}
                                  placeholder="Group"
                                  className="h-7 w-[96px] text-[11px] px-2"
                                  onBlur={(e) => {
                                    const v = e.target.value;
                                    if ((v.trim() || null) !== (artist.group_name?.trim() || null)) {
                                      handleAssignGroupName(artist, v);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  }}
                                  title="Group name (e.g. Motown Band)"
                                />
                                <Select
                                  value={normalizeCategory(artist.group_type)}
                                  onValueChange={(v) => handleAssignCategory(artist, v as Category)}
                                >
                                  <SelectTrigger className="h-7 w-[72px] text-[11px] px-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CATEGORIES.map((c) => (
                                      <SelectItem key={c} value={c} className="text-xs">
                                        {c}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                                  onClick={() => setDeleteConfirmArtist(artist)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
                <datalist id="bm-group-name-suggestions">
                  {allGroupNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
            )}
          </aside>

          {userId && <UpcomingGigLocationTracker userId={userId} userRole="booking_manager" />}

          {/* BELOW: Booked dates + pending invites */}
          <div className="space-y-4">
          <section className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">
                  {selectedArtist ? `${selectedArtist.profile.name}'s bookings` : "All booked dates"}
                </h2>
              </div>
              {selectedArtist && (
                <Button variant="ghost" size="sm" onClick={() => setArtistFilter(null)} className="gap-1">
                  <X className="h-4 w-4" /> Clear filter
                </Button>
              )}
            </div>

            {visibleGigs.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {selectedArtist
                  ? "No bookings for this performer."
                  : "No bookings yet."}
              </div>
            ) : (
              <div className="space-y-6">
                {upcomingVisible.length > 0 && (
                  <ul className="divide-y">
                    {upcomingVisible.map((gig) => {
                      const artist = managedArtists.find((a) => a.artist_id === gig.artist_id);
                      const photo = artist?.profile.photo_urls?.[0];
                      const d = new Date(gig.date);
                      const isCompletedRow = isGigCompleted(gig);
                      return (
                        <li key={`${gig.id}-${gig.artist_id}`} className="py-3 flex items-center gap-3">
                          <div className={cn("flex flex-col items-center justify-center w-12 h-12 rounded-md bg-muted text-center flex-shrink-0", isCompletedRow && "text-muted-foreground")}>
                            <span className="text-[10px] uppercase font-medium text-muted-foreground leading-none">
                              {d.toLocaleDateString("en-US", { month: "short" })}
                            </span>
                            <span className={cn("text-lg leading-none mt-0.5", isCompletedRow ? "font-normal text-muted-foreground" : "font-bold")}>{d.getDate()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("truncate", isCompletedRow ? "font-normal text-muted-foreground" : "font-medium")}>{gig.venue_name || gig.venue}</p>
                            {gig.venue_name && (
                              <p className="text-xs text-muted-foreground truncate">{gig.venue}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Avatar className="h-5 w-5">
                                {photo && <AvatarImage src={photo} alt={gig.artist_name} />}
                                <AvatarFallback className="text-[10px]">
                                  {gig.artist_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground truncate">
                                {gig.artist_name}
                              </span>
                            </div>
                          </div>
                          {(() => {
                            const isCompleted = isGigCompleted(gig);
                            const isPaid = (paymentStatuses[paymentKey(gig)] || "pending") === "paid";
                            return (
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <Badge
                                  variant={
                                    isCompleted
                                      ? "default"
                                      : gig.status === "confirmed"
                                      ? "default"
                                      : gig.status === "pending"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className={isCompleted ? "bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/20" : ""}
                                >
                                  {isCompleted ? "completed" : gig.status}
                                </Badge>
                                {isCompleted && (
                                  <TooltipProvider delayDuration={150}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            togglePaymentStatus(gig);
                                          }}
                                          className={cn(
                                            "text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                                            isPaid
                                              ? "bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30"
                                              : "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
                                          )}
                                        >
                                          {isPaid ? "Paid" : "Pending Payment"}
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {isPaid ? "Click to mark as pending payment" : "Click to confirm payment was sent"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            );
                          })()}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteConfirmGig(gig)}
                            aria-label="Delete booking"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {completedVisible.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Completed
                    </h3>
                    <ul className="divide-y opacity-60">
                      {completedVisible.map((gig) => {
                        const artist = managedArtists.find((a) => a.artist_id === gig.artist_id);
                        const photo = artist?.profile.photo_urls?.[0];
                        const d = new Date(gig.date);
                        return (
                          <li
                            key={`${gig.id}-${gig.artist_id}-done`}
                            className="py-3 flex items-center gap-3 text-muted-foreground"
                          >
                            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-md bg-muted/50 text-center flex-shrink-0">
                              <span className="text-[10px] uppercase font-medium leading-none">
                                {d.toLocaleDateString("en-US", { month: "short" })}
                              </span>
                              <span className="text-lg font-bold leading-none mt-0.5">{d.getDate()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate line-through decoration-muted-foreground/40">
                                {gig.venue_name || gig.venue}
                              </p>
                              {gig.venue_name && (
                                <p className="text-xs truncate">{gig.venue}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <Avatar className="h-5 w-5 grayscale">
                                  {photo && <AvatarImage src={photo} alt={gig.artist_name} />}
                                  <AvatarFallback className="text-[10px]">
                                    {gig.artist_name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs truncate">{gig.artist_name}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <Badge variant="outline">Completed</Badge>
                              {(() => {
                                const isPaid = (paymentStatuses[paymentKey(gig)] || "pending") === "paid";
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePaymentStatus(gig);
                                    }}
                                    className={cn(
                                      "text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                                      isPaid
                                        ? "bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30"
                                        : "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
                                    )}
                                    title={isPaid ? "Click to mark as pending payment" : "Click to confirm payment was sent"}
                                  >
                                    {isPaid ? "Paid" : "Pending Payment"}
                                  </button>
                                );
                              })()}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Availability (when an artist is selected) */}
          {selectedArtist && (
            <section className="bg-card border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">
                  {selectedArtist.profile.name}'s availability
                </h2>
                <Badge variant="secondary" className="ml-auto">
                  {artistAvailability.length}
                </Badge>
              </div>
              {artistAvailability.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No availability set by this performer.
                </div>
              ) : (
                <ul className="divide-y">
                  {artistAvailability.map((a) => {
                    const d = new Date(a.date);
                    const isAvailable = a.status === "available";
                    return (
                      <li key={a.date} className="py-3 flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-md bg-muted text-center flex-shrink-0">
                          <span className="text-[10px] uppercase font-medium text-muted-foreground leading-none">
                            {d.toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="text-lg font-bold leading-none mt-0.5">{d.getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium capitalize">{a.status}</p>
                          {a.notes && (
                            <p className="text-xs text-muted-foreground truncate">{a.notes}</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full flex-shrink-0",
                            isAvailable ? "bg-green-500" : "bg-red-500"
                          )}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* Pending invites box */}
          <section className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">
                {selectedArtist ? `${selectedArtist.profile.name}'s pending invites` : "Pending invites"}
              </h2>
              <Badge variant="secondary" className="ml-auto">
                {visibleInvites.length}
              </Badge>
            </div>

            {visibleInvites.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No pending invites.
              </div>
            ) : (
              <ul className="divide-y">
                {visibleInvites.map((inv) => {
                  const artist = managedArtists.find((a) => a.artist_id === inv.artist_id);
                  const photo = artist?.profile.photo_urls?.[0];
                  const d = new Date(inv.date);
                  const validDate = !isNaN(d.getTime());
                  return (
                    <li
                      key={`${inv.source}-${inv.id}`}
                      className="py-3 flex items-center gap-3"
                    >
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-md bg-muted text-center flex-shrink-0">
                        {validDate ? (
                          <>
                            <span className="text-[10px] uppercase font-medium text-muted-foreground leading-none">
                              {d.toLocaleDateString("en-US", { month: "short" })}
                            </span>
                            <span className="text-lg font-bold leading-none mt-0.5">{d.getDate()}</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">TBD</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{inv.venue_name || inv.venue || "Untitled"}</p>
                        {inv.venue_name && (
                          <p className="text-xs text-muted-foreground truncate">{inv.venue}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Avatar className="h-5 w-5">
                            {photo && <AvatarImage src={photo} alt={inv.artist_name} />}
                            <AvatarFallback className="text-[10px]">
                              {inv.artist_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground truncate">
                            {inv.artist_name}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={inv.status === "expired" ? "outline" : "secondary"}
                        className={cn(
                          "flex-shrink-0",
                          inv.status === "pending" && "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
                        )}
                      >
                        {inv.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                        onClick={async () => {
                          const table = inv.source === "booking_request" ? "booking_requests" : "gig_members";
                          const { error } = await supabase.from(table).delete().eq("id", inv.id);
                          if (error) {
                            toast({ variant: "destructive", title: "Error", description: error.message });
                            return;
                          }
                          toast({ title: "Invite removed" });
                          if (userId) await fetchUpcomingGigs(userId);
                        }}
                        aria-label="Delete invite"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          </div>

        </div>




        <Dialog open={!!deleteConfirmArtist} onOpenChange={() => setDeleteConfirmArtist(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove artist</DialogTitle>
              <DialogDescription>
                Remove {deleteConfirmArtist?.profile.name} from your roster? This can't be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmArtist(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRemoveArtist}>
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteConfirmGig} onOpenChange={() => setDeleteConfirmGig(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete booking</DialogTitle>
              <DialogDescription>
                Delete this booking at {deleteConfirmGig?.venue_name || deleteConfirmGig?.venue} for {deleteConfirmGig?.artist_name}? This can't be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmGig(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteGig}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={broadcastOpen} onOpenChange={(o) => !broadcastSending && setBroadcastOpen(o)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Message {broadcastRecipients.length} performer{broadcastRecipients.length === 1 ? "" : "s"}
              </DialogTitle>
              <DialogDescription>
                Emails everyone matching your current search with a 30-minute response window. Non-responders are automatically ruled out. You'll get an email update for each accept/decline.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="broadcast-venue">Filter by venue</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="broadcast-venue"
                    placeholder="Type a venue to narrow recipients..."
                    value={broadcastVenue}
                    onChange={(e) => setBroadcastVenue(e.target.value)}
                    className="pl-9 h-9"
                    list="broadcast-venue-suggestions"
                  />
                  <datalist id="broadcast-venue-suggestions">
                    {Array.from(new Set(Object.values(artistVenues).flat())).sort().map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Only performers you've previously booked at this venue will be messaged.
                </p>
              </div>

              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 rounded-md bg-muted/40">
                {broadcastRecipients.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No performers match this venue.</p>
                ) : (
                  broadcastRecipients.map((a) => (
                    <Badge key={a.artist_id} variant="secondary" className="text-xs">
                      {a.profile.name}
                    </Badge>
                  ))
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() =>
                    setBroadcastText(
                      "Hey — I need a last-minute replacement to cover a gig. Are you available? Please reply ASAP with your availability. Thanks!"
                    )
                  }
                >
                  Use cover-request template
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="broadcast-text">Message</Label>
                <Textarea
                  id="broadcast-text"
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="Type the message everyone will receive..."
                  rows={5}
                  maxLength={1000}
                />
                <p className="text-[11px] text-muted-foreground text-right">
                  {broadcastText.length}/1000
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBroadcastOpen(false)} disabled={broadcastSending}>
                Cancel
              </Button>
              <Button onClick={sendBroadcastMessage} disabled={broadcastSending || !broadcastText.trim()} className="gap-1.5">
                <Send className="h-4 w-4" />
                {broadcastSending ? "Sending..." : `Send to ${broadcastRecipients.length}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {userId && (
          <div className="mt-6">
            <AdminsManager bookingManagerId={userId} />
          </div>
        )}
      </main>
      <BottomNav />
    </div>
    </AppShell>
  );
}
