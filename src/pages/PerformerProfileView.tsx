import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CalendarCheck, CalendarIcon, X, Loader2, Navigation, MessageCircle, Mail, Phone, Music, Briefcase, Wrench, Tag, MapPin, Users, DollarSign, Youtube, Facebook, Instagram, Twitter, Globe, Clock, Play, Check, HelpCircle, Crown, Bell, Shield, FileText, Lock } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { PerformerRatingsDisplay } from "@/components/PerformerRatingsDisplay";
import { YouTubePlayer, getYoutubeVideoId } from "@/components/YouTubePlayer";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const getYoutubeThumbnail = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg`;
  }
  return null;
};

interface PerformerProfile {
  id: string;
  name: string;
  bio: string | null;
  email: string | null;
  phone_number: string | null;
  photo_urls: string[] | null;
  band_name?: string | null;
  performer_category?: string | null;
  instrument?: string | null;
  years_experience?: number | null;
  travel_distance?: number | null;
  preferred_pay?: number | null;
  preferred_pay_hours?: number | null;
  equipment?: string[] | null;
  skills?: string[] | null;
  genres?: string[] | null;
  union_memberships?: string[] | null;
  rider_notes?: string | null;
  social_links?: Record<string, string> | null;
  youtube_links?: string[] | null;
  timezone?: string | null;
  availability_status?: string | null;
  created_at?: string | null;
}

const PerformerProfileView = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PerformerProfile | null>(null);
  const [performerRole, setPerformerRole] = useState<string | null>(null);
  const [weekAvailability, setWeekAvailability] = useState<{ date: string; status: string | null }[]>([]);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    dates: [] as Date[],
    startTime: "",
    endTime: "",
    venue: "",
    venueLat: null as number | null,
    venueLng: null as number | null,
    venuePhone: "",
    budget: "",
    foodDiscounts: "",
    dressCode: "",
    contactPerson: "",
  });

  useEffect(() => {
    if (searchParams.get("book") === "1") setBookingOpen(true);
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        navigate("/dashboard");
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        // If viewing own profile, redirect to editable My Profile
        if (session?.user?.id === userId) {
          navigate("/profile-setup", { replace: true });
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          toast({ title: "Profile not found", variant: "destructive" });
          navigate("/dashboard");
          return;
        }
        setProfile(data as any);

        // Load next 7 days of availability (read-only)
        const today = new Date();
        const next7 = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          return d.toISOString().split("T")[0];
        });
        const { data: avail } = await supabase
          .from("member_availability")
          .select("date, status")
          .eq("user_id", userId)
          .in("date", next7);
        const map = new Map((avail || []).map((a: any) => [a.date, a.status]));
        setWeekAvailability(next7.map((date) => ({ date, status: (map.get(date) as string) || null })));

        // Fetch the performer's role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        if (roleData?.role) setPerformerRole(roleData.role as string);
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, navigate, toast]);

  const handleSendBookingRequest = async () => {
    if (bookingForm.dates.length === 0 || !bookingForm.venue.trim()) {
      toast({ variant: "destructive", title: "Missing information", description: "Please select at least one date and venue." });
      return;
    }
    setBookingSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      const sortedDates = [...bookingForm.dates].sort((a, b) => a.getTime() - b.getTime());
      const datesStr = sortedDates.map((d) => format(d, "EEE, MMM d, yyyy")).join("; ");
      const timeStr = bookingForm.startTime || bookingForm.endTime
        ? ` (${bookingForm.startTime}${bookingForm.endTime ? ` – ${bookingForm.endTime}` : ""})`
        : "";

      const lines = [
        `Booking request for ${profile?.name || "you"}`,
        `Date${sortedDates.length > 1 ? "s" : ""}: ${datesStr}${timeStr}`,
        `Venue: ${bookingForm.venue.trim()}`,
        bookingForm.venuePhone.trim() ? `Venue Phone: ${bookingForm.venuePhone.trim()}` : null,
        bookingForm.budget.trim() ? `Budget: ${bookingForm.budget.trim()}` : null,
        bookingForm.contactPerson.trim() ? `Contact Person: ${bookingForm.contactPerson.trim()}` : null,
        bookingForm.dressCode.trim() ? `Dress Code: ${bookingForm.dressCode.trim()}` : null,
        bookingForm.foodDiscounts.trim() ? `Note: ${bookingForm.foodDiscounts.trim()}` : null,
      ].filter(Boolean).join("\n");

      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        recipient_id: userId,
        content: lines,
        is_group_message: false,
      });
      if (error) throw error;

      if (profile?.email) {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", user.id)
          .maybeSingle();

        let eventDateIso: string | undefined;
        if (sortedDates.length > 0) {
          const first = new Date(sortedDates[0]);
          if (bookingForm.startTime) {
            const [hh, mm] = bookingForm.startTime.split(":").map(Number);
            if (!Number.isNaN(hh)) first.setHours(hh, Number.isNaN(mm) ? 0 : mm, 0, 0);
          }
          eventDateIso = first.toISOString();
        }

        await supabase.functions.invoke("send-booking-request-email", {
          body: {
            performerId: userId,
            performerEmail: profile.email,
            performerName: profile?.name,
            bookerName: senderProfile?.name,
            bookerEmail: senderProfile?.email || user.email,
            dates: datesStr,
            time: timeStr.trim(),
            venue: bookingForm.venue.trim(),
            venuePhone: bookingForm.venuePhone.trim() || undefined,
            budget: bookingForm.budget.trim() || undefined,
            contactPerson: bookingForm.contactPerson.trim() || undefined,
            dressCode: bookingForm.dressCode.trim() || undefined,
            note: bookingForm.foodDiscounts.trim() || undefined,
            eventDate: eventDateIso,
            appUrl: window.location.hostname.endsWith("lovable.app") || window.location.hostname.endsWith("lovable.dev") ? "https://giggme.com" : window.location.origin,
          },
        });
      }

      toast({ title: "Booking request sent", description: `Your request was sent to ${profile?.name || "the performer"}.` });
      setBookingOpen(false);
      setBookingForm({ dates: [], startTime: "", endTime: "", venue: "", venueLat: null, venueLng: null, venuePhone: "", budget: "", foodDiscounts: "", dressCode: "", contactPerson: "" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not send request", description: err.message || "Please try again." });
    } finally {
      setBookingSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return null;

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;

  const initials = (profile.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const primaryPhoto = profile.photo_urls?.[0];
  const extraPhotos = (profile.photo_urls || []).slice(1, 4);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      <TopNav userRole="artist" />
      <div className="p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Card className="border-border/50 shadow-xl">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl">Performer Profile</CardTitle>
                  <CardDescription>View this performer's details and book them</CardDescription>
                </div>
                <Button onClick={() => setBookingOpen(true)} className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4" />
                  Book Talent
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="w-full grid grid-cols-5 h-auto p-1 mb-6">
                  <TabsTrigger value="profile" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                    <Music className="h-3.5 w-3.5" /><span className="hidden sm:inline">Profile</span>
                  </TabsTrigger>
                  <TabsTrigger value="alerts" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                    <Bell className="h-3.5 w-3.5" /><span className="hidden sm:inline">Alerts</span>
                  </TabsTrigger>
                  <TabsTrigger value="availability" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                    <Clock className="h-3.5 w-3.5" /><span className="hidden sm:inline">Availability</span>
                  </TabsTrigger>
                  <TabsTrigger value="rider" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                    <FileText className="h-3.5 w-3.5" /><span className="hidden sm:inline">Rider</span>
                  </TabsTrigger>
                  <TabsTrigger value="payment" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                    <DollarSign className="h-3.5 w-3.5" /><span className="hidden sm:inline">Payment</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="mt-0 space-y-6">

              {/* Profile Completeness */}
              {(() => {
                const checks = [
                  !!profile.name,
                  !!profile.bio,
                  !!profile.email,
                  !!profile.phone_number,
                  !!profile.instrument,
                  (profile.photo_urls?.length || 0) > 0,
                  (profile.genres?.length || 0) > 0,
                  (profile.skills?.length || 0) > 0,
                  (profile.equipment?.length || 0) > 0,
                  !!profile.timezone,
                ];
                const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-sm font-medium">Profile Completeness</Label>
                      <span className="text-sm font-semibold text-primary">{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

              {/* Avatar + name block */}
              <div className="flex flex-col items-center text-center space-y-3">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={primaryPhoto} alt={profile.name} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="w-full max-w-xs space-y-2">
                  <Input value={profile.name || ""} readOnly className="text-center font-medium" />
                  {profile.band_name && (
                    <div className="space-y-1 text-left">
                      <Label className="text-xs">Band Name</Label>
                      <Input value={profile.band_name} readOnly />
                    </div>
                  )}
                  {/* Solo / Duo / Band selector (read-only display) */}
                  <div className="space-y-1 text-left">
                    <Label className="text-xs">Category</Label>
                    <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                      {(["Solo", "Duo", "Band"] as const).map((c) => {
                        const active = (profile.performer_category || "Solo") === c;
                        return (
                          <div
                            key={c}
                            className={`text-center text-sm py-1.5 rounded-sm font-medium ${
                              active ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {c}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {memberSince && (
                  <p className="text-xs text-muted-foreground">Member since {memberSince}</p>
                )}
              </div>

              {/* Additional photos */}
              {extraPhotos.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Additional Photos</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {extraPhotos.map((url, i) => (
                      <div key={i}>
                        <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                          <img src={url} alt={`Photo ${i + 2}`} className="h-full w-full object-cover" />
                        </div>
                        <p className="text-xs text-muted-foreground text-center mt-1">Photo {i + 2}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bio with char counter */}
              {profile.bio && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="bio" className="text-sm font-medium">Bio</Label>
                    <span className="text-xs text-muted-foreground">{profile.bio.length}/350</span>
                  </div>
                  <Textarea id="bio" value={profile.bio} readOnly rows={4} className="mt-1 resize-none" />
                </div>
              )}

              {/* Email */}
              {profile.email && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center gap-2"><Mail className="h-4 w-4" /> Email Address</Label>
                  <a href={`mailto:${profile.email}`} className="block">
                    <Input value={profile.email} readOnly className="cursor-pointer" />
                  </a>
                </div>
              )}

              {/* Phone */}
              {profile.phone_number && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center gap-2"><Phone className="h-4 w-4" /> Phone Number</Label>
                  <a href={`tel:${profile.phone_number}`} className="block">
                    <Input value={profile.phone_number} readOnly className="cursor-pointer" />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Include country code (e.g., +1 for US).
                  </p>
                </div>
              )}

              {/* Timezone */}
              {profile.timezone && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" /> Timezone</Label>
                  <Input value={profile.timezone} readOnly />
                </div>
              )}

              {/* Primary Instrument */}
              {profile.instrument && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center gap-2"><Music className="h-4 w-4" /> Primary Instrument</Label>
                  <Input value={profile.instrument} readOnly className="capitalize" />
                </div>
              )}

              {/* Other performer metrics */}
              <div className="grid grid-cols-2 gap-4">
                {profile.years_experience != null && (
                  <DetailRow icon={<Briefcase className="h-4 w-4" />} label="Experience" value={`${profile.years_experience} years`} />
                )}
                {profile.travel_distance != null && (
                  <DetailRow icon={<MapPin className="h-4 w-4" />} label="Travel Distance" value={`${profile.travel_distance} mi`} />
                )}
                {profile.preferred_pay != null && (
                  <DetailRow
                    icon={<DollarSign className="h-4 w-4" />}
                    label="Preferred Pay"
                    value={`$${Number(profile.preferred_pay).toFixed(2)}${profile.preferred_pay_hours != null ? ` / ${profile.preferred_pay_hours} hr${Number(profile.preferred_pay_hours) === 1 ? "" : "s"}` : ""}`}
                  />
                )}
              </div>

              {profile.genres && profile.genres.length > 0 && (
                <BadgeList icon={<Tag className="h-3 w-3" />} label="Genres" items={profile.genres} />
              )}
              {profile.skills && profile.skills.length > 0 && (
                <BadgeList icon={<Briefcase className="h-3 w-3" />} label="Skills" items={profile.skills} />
              )}
              {profile.equipment && profile.equipment.length > 0 && (
                <BadgeList icon={<Wrench className="h-3 w-3" />} label="Equipment" items={profile.equipment} />
              )}
              {profile.union_memberships && profile.union_memberships.length > 0 && (
                <BadgeList icon={<Users className="h-3 w-3" />} label="Union Memberships" items={profile.union_memberships} variant="outline" />
              )}

              {/* Social links — always visible */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Social Media</Label>
                {profile.social_links && Object.values(profile.social_links).some(Boolean) ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.social_links.facebook && <SocialBtn href={profile.social_links.facebook} icon={<Facebook className="h-4 w-4 mr-1" />} label="Facebook" />}
                    {profile.social_links.instagram && <SocialBtn href={profile.social_links.instagram} icon={<Instagram className="h-4 w-4 mr-1" />} label="Instagram" />}
                    {profile.social_links.twitter && <SocialBtn href={profile.social_links.twitter} icon={<Twitter className="h-4 w-4 mr-1" />} label="Twitter" />}
                    {profile.social_links.website && <SocialBtn href={profile.social_links.website} icon={<Globe className="h-4 w-4 mr-1" />} label="Website" />}
                    {profile.social_links.tiktok && <SocialBtn href={profile.social_links.tiktok} icon={<Globe className="h-4 w-4 mr-1" />} label="TikTok" />}
                    {profile.social_links.spotify && <SocialBtn href={profile.social_links.spotify} icon={<Music className="h-4 w-4 mr-1" />} label="Spotify" />}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No social media links added yet.</p>
                )}
              </div>

              {/* YouTube — always visible */}
              <div>
                <Label className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Youtube className="h-4 w-4 text-red-500" /> Performance Videos
                </Label>
                {profile.youtube_links && profile.youtube_links.length > 0 ? (
                  <div className="space-y-3">
                    {profile.youtube_links.map((url, i) => {
                      const thumbnail = getYoutubeThumbnail(url);
                      const videoId = getYoutubeVideoId(url);
                      const isPlaying = playingVideoId === videoId;
                      return (
                        <div key={i} className="border rounded-lg bg-muted/50 overflow-hidden">
                          {isPlaying && videoId ? (
                            <div className="p-2">
                              <div className="flex justify-end mb-2">
                                <Button type="button" variant="ghost" size="sm" onClick={() => setPlayingVideoId(null)}>
                                  <X className="h-4 w-4 mr-1" />Close
                                </Button>
                              </div>
                              <YouTubePlayer videoId={videoId} title="Video" inline />
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 p-2">
                              {thumbnail ? (
                                <button type="button" onClick={() => videoId && setPlayingVideoId(videoId)} className="shrink-0 relative group cursor-pointer">
                                  <img src={thumbnail} alt="Video thumbnail" className="w-24 h-14 object-cover rounded-md" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                                    <Play className="h-6 w-6 text-white" />
                                  </div>
                                </button>
                              ) : (
                                <button type="button" onClick={() => videoId && setPlayingVideoId(videoId)} className="w-24 h-14 bg-muted rounded-md flex items-center justify-center shrink-0 cursor-pointer">
                                  <Youtube className="h-6 w-6 text-red-500" />
                                </button>
                              )}
                              <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm truncate text-primary hover:underline">{url}</a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No performance videos added yet.</p>
                )}
              </div>
                </TabsContent>

                <TabsContent value="alerts" className="mt-0 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Bell className="h-5 w-5 text-primary" /> Notification Preferences
                    </h3>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30 flex items-start gap-3">
                    <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      This performer's notification preferences are private. They will receive your booking request via their preferred channel (in-app, email, or SMS).
                    </p>
                  </div>
                </TabsContent>


                <TabsContent value="availability" className="mt-0 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" /> Availability
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Next 7 days. Send a booking request to confirm a specific date.
                    </p>
                  </div>
                  {weekAvailability.length > 0 ? (
                    <>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-2">
                          {profile.availability_status === "available" ? (
                            <><span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" /><span className="text-sm font-medium text-green-600">Available</span></>
                          ) : profile.availability_status === "unavailable" ? (
                            <><span className="w-3 h-3 rounded-full bg-red-500" /><span className="text-sm font-medium text-red-600">Unavailable</span></>
                          ) : profile.availability_status === "tentative" ? (
                            <><span className="w-3 h-3 rounded-full bg-yellow-500" /><span className="text-sm font-medium text-yellow-600">Tentative</span></>
                          ) : (
                            <><span className="w-3 h-3 rounded-full bg-muted-foreground/30" /><span className="text-sm text-muted-foreground">Not set</span></>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                          {weekAvailability.map((day, idx) => {
                            const dt = new Date(day.date + "T00:00:00");
                            const dayLabel = dt.toLocaleDateString("en-US", { weekday: "short" }).charAt(0);
                            const dayNum = dt.getDate();
                            return (
                              <div key={day.date} className="flex flex-col items-center" title={`${dt.toLocaleDateString()} — ${day.status || "not set"}`}>
                                <span className="text-[10px] text-muted-foreground">{dayLabel}</span>
                                <div className={`w-6 h-6 sm:w-5 sm:h-5 rounded-sm flex items-center justify-center text-[10px] sm:text-[9px] font-medium text-white ${
                                  day.status === "available" ? "bg-green-500"
                                    : day.status === "unavailable" ? "bg-red-500"
                                    : day.status === "tentative" ? "bg-yellow-500"
                                    : "bg-muted-foreground/20 text-muted-foreground"
                                } ${idx === 0 ? "ring-2 ring-primary ring-offset-1" : ""}`}>
                                  {dayNum}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" />Available</span>
                        <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3 text-yellow-500" />Tentative</span>
                        <span className="flex items-center gap-1"><X className="h-3 w-3 text-red-500" />Unavailable</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No availability set for the next 7 days.</p>
                  )}
                </TabsContent>

                <TabsContent value="rider" className="mt-0 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" /> Rider Notes
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Performer's technical and hospitality requirements.
                    </p>
                  </div>
                  {profile.rider_notes ? (
                    <Textarea value={profile.rider_notes} readOnly rows={6} className="resize-none" />
                  ) : (
                    <p className="text-sm text-muted-foreground">No rider notes provided.</p>
                  )}
                </TabsContent>

                <TabsContent value="payment" className="mt-0 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" /> Payment
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Booking rates and payment details.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <Label className="text-xs text-muted-foreground">Hourly Rate</Label>
                      <p className="text-lg font-semibold mt-1">
                        {profile.hourly_rate ? `$${profile.hourly_rate}/hr` : "Not specified"}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <Label className="text-xs text-muted-foreground">Event Rate</Label>
                      <p className="text-lg font-semibold mt-1">
                        {profile.event_rate ? `$${profile.event_rate}/event` : "Not specified"}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30 flex items-start gap-3">
                    <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      Payment is processed securely after the booking is confirmed. Final amount may include travel, rider, and platform fees.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Ratings */}
              {userId && <PerformerRatingsDisplay artistId={userId} />}

              {/* Bottom actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => setBookingOpen(true)} className="flex-1 min-w-[140px]">
                  <CalendarCheck className="h-4 w-4 mr-2" />
                  Book Talent
                </Button>
                <Button variant="outline" onClick={() => navigate(`/chat?recipient=${userId}`)} className="flex-1 min-w-[140px]">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Message
                </Button>
              </div>
            </CardContent>

          </Card>
        </div>
      </div>

      {/* Booking dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto backdrop-blur-sm bg-black/60">
          <DialogHeader>
            <DialogTitle>Book {profile?.name || "this performer"}</DialogTitle>
            <DialogDescription>
              Send a booking request with the gig details. The performer will receive it as a direct message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Dates * <span className="text-xs text-muted-foreground font-normal">(select one or more)</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", bookingForm.dates.length === 0 && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {bookingForm.dates.length === 0
                      ? "Pick one or more dates"
                      : `${bookingForm.dates.length} date${bookingForm.dates.length > 1 ? "s" : ""} selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="multiple"
                    selected={bookingForm.dates}
                    onSelect={(dates) => setBookingForm({ ...bookingForm, dates: dates || [] })}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {bookingForm.dates.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[...bookingForm.dates].sort((a, b) => a.getTime() - b.getTime()).map((d) => (
                    <Badge key={d.toISOString()} variant="secondary" className="gap-1 pr-1">
                      {format(d, "MMM d")}
                      <button
                        type="button"
                        onClick={() => setBookingForm({ ...bookingForm, dates: bookingForm.dates.filter((x) => x.getTime() !== d.getTime()) })}
                        className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                        aria-label={`Remove ${format(d, "MMM d")}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="booking-start">Start</Label>
                <Input id="booking-start" type="time" value={bookingForm.startTime} onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="booking-end">End</Label>
                <Input id="booking-end" type="time" value={bookingForm.endTime} onChange={(e) => setBookingForm({ ...bookingForm, endTime: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-venue">Venue *</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <PlaceAutocomplete
                    value={bookingForm.venue}
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
                      setBookingForm((prev) => ({
                        ...prev,
                        venue: combined,
                        venueLat: typeof lat === "number" ? lat : prev.venueLat,
                        venueLng: typeof lng === "number" ? lng : prev.venueLng,
                        venuePhone: phone || prev.venuePhone,
                      }));
                    }}
                    placeholder="Search venue or address"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Navigate"
                  disabled={!bookingForm.venue.trim() && bookingForm.venueLat == null}
                  onClick={() => {
                    const dest = bookingForm.venueLat != null && bookingForm.venueLng != null
                      ? `${bookingForm.venueLat},${bookingForm.venueLng}`
                      : bookingForm.venue.trim();
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, "_blank");
                  }}
                >
                  <Navigation className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-phone">Venue Phone</Label>
              <Input id="booking-phone" type="tel" placeholder="In case you're running late" value={bookingForm.venuePhone} onChange={(e) => setBookingForm({ ...bookingForm, venuePhone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-budget">Budget (optional)</Label>
              <Input id="booking-budget" placeholder="e.g. $500" value={bookingForm.budget} onChange={(e) => setBookingForm({ ...bookingForm, budget: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-contact">Contact Person</Label>
              <Input id="booking-contact" placeholder="Venue contact name" value={bookingForm.contactPerson} onChange={(e) => setBookingForm({ ...bookingForm, contactPerson: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-dress">Dress Code</Label>
              <Input id="booking-dress" placeholder="e.g. all black, formal" value={bookingForm.dressCode} onChange={(e) => setBookingForm({ ...bookingForm, dressCode: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-note">Note (optional)</Label>
              <Textarea id="booking-note" placeholder="Any extra details..." value={bookingForm.foodDiscounts} onChange={(e) => setBookingForm({ ...bookingForm, foodDiscounts: e.target.value })} />
            </div>
            <Button className="w-full" onClick={handleSendBookingRequest} disabled={bookingSubmitting}>
              {bookingSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
              ) : (
                <><CalendarCheck className="mr-2 h-4 w-4" /> Send Booking Request</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const DetailRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    <span className="text-muted-foreground mt-0.5">{icon}</span>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  </div>
);

const BadgeList = ({ icon, label, items, variant = "secondary" }: { icon: React.ReactNode; label: string; items: string[]; variant?: "secondary" | "outline" }) => (
  <div>
    <Label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">{icon}{label}</Label>
    <div className="flex flex-wrap gap-2">
      {items.map((it, i) => <Badge key={i} variant={variant}>{it}</Badge>)}
    </div>
  </div>
);

const SocialBtn = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => (
  <Button variant="outline" size="sm" asChild>
    <a href={href} target="_blank" rel="noopener noreferrer">{icon}{label}</a>
  </Button>
);

export default PerformerProfileView;
