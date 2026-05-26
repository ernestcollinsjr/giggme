import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Plus, Trash2, Youtube, ArrowLeft, Loader2, Mail, Phone, MessageCircle, DollarSign, History, TrendingUp, CalendarCheck, Navigation, CalendarIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { TopNav } from "@/components/TopNav";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { detectFaceAndCrop, loadImage } from "@/utils/imageCropping";
import { format } from "date-fns";
import { PerformerQRCode } from "@/components/PerformerQRCode";
import { PerformerRatingsDisplay } from "@/components/PerformerRatingsDisplay";
import { RatingsAnalyticsDashboard } from "@/components/RatingsAnalyticsDashboard";

interface PaymentMethods {
  venmo?: string;
  cashapp?: string;
  applepay?: string;
}

interface ArtistProfile {
  id: string;
  user_id: string;
  stage_name: string | null;
  genre: string | null;
  years_experience: number | null;
  availability: string | null;
  rate_range: string | null;
  youtube_videos: Array<{ url: string; title: string }>;
  social_links: { [key: string]: string };
  achievements: string[];
  payment_methods: PaymentMethods;
}

interface Profile {
  name: string;
  bio: string | null;
  photo_urls: string[];
  email?: string;
  phone_number?: string | null;
}

interface Tip {
  id: string;
  tipper_name: string | null;
  amount: number;
  payment_method: string;
  note: string | null;
  created_at: string;
}

const ArtistProfile = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [tips, setTips] = useState<Tip[]>([]);
  const [newTip, setNewTip] = useState({ tipper_name: "", amount: "", payment_method: "venmo", note: "" });
  const [addingTip, setAddingTip] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string>("");
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

  const handleSendBookingRequest = async () => {
    if (bookingForm.dates.length === 0 || !bookingForm.venue.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select at least one date and venue.",
      });
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

      // Send email notification to performer via Resend
      if (profile?.email) {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", user.id)
          .maybeSingle();

        const { error: emailError } = await supabase.functions.invoke("send-booking-request-email", {
          body: {
            performerId: profileUserId || userId,
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
            appUrl: window.location.origin,
          },
        });
        if (emailError) console.error("Email send failed:", emailError);
      }

      toast({
        title: "Booking request sent",
        description: `Your request was sent to ${profile?.name || "the performer"}.`,
      });
      setBookingOpen(false);
      setBookingForm({ dates: [], startTime: "", endTime: "", venue: "", venueLat: null, venueLng: null, venuePhone: "", budget: "", foodDiscounts: "", dressCode: "", contactPerson: "" });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not send request",
        description: err.message || "Please try again.",
      });
    } finally {
      setBookingSubmitting(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [userId]);

  useEffect(() => {
    if (isOwnProfile) {
      fetchTips();
    }
  }, [isOwnProfile]);

  const fetchTips = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) return;

      const { data, error } = await supabase
        .from("artist_tips")
        .select("*")
        .eq("artist_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTips(data || []);
    } catch (error: any) {
      console.error("Error fetching tips:", error);
    }
  };

  const handleAddTip = async () => {
    if (!newTip.amount || parseFloat(newTip.amount) <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    setAddingTip(true);
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("artist_tips").insert({
        artist_id: user.id,
        tipper_name: newTip.tipper_name || null,
        amount: parseFloat(newTip.amount),
        payment_method: newTip.payment_method,
        note: newTip.note || null,
      });

      if (error) throw error;

      setNewTip({ tipper_name: "", amount: "", payment_method: "venmo", note: "" });
      fetchTips();
      toast({ title: "Success", description: "Tip recorded successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setAddingTip(false);
    }
  };

  const handleDeleteTip = async (tipId: string) => {
    try {
      const { error } = await supabase.from("artist_tips").delete().eq("id", tipId);
      if (error) throw error;
      setTips(tips.filter(t => t.id !== tipId));
      toast({ title: "Success", description: "Tip deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const totalTips = tips.reduce((sum, tip) => sum + Number(tip.amount), 0);

  const fetchProfiles = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      
      // Determine which user's profile to load
      const targetUserId = userId || user?.id;
      
      if (!targetUserId) {
        navigate("/auth");
        return;
      }

      // Check if viewing own profile
      const viewingOwnProfile = !userId || (user && userId === user.id);
      setIsOwnProfile(viewingOwnProfile);
      setProfileUserId(targetUserId);

      // Fetch basic profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", targetUserId)
        .maybeSingle();

      if (profileError) throw profileError;
      
      if (!profileData) {
        toast({
          title: "Profile not found",
          description: "This artist profile does not exist.",
          variant: "destructive",
        });
        navigate("/artists");
        return;
      }
      
      setProfile(profileData);

      // Fetch artist profile
      const { data: artistData, error: artistError } = await supabase
        .from("artist_profiles")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (artistError && artistError.code !== "PGRST116") throw artistError;

      if (artistData) {
        setArtistProfile({
          ...artistData,
          youtube_videos: (artistData.youtube_videos as any) || [],
          social_links: (artistData.social_links as any) || {},
          payment_methods: (artistData.payment_methods as PaymentMethods) || {},
        });
      } else if (viewingOwnProfile && user) {
        // Only create artist profile if viewing own profile
        const { data: newArtistProfile, error: createError } = await supabase
          .from("artist_profiles")
          .insert([{ user_id: user.id }])
          .select()
          .single();

        if (createError) throw createError;
        setArtistProfile({
          ...newArtistProfile,
          youtube_videos: (newArtistProfile.youtube_videos as any) || [],
          social_links: (newArtistProfile.social_links as any) || {},
          payment_methods: (newArtistProfile.payment_methods as PaymentMethods) || {},
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const MAX_PHOTOS = 8;

  const PHOTO_SIZE = 512; // Target size for profile photos (512x512)

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const currentPhotoCount = profile?.photo_urls?.length || 0;
    if (currentPhotoCount >= MAX_PHOTOS) {
      toast({
        title: "Limit Reached",
        description: `You can upload a maximum of ${MAX_PHOTOS} profile photos. Please remove one before adding another.`,
        variant: "destructive",
      });
      return;
    }

    setUploadingPhoto(true);
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      // Show processing toast
      toast({
        title: "Processing photo...",
        description: "Optimizing and cropping your image. This may take a moment.",
      });

      // Load and process the image with AI face detection and cropping
      const imageElement = await loadImage(file);
      const processedBlob = await detectFaceAndCrop(imageElement, PHOTO_SIZE);
      
      // Convert blob to file for upload
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const processedFile = new File([processedBlob], fileName, { type: 'image/jpeg' });

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, processedFile);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(uploadError.message || "Failed to upload photo");
      }

      const { data: { publicUrl } } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(fileName);

      const newPhotoUrls = [...(profile?.photo_urls || []), publicUrl];

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ photo_urls: newPhotoUrls })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile!, photo_urls: newPhotoUrls });
      toast({ 
        title: "Photo uploaded!", 
        description: `Optimized and saved (${newPhotoUrls.length}/${MAX_PHOTOS})` 
      });
    } catch (error: any) {
      console.error("Photo upload error:", error);
      toast({
        title: "Error uploading photo",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async (indexToRemove: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      const newPhotoUrls = profile?.photo_urls?.filter((_, i) => i !== indexToRemove) || [];

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ photo_urls: newPhotoUrls })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile!, photo_urls: newPhotoUrls });
      toast({ title: "Success", description: "Photo removed" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      // Update basic profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          name: profile?.name,
          bio: profile?.bio,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update artist profile
      const { error: artistError } = await supabase
        .from("artist_profiles")
        .update({
          stage_name: artistProfile?.stage_name,
          genre: artistProfile?.genre,
          years_experience: artistProfile?.years_experience,
          availability: artistProfile?.availability,
          rate_range: artistProfile?.rate_range,
          achievements: artistProfile?.achievements,
          social_links: artistProfile?.social_links,
          payment_methods: artistProfile?.payment_methods as Record<string, string> | undefined,
        })
        .eq("user_id", user.id);

      if (artistError) throw artistError;

      toast({ title: "Success", description: "Profile updated successfully" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddYoutubeVideo = async () => {
    if (!youtubeUrl || !youtubeTitle) {
      toast({ title: "Error", description: "Please enter both URL and title", variant: "destructive" });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      const newVideos = [...(artistProfile?.youtube_videos || []), { url: youtubeUrl, title: youtubeTitle }];

      const { error } = await supabase
        .from("artist_profiles")
        .update({ youtube_videos: newVideos })
        .eq("user_id", user.id);

      if (error) throw error;

      setArtistProfile({ ...artistProfile!, youtube_videos: newVideos });
      setYoutubeUrl("");
      setYoutubeTitle("");
      toast({ title: "Success", description: "Video added successfully" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveVideo = async (index: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      const newVideos = artistProfile?.youtube_videos.filter((_, i) => i !== index) || [];

      const { error } = await supabase
        .from("artist_profiles")
        .update({ youtube_videos: newVideos })
        .eq("user_id", user.id);

      if (error) throw error;

      setArtistProfile({ ...artistProfile!, youtube_videos: newVideos });
      toast({ title: "Success", description: "Video removed" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      <TopNav userRole="artist" />
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(isOwnProfile ? "/dashboard" : "/artists")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {isOwnProfile ? "Back to Dashboard" : "Back to Artists"}
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {profile?.name || "Artist"}{artistProfile?.genre ? ` - ${artistProfile.genre}` : ""} Profile
          </h1>
          
          {/* Booking Actions - Only show when viewing another artist's profile */}
          {!isOwnProfile && (
            <div className="flex flex-wrap gap-2">
              <Button
                className="flex items-center gap-2"
                onClick={() => setBookingOpen(true)}
              >
                <CalendarCheck className="h-4 w-4" />
                Book This Performer
              </Button>
              <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              bookingForm.dates.length === 0 && "text-muted-foreground"
                            )}
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
                          {[...bookingForm.dates]
                            .sort((a, b) => a.getTime() - b.getTime())
                            .map((d) => (
                              <Badge key={d.toISOString()} variant="secondary" className="gap-1 pr-1">
                                {format(d, "MMM d")}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setBookingForm({
                                      ...bookingForm,
                                      dates: bookingForm.dates.filter((x) => x.getTime() !== d.getTime()),
                                    })
                                  }
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
                        <Input
                          id="booking-start"
                          type="time"
                          value={bookingForm.startTime}
                          onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="booking-end">End</Label>
                        <Input
                          id="booking-end"
                          type="time"
                          value={bookingForm.endTime}
                          onChange={(e) => setBookingForm({ ...bookingForm, endTime: e.target.value })}
                        />
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
                              setBookingForm((prev) => ({
                                ...prev,
                                venue: val,
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
                      <Input
                        id="booking-phone"
                        type="tel"
                        placeholder="In case you're running late"
                        value={bookingForm.venuePhone}
                        onChange={(e) => setBookingForm({ ...bookingForm, venuePhone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="booking-budget">Budget (optional)</Label>
                      <Input
                        id="booking-budget"
                        placeholder="e.g. $500"
                        value={bookingForm.budget}
                        onChange={(e) => setBookingForm({ ...bookingForm, budget: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="booking-contact">Contact Person</Label>
                      <Input
                        id="booking-contact"
                        placeholder="Venue contact name"
                        value={bookingForm.contactPerson}
                        onChange={(e) => setBookingForm({ ...bookingForm, contactPerson: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="booking-dress">Dress Code</Label>
                      <Input
                        id="booking-dress"
                        placeholder="e.g. all black, formal"
                        value={bookingForm.dressCode}
                        onChange={(e) => setBookingForm({ ...bookingForm, dressCode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="booking-note">Note (optional)</Label>
                      <Textarea
                        id="booking-note"
                        placeholder="Any extra details..."
                        value={bookingForm.foodDiscounts}
                        onChange={(e) => setBookingForm({ ...bookingForm, foodDiscounts: e.target.value })}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleSendBookingRequest}
                      disabled={bookingSubmitting}
                    >
                      {bookingSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <CalendarCheck className="mr-2 h-4 w-4" />
                          Send Booking Request
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Contact Artist
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Contact {profile?.name}</DialogTitle>
                  <DialogDescription>
                    Get in touch with this artist for booking inquiries.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {profile?.email && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <Mail className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <a 
                          href={`mailto:${profile.email}`} 
                          className="font-medium text-primary hover:underline"
                        >
                          {profile.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {profile?.phone_number && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <Phone className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <a 
                          href={`tel:${profile.phone_number}`} 
                          className="font-medium text-primary hover:underline"
                        >
                          {profile.phone_number}
                        </a>
                      </div>
                    </div>
                  )}
                  {!profile?.email && !profile?.phone_number && (
                    <p className="text-center text-muted-foreground py-4">
                      This artist hasn't added contact information yet.
                    </p>
                  )}
                  <Button 
                    className="w-full" 
                    onClick={() => navigate(`/chat?recipient=${userId}`)}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Send Direct Message
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Profile Photo Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Photos</CardTitle>
              {isOwnProfile && (
                <CardDescription>
                  Upload up to {MAX_PHOTOS} professional photos ({profile?.photo_urls?.length || 0}/{MAX_PHOTOS})
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo Grid */}
              <div className="grid grid-cols-4 gap-2">
                {profile?.photo_urls?.map((url, index) => (
                  <div key={index} className="relative group">
                    <div className="h-28 w-28 rounded-lg overflow-hidden bg-muted">
                      <img src={url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                    </div>
                    {isOwnProfile && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemovePhoto(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                
                {/* Upload Button - Only for own profile */}
                {isOwnProfile && (profile?.photo_urls?.length || 0) < MAX_PHOTOS && (
                  <Label htmlFor="photo-upload" className={uploadingPhoto ? "cursor-wait" : "cursor-pointer"}>
                    <div className={`h-28 w-28 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors ${
                      uploadingPhoto 
                        ? "border-primary bg-primary/10" 
                        : "border-muted-foreground/50 hover:border-primary"
                    }`}>
                      {uploadingPhoto ? (
                        <Loader2 className="h-6 w-6 text-primary animate-spin" />
                      ) : (
                        <Plus className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <Input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                  </Label>
                )}
              </div>
              
              {uploadingPhoto && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing with AI face detection & compression...</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={profile?.name || ""}
                  onChange={(e) => setProfile({ ...profile!, name: e.target.value })}
                  disabled={!isOwnProfile}
                />
              </div>

              <div>
                <Label htmlFor="stage-name">Stage Name</Label>
                <Input
                  id="stage-name"
                  value={artistProfile?.stage_name || ""}
                  onChange={(e) => setArtistProfile({ ...artistProfile!, stage_name: e.target.value })}
                  placeholder="Your stage name"
                  disabled={!isOwnProfile}
                />
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={profile?.bio || ""}
                  onChange={(e) => setProfile({ ...profile!, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  rows={5}
                  disabled={!isOwnProfile}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="genre">Genre</Label>
                  <Input
                    id="genre"
                    value={artistProfile?.genre || ""}
                    onChange={(e) => setArtistProfile({ ...artistProfile!, genre: e.target.value })}
                    placeholder="Jazz, Rock, Pop, etc."
                    disabled={!isOwnProfile}
                  />
                </div>

                <div>
                  <Label htmlFor="experience">Years of Experience</Label>
                  <Input
                    id="experience"
                    type="number"
                    value={artistProfile?.years_experience || ""}
                    onChange={(e) => setArtistProfile({ ...artistProfile!, years_experience: parseInt(e.target.value) })}
                    disabled={!isOwnProfile}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="availability">Availability</Label>
                  <Input
                    id="availability"
                    value={artistProfile?.availability || ""}
                    onChange={(e) => setArtistProfile({ ...artistProfile!, availability: e.target.value })}
                    placeholder="Weekends, Full-time, etc."
                    disabled={!isOwnProfile}
                  />
                </div>

                <div>
                  <Label htmlFor="rate">Rate Range</Label>
                  <Input
                    id="rate"
                    value={artistProfile?.rate_range || ""}
                    onChange={(e) => setArtistProfile({ ...artistProfile!, rate_range: e.target.value })}
                    placeholder="$100-$500 per gig"
                    disabled={!isOwnProfile}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Methods
              </CardTitle>
              {isOwnProfile ? (
                <CardDescription>Add your payment handles for tips and payments from venues</CardDescription>
              ) : (
                <CardDescription>Send tips or payments to this artist</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isOwnProfile ? (
                <>
                  <div>
                    <Label htmlFor="venmo">Venmo Username</Label>
                    <Input
                      id="venmo"
                      value={artistProfile?.payment_methods?.venmo || ""}
                      onChange={(e) => setArtistProfile({ 
                        ...artistProfile!, 
                        payment_methods: { ...artistProfile?.payment_methods, venmo: e.target.value } 
                      })}
                      placeholder="@your-venmo-username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cashapp">Cash App Username</Label>
                    <Input
                      id="cashapp"
                      value={artistProfile?.payment_methods?.cashapp || ""}
                      onChange={(e) => setArtistProfile({ 
                        ...artistProfile!, 
                        payment_methods: { ...artistProfile?.payment_methods, cashapp: e.target.value } 
                      })}
                      placeholder="$your-cashapp-tag"
                    />
                  </div>
                  <div>
                    <Label htmlFor="applepay">Apple Pay / Phone Number</Label>
                    <Input
                      id="applepay"
                      value={artistProfile?.payment_methods?.applepay || ""}
                      onChange={(e) => setArtistProfile({ 
                        ...artistProfile!, 
                        payment_methods: { ...artistProfile?.payment_methods, applepay: e.target.value } 
                      })}
                      placeholder="Phone number for Apple Pay"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {artistProfile?.payment_methods?.venmo && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-[#3D95CE] flex items-center justify-center">
                        <span className="text-white font-bold text-sm">V</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Venmo</p>
                        <p className="font-medium">{artistProfile.payment_methods.venmo}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://venmo.com/${artistProfile.payment_methods.venmo?.replace('@', '')}`, '_blank')}
                      >
                        Open Venmo
                      </Button>
                    </div>
                  )}
                  {artistProfile?.payment_methods?.cashapp && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-[#00D632] flex items-center justify-center">
                        <span className="text-white font-bold text-sm">$</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Cash App</p>
                        <p className="font-medium">{artistProfile.payment_methods.cashapp}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://cash.app/${artistProfile.payment_methods.cashapp?.replace('$', '')}`, '_blank')}
                      >
                        Open Cash App
                      </Button>
                    </div>
                  )}
                  {artistProfile?.payment_methods?.applepay && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center">
                        <span className="text-background font-bold text-sm"></span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Apple Pay</p>
                        <p className="font-medium">{artistProfile.payment_methods.applepay}</p>
                      </div>
                    </div>
                  )}
                  {!artistProfile?.payment_methods?.venmo && 
                   !artistProfile?.payment_methods?.cashapp && 
                   !artistProfile?.payment_methods?.applepay && (
                    <p className="text-center text-muted-foreground py-4">
                      This artist hasn't added payment methods yet.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* YouTube Videos */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Videos</CardTitle>
              {isOwnProfile && (
                <CardDescription>Add YouTube links to your best performances</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isOwnProfile && (
                <>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="YouTube URL"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Video Title"
                        value={youtubeTitle}
                        onChange={(e) => setYoutubeTitle(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleAddYoutubeVideo}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Separator />
                </>
              )}

              <div className="space-y-4">
                {artistProfile?.youtube_videos?.map((video, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                    <Youtube className="h-6 w-6 text-red-500" />
                    <div className="flex-1">
                      <p className="font-medium">{video.title}</p>
                      <p className="text-sm text-muted-foreground">{video.url}</p>
                    </div>
                    {isOwnProfile && (
                      <Button variant="destructive" size="sm" onClick={() => handleRemoveVideo(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {(!artistProfile?.youtube_videos || artistProfile.youtube_videos.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">No videos added yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tip History - Only for own profile */}
          {isOwnProfile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Tip History
                </CardTitle>
                <CardDescription>Track tips and payments you've received</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                <div className="flex items-center gap-4 p-4 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tips Received</p>
                    <p className="text-2xl font-bold text-primary">${totalTips.toFixed(2)}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm text-muted-foreground">Total Transactions</p>
                    <p className="text-xl font-semibold">{tips.length}</p>
                  </div>
                </div>

                {/* Add New Tip */}
                <div className="p-4 border rounded-lg space-y-3">
                  <p className="font-medium">Record a New Tip</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Tipper name (optional)"
                      value={newTip.tipper_name}
                      onChange={(e) => setNewTip({ ...newTip, tipper_name: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Amount ($)"
                      value={newTip.amount}
                      onChange={(e) => setNewTip({ ...newTip, amount: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newTip.payment_method}
                      onChange={(e) => setNewTip({ ...newTip, payment_method: e.target.value })}
                    >
                      <option value="venmo">Venmo</option>
                      <option value="cashapp">Cash App</option>
                      <option value="applepay">Apple Pay</option>
                      <option value="cash">Cash</option>
                      <option value="other">Other</option>
                    </select>
                    <Input
                      placeholder="Note (optional)"
                      value={newTip.note}
                      onChange={(e) => setNewTip({ ...newTip, note: e.target.value })}
                    />
                  </div>
                  <Button onClick={handleAddTip} disabled={addingTip} className="w-full">
                    {addingTip ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Add Tip
                  </Button>
                </div>

                <Separator />

                {/* Tip List */}
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {tips.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No tips recorded yet</p>
                  ) : (
                    tips.map((tip) => (
                      <div key={tip.id} className="flex items-center gap-3 p-3 border rounded-lg group">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          tip.payment_method === 'venmo' ? 'bg-[#3D95CE]' :
                          tip.payment_method === 'cashapp' ? 'bg-[#00D632]' :
                          tip.payment_method === 'applepay' ? 'bg-foreground' :
                          'bg-muted-foreground'
                        }`}>
                          {tip.payment_method === 'venmo' ? 'V' :
                           tip.payment_method === 'cashapp' ? '$' :
                           tip.payment_method === 'applepay' ? '' :
                           tip.payment_method === 'cash' ? '💵' : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">${Number(tip.amount).toFixed(2)}</span>
                            {tip.tipper_name && (
                              <span className="text-sm text-muted-foreground">from {tip.tipper_name}</span>
                            )}
                          </div>
                          {tip.note && <p className="text-sm text-muted-foreground truncate">{tip.note}</p>}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tip.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteTip(tip.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Ratings */}
          {profileUserId && <PerformerRatingsDisplay artistId={profileUserId} />}

          {/* Ratings Analytics - Only for own profile */}
          {isOwnProfile && profileUserId && <RatingsAnalyticsDashboard artistId={profileUserId} />}

          {/* QR Code for Customer Ratings - Only for own profile */}
          {isOwnProfile && profileUserId && (
            <PerformerQRCode 
              artistId={profileUserId} 
              artistName={artistProfile?.stage_name || profile?.name || "Artist"} 
            />
          )}

          {/* Availability Calendar - Only show for own profile */}
          {isOwnProfile && <AvailabilityCalendar />}

          {/* Save Button - Only for own profile */}
          {isOwnProfile && (
            <Button onClick={handleSaveProfile} disabled={saving} className="w-full" size="lg">
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default ArtistProfile;
