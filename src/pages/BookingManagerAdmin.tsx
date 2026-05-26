import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Soloist", "Duo", "Band"] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_ICON: Record<Category, typeof User> = {
  Soloist: User,
  Duo: Users,
  Band: Music2,
};

interface ManagedArtist {
  id: string;
  artist_id: string;
  group_type: string | null;
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

interface UpcomingGig {
  id: string;
  date: string;
  end_time: string | null;
  venue: string;
  venue_name: string | null;
  status: string;
  artist_name: string;
  artist_id: string;
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

  useEffect(() => {
    checkRoleAndFetchData();
  }, []);

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

      await Promise.all([fetchManagedArtists(user.id), fetchUpcomingGigs(user.id)]);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchManagedArtists = async (uid: string) => {
    const { data, error } = await supabase
      .from("booking_manager_artists")
      .select("id, artist_id, group_type, notes, created_at")
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
      gigs.push({
        id: br.id,
        date: br.event_date || br.dates_text,
        end_time: null,
        venue: br.venue,
        venue_name: null,
        status: "confirmed",
        artist_name: profileMap.get(br.performer_id) || "Unknown",
        artist_id: br.performer_id,
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
      invites.push({
        id: br.id,
        date: dateStr,
        venue: br.venue,
        venue_name: null,
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

  const isGigCompleted = (gig: UpcomingGig): boolean => {
    const dateOnly = gig.date.split("T")[0];
    const endIso = gig.end_time
      ? `${dateOnly}T${gig.end_time}`
      : `${dateOnly}T23:59:59`;
    return new Date(endIso).getTime() < Date.now();
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

  const grouped = useMemo(() => {
    const filtered = managedArtists.filter((a) =>
      a.profile.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const map: Record<Category, ManagedArtist[]> = { Soloist: [], Duo: [], Band: [] };
    filtered.forEach((a) => {
      map[normalizeCategory(a.group_type)].push(a);
    });
    return map;
  }, [managedArtists, searchTerm]);

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

  const upcomingVisible = useMemo(
    () => visibleGigs.filter((g) => !isGigCompleted(g)),
    [visibleGigs]
  );
  const completedVisible = useMemo(
    () => visibleGigs.filter((g) => isGigCompleted(g)).reverse(),
    [visibleGigs]
  );

  const setArtistFilter = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("artist", id);
    else next.delete("artist");
    setSearchParams(next, { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
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
              onClick={() => navigate("/booking-manager/roster")}
              size="sm"
              className="gap-1 text-xs sm:text-sm"
            >
              <CalendarPlus className="h-4 w-4" />
              Book Talent
            </Button>
            <Button
              onClick={() => navigate("/artists")}
              size="sm"
              variant="secondary"
              className="gap-1 text-xs sm:text-sm"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span> Talent
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-4">
          {/* LEFT: Categorized roster */}
          <aside className="bg-card border rounded-lg p-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search roster..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {managedArtists.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No artists yet. Add some from Discover.
              </p>
            ) : (
              <div className="space-y-5">
                {CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICON[cat];
                  const items = grouped[cat];
                  return (
                    <section key={cat}>
                      <header className="flex items-center gap-2 mb-2 px-1">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold">{cat}</h2>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {items.length}
                        </Badge>
                      </header>
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-1 italic">None assigned</p>
                      ) : (
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
                                    onClick={() => setArtistFilter(isActive ? null : artist.artist_id)}
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
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </aside>

          {/* RIGHT: Booked dates + pending invites */}
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
                      return (
                        <li key={`${gig.id}-${gig.artist_id}`} className="py-3 flex items-center gap-3">
                          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-md bg-muted text-center flex-shrink-0">
                            <span className="text-[10px] uppercase font-medium text-muted-foreground leading-none">
                              {d.toLocaleDateString("en-US", { month: "short" })}
                            </span>
                            <span className="text-lg font-bold leading-none mt-0.5">{d.getDate()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{gig.venue_name || gig.venue}</p>
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
                          <Badge
                            variant={
                              gig.status === "confirmed"
                                ? "default"
                                : gig.status === "pending"
                                ? "secondary"
                                : "outline"
                            }
                            className="flex-shrink-0"
                          >
                            {gig.status}
                          </Badge>
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
                            <Badge variant="outline" className="flex-shrink-0">
                              Completed
                            </Badge>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
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
      </main>
      <BottomNav />
    </div>
  );
}
