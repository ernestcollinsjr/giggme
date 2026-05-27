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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CalendarCheck, CalendarIcon, X, Loader2, Navigation, MessageCircle, Mail, Phone, Music, Briefcase, Wrench, Tag, MapPin, Users, DollarSign, Youtube, Facebook, Instagram, Twitter, Globe, Clock, Play, Check, HelpCircle } from "lucide-react";
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
              {/* Avatar + name block */}
              <div className="flex flex-col items-center text-center space-y-3">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={primaryPhoto} alt={profile.name} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="w-full max-w-xs space-y-2">
                  <Input value={profile.name || ""} readOnly className="text-center font-medium" />
                  {profile.band_name && (
                    <Input value={profile.band_name} readOnly className="text-center" />
                  )}
                  {profile.performer_category && (
                    <Input value={profile.performer_category} readOnly className="text-center" />
                  )}
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
                      <div key={i} className="aspect-square rounded-lg overflow-hidden bg-muted">
                        <img src={url} alt={`Photo ${i + 2}`} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bio */}
              {profile.bio && (
                <div>
                  <Label className="text-sm font-medium">Bio</Label>
                  <Textarea value={profile.bio} readOnly rows={4} className="mt-1 resize-none" />
                </div>
              )}

              {/* Contact */}
              {(profile.email || profile.phone_number) && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {profile.email && (
                    <a href={`mailto:${profile.email}`} className="flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="text-sm truncate">{profile.email}</span>
                    </a>
                  )}
                  {profile.phone_number && (
                    <a href={`tel:${profile.phone_number}`} className="flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition">
                      <Phone className="h-4 w-4 text-primary" />
                      <span className="text-sm">{profile.phone_number}</span>
                    </a>
                  )}
                </div>
              )}

              {/* Performer details */}
              <div className="grid grid-cols-2 gap-4">
                {profile.instrument && (
                  <DetailRow icon={<Music className="h-4 w-4" />} label="Instrument" value={profile.instrument} />
                )}
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

              {/* Social links */}
              {profile.social_links && Object.values(profile.social_links).some(Boolean) && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Social</Label>
                  <div className="flex flex-wrap gap-2">
                    {profile.social_links.facebook && <SocialBtn href={profile.social_links.facebook} icon={<Facebook className="h-4 w-4 mr-1" />} label="Facebook" />}
                    {profile.social_links.instagram && <SocialBtn href={profile.social_links.instagram} icon={<Instagram className="h-4 w-4 mr-1" />} label="Instagram" />}
                    {profile.social_links.twitter && <SocialBtn href={profile.social_links.twitter} icon={<Twitter className="h-4 w-4 mr-1" />} label="Twitter" />}
                    {profile.social_links.website && <SocialBtn href={profile.social_links.website} icon={<Globe className="h-4 w-4 mr-1" />} label="Website" />}
                    {profile.social_links.tiktok && <SocialBtn href={profile.social_links.tiktok} icon={<Globe className="h-4 w-4 mr-1" />} label="TikTok" />}
                    {profile.social_links.spotify && <SocialBtn href={profile.social_links.spotify} icon={<Music className="h-4 w-4 mr-1" />} label="Spotify" />}
                  </div>
                </div>
              )}

              {/* YouTube */}
              {profile.youtube_links && profile.youtube_links.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block flex items-center gap-1">
                    <Youtube className="h-4 w-4 text-red-500" /> Performance Videos
                  </Label>
                  <div className="space-y-1">
                    {profile.youtube_links.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline truncate">
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Rider notes */}
              {profile.rider_notes && (
                <div>
                  <Label className="text-sm font-medium">Rider Notes</Label>
                  <Textarea value={profile.rider_notes} readOnly rows={3} className="mt-1 resize-none" />
                </div>
              )}

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
