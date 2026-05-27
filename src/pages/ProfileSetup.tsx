import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { LogOut, Crown, Music, Briefcase, Mail, Loader2, Youtube, Facebook, Instagram, Twitter, Globe, Plus, Trash2, Wrench, Tag, MapPin, Clock, Play, X, Check, HelpCircle, Volume2, VolumeX, Undo2, Bell, Shield, FileText, Ban, Flag, Users, AlertTriangle, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { detectFaceAndCrop, loadImage } from "@/utils/imageCropping";
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { YouTubePlayer, getYoutubeVideoId } from "@/components/YouTubePlayer";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { NotificationPreferences } from "@/components/NotificationPreferences";
import { SafetyManager } from "@/components/SafetyManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RoleSwitcher from "@/components/RoleSwitcher";
import type { Json } from "@/integrations/supabase/types";

interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  website?: string;
  spotify?: string;
  tiktok?: string;
}

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("");
  const [hasRole, setHasRole] = useState(false);
  
  const [name, setName] = useState("");
  const [bandName, setBandName] = useState("");
  const [performerCategory, setPerformerCategory] = useState<string>("Solo");
  const [bio, setBio] = useState("");
  const [instrument, setInstrument] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [riderNotes, setRiderNotes] = useState("");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>(["", "", "", ""]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [processingPhoto, setProcessingPhoto] = useState<number | null>(null);
  const [memberSince, setMemberSince] = useState<string>("");
  
  // Social media state
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [youtubeLinks, setYoutubeLinks] = useState<string[]>([]);
  const [newYoutubeLink, setNewYoutubeLink] = useState("");
  
  // New profile fields
  const [equipment, setEquipment] = useState<string[]>([]);
  const [newEquipment, setNewEquipment] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [newGenre, setNewGenre] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState("available");
  const [todayCalendarStatus, setTodayCalendarStatus] = useState<string | null>(null);
  const [weekAvailability, setWeekAvailability] = useState<{date: string; status: string | null}[]>([]);
  const [selectedQuickStatus, setSelectedQuickStatus] = useState<'available' | 'unavailable' | 'tentative'>('available');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null);
  const [pulsingIndex, setPulsingIndex] = useState<number | null>(null);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(() => {
    const saved = localStorage.getItem('soundEffectsEnabled');
    return saved !== null ? saved === 'true' : true;
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const [undoData, setUndoData] = useState<{availability: {date: string; status: string | null}[], todayStatus: string | null} | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(5);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const undoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [travelDistance, setTravelDistance] = useState<string>("");
  const [yearsExperience, setYearsExperience] = useState<string>("");
  const [preferredPay, setPreferredPay] = useState<string>("");
  const [preferredPayHours, setPreferredPayHours] = useState<string>("");
  const [unionMemberships, setUnionMemberships] = useState<string[]>([]);
  const [newUnion, setNewUnion] = useState("");
  
  // Subscription state
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [isInvitedPerformer, setIsInvitedPerformer] = useState(false);
  
  // Video player state
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  
  // Email sending state
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      setUser(user);
      
      if (user) {
        // Fetch profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        
        // Fetch role from user_roles table (get first role if multiple exist)
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        
        // Fetch next 7 days availability from calendar
        const today = new Date();
        const next7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          return d.toISOString().split('T')[0];
        });
        
        const { data: weekData } = await supabase
          .from("member_availability")
          .select("date, status")
          .eq("user_id", user.id)
          .in("date", next7Days);
        
        // Map to array with all 7 days
        const weekMap = new Map(weekData?.map(d => [d.date, d.status]) || []);
        const weekAvail = next7Days.map(date => ({
          date,
          status: weekMap.get(date) || null
        }));
        setWeekAvailability(weekAvail);
        
        // Set today's status from the first day
        setTodayCalendarStatus(weekAvail[0]?.status || null);
        
        if (profile) {
          setName(profile.name || "");
          setBandName((profile as any).band_name || "");
          setPerformerCategory((profile as any).performer_category || "Solo");
          setBio(profile.bio || "");
          setInstrument(profile.instrument || "");
          setPhoneNumber(profile.phone_number || "");
          setEmail(profile.email || "");
          setRiderNotes(profile.rider_notes || "");
          // Auto-detect timezone from browser if not set in profile
          const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          setTimezone(profile.timezone || browserTimezone || "America/Chicago");
          const urls = profile.photo_urls || [];
          setPhotoUrls(urls);
          setPhotoPreviews(urls.length > 0 ? [...urls, "", "", "", ""].slice(0, 4) : ["", "", "", ""]);
          
          // Load social links and youtube links
          setSocialLinks((profile.social_links as SocialLinks) || {});
          setYoutubeLinks(profile.youtube_links || []);
          
          // Load new profile fields
          setEquipment(profile.equipment || []);
          setSkills(profile.skills || []);
          setGenres(profile.genres || []);
          setAvailabilityStatus(profile.availability_status || "available");
          setTravelDistance(profile.travel_distance?.toString() || "");
          setYearsExperience(profile.years_experience?.toString() || "");
          setPreferredPay((profile as any).preferred_pay?.toString() || "");
          setPreferredPayHours((profile as any).preferred_pay_hours?.toString() || "");
          setUnionMemberships(profile.union_memberships || []);
          
          // Format member since date
          if (profile.created_at) {
            const date = new Date(profile.created_at);
            const formattedDate = date.toLocaleDateString('en-US', { 
              month: 'short', 
              year: 'numeric' 
            });
            setMemberSince(formattedDate);
          }
        }
        
        if (roleData) {
          setRole(roleData.role);
          setHasRole(true);
        }

        // Detect invited performers (added to a band or booking manager roster)
        const [{ data: bandMem }, { data: bmArtist }] = await Promise.all([
          supabase.from("band_members").select("id").eq("member_id", user.id).limit(1),
          supabase.from("booking_manager_artists").select("id").eq("artist_id", user.id).limit(1),
        ]);
        if ((bandMem && bandMem.length > 0) || (bmArtist && bmArtist.length > 0)) {
          setIsInvitedPerformer(true);
        }
      }
    };
    
    getUser();
  }, []);

  // Check subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      setCheckingSubscription(true);
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (!error && data) {
          setIsSubscribed(data.subscribed);
        }
      } catch (err) {
        console.error("Error checking subscription:", err);
      } finally {
        setCheckingSubscription(false);
      }
    };
    
    checkSubscription();
  }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingPhoto(index);
    
    try {
      // Load the image
      const img = await loadImage(file);
      
      // Detect face and crop
      const targetSize = index === 0 ? 400 : 800;
      const croppedBlob = await detectFaceAndCrop(img, targetSize);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const newPreviews = [...photoPreviews];
        newPreviews[index] = reader.result as string;
        setPhotoPreviews(newPreviews);
      };
      reader.readAsDataURL(croppedBlob);
      
      // Store the cropped file
      const newFiles = [...photoFiles];
      newFiles[index] = new File([croppedBlob], `photo-${index}.jpg`, { type: 'image/jpeg' });
      setPhotoFiles(newFiles);
      
      toast({
        title: "Photo processed!",
        description: "Your photo has been automatically centered.",
      });
    } catch (error) {
      console.error('Error processing photo:', error);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: "Could not process the photo. Please try another image.",
      });
    } finally {
      setProcessingPhoto(null);
    }
  };


  const handleRemovePhoto = (index: number) => {
    const newFiles = [...photoFiles];
    const newPreviews = [...photoPreviews];
    newFiles[index] = null;
    newPreviews[index] = "";
    setPhotoFiles(newFiles);
    setPhotoPreviews(newPreviews);
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (!user) return photoUrls;

    const uploadedUrls = [...photoUrls];

    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      if (file) {
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}-${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('profile-photos')
            .upload(fileName, file, { upsert: true });

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
            .from('profile-photos')
            .getPublicUrl(fileName);

          uploadedUrls[i] = data.publicUrl;
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Photo upload failed",
            description: error.message,
          });
        }
      } else if (photoPreviews[i] === "") {
        uploadedUrls[i] = "";
      }
    }

    return uploadedUrls.filter(url => url !== "");
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: error.message,
      });
    }
  };

  const handleRoleSelection = async (selectedRole: string) => {
    setLoading(true);
    try {
      if (!user) throw new Error("No user found");

      const { error } = await supabase
        .from("user_roles")
        .insert([{ 
          user_id: user.id,
          role: selectedRole as any
        }]);

      if (error) throw error;

      setRole(selectedRole);
      setHasRole(true);

      toast({
        title: "Role selected!",
        description: "Now complete your profile to get started.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Role selection failed",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) throw new Error("No user found");

      const uploadedPhotoUrls = await uploadPhotos();

      // Flush any pending text in the "add" inputs so users don't lose typed values
      // when they click Save without first clicking the + button.
      const pendingYoutube = newYoutubeLink.trim();
      const finalYoutubeLinks = pendingYoutube && !youtubeLinks.includes(pendingYoutube)
        && (pendingYoutube.includes("youtube.com") || pendingYoutube.includes("youtu.be"))
        ? [...youtubeLinks, pendingYoutube]
        : youtubeLinks;

      const pendingEquipment = newEquipment.trim();
      const finalEquipment = pendingEquipment && !equipment.includes(pendingEquipment)
        ? [...equipment, pendingEquipment]
        : equipment;

      const pendingSkill = newSkill.trim();
      const finalSkills = pendingSkill && !skills.includes(pendingSkill)
        ? [...skills, pendingSkill]
        : skills;

      const pendingGenre = newGenre.trim();
      const finalGenres = pendingGenre && !genres.includes(pendingGenre)
        ? [...genres, pendingGenre]
        : genres;

      const pendingUnion = newUnion.trim();
      const finalUnions = pendingUnion && !unionMemberships.includes(pendingUnion)
        ? [...unionMemberships, pendingUnion]
        : unionMemberships;

      // Sync local state so UI reflects the flushed values
      if (finalYoutubeLinks !== youtubeLinks) { setYoutubeLinks(finalYoutubeLinks); setNewYoutubeLink(""); }
      if (finalEquipment !== equipment) { setEquipment(finalEquipment); setNewEquipment(""); }
      if (finalSkills !== skills) { setSkills(finalSkills); setNewSkill(""); }
      if (finalGenres !== genres) { setGenres(finalGenres); setNewGenre(""); }
      if (finalUnions !== unionMemberships) { setUnionMemberships(finalUnions); setNewUnion(""); }

      const updates = {
        id: user.id,
        name,
        band_name: (role === "band_member" || role === "band_leader") ? (bandName || null) : null,
        bio,
        email,
        instrument: (role === "band_leader" || role === "band_member" ? instrument : null) as any,
        phone_number: phoneNumber || null,
        rider_notes: riderNotes,
        timezone,
        photo_urls: uploadedPhotoUrls,
        social_links: socialLinks as Json,
        youtube_links: finalYoutubeLinks,
        equipment: finalEquipment,
        skills: finalSkills,
        genres: finalGenres,
        availability_status: availabilityStatus,
        travel_distance: travelDistance ? parseInt(travelDistance) : null,
        years_experience: yearsExperience ? parseInt(yearsExperience) : null,
        union_memberships: finalUnions,
        performer_category: performerCategory,
        preferred_pay: preferredPay ? parseFloat(preferredPay) : null,
        preferred_pay_hours: preferredPayHours ? parseFloat(preferredPayHours) : null,
        updated_at: new Date().toISOString(),
      } as any;


      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Profile updated!",
        description: "Your profile has been successfully updated.",
      });
      
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendRider = async () => {
    if (!recipientEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Please enter a recipient email address.",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail.trim())) {
      toast({
        variant: "destructive",
        title: "Invalid email",
        description: "Please enter a valid email address (e.g., name@example.com).",
      });
      return;
    }

    setSendingEmail(true);
    try {
      if (!user) throw new Error("No user found");

      const { data, error } = await supabase.functions.invoke("send-rider", {
        body: {
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim() || undefined,
          userId: user.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Rider sent!",
        description: `Your rider requirements have been sent to ${recipientEmail}`,
      });

      setShowEmailDialog(false);
      setRecipientEmail("");
      setRecipientName("");
    } catch (error: any) {
      console.error("Error sending rider:", error);
      toast({
        variant: "destructive",
        title: "Failed to send rider",
        description: error.message,
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Handle subscribe to plan
  const handleSubscribe = async () => {
    if (!user) return;
    
    setSubscribing(true);
    try {
      // Get user metadata for role and pricing preference
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userRole = currentUser?.user_metadata?.role || role;
      const venuePricingType = currentUser?.user_metadata?.venue_pricing_type || "subscription";
      
      // Determine price ID based on role
      let priceId: string;
      switch (userRole) {
        case "band_leader":
          priceId = "price_1Sfl1yEPiAZgF8MerV2S8Hcf"; // $14/mo
          break;
        case "booking_manager":
          priceId = "price_1Sfl29EPiAZgF8Me7Z7r8ty8"; // $26/mo
          break;
        case "venue_owner":
          priceId = venuePricingType === "one_time" 
            ? "price_1Sj4o1EPiAZgF8MeVAfYLZ1h" // $49 one-time
            : "price_1Sj4nrEPiAZgF8MeCOUpkIfg"; // $26/mo
          break;
        case "artist":
        default:
          priceId = "price_1SLNn8EPiAZgF8MeCFVMdvWR"; // $10.99/mo
          break;
      }
      
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      
      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        variant: "destructive",
        title: "Checkout failed",
        description: error.message || "Could not start checkout. Please try again.",
      });
    } finally {
      setSubscribing(false);
    }
  };

  const handleSocialLinkChange = (platform: keyof SocialLinks, value: string) => {
    setSocialLinks((prev) => ({
      ...prev,
      [platform]: value,
    }));
  };

  const addYoutubeLink = () => {
    if (!newYoutubeLink.trim()) return;
    
    if (!newYoutubeLink.includes("youtube.com") && !newYoutubeLink.includes("youtu.be")) {
      toast({
        variant: "destructive",
        title: "Invalid URL",
        description: "Please enter a valid YouTube URL.",
      });
      return;
    }

    setYoutubeLinks((prev) => [...prev, newYoutubeLink.trim()]);
    setNewYoutubeLink("");
  };

  const removeYoutubeLink = (index: number) => {
    setYoutubeLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const getYoutubeThumbnail = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
      }
    }
    return null;
  };

  // Equipment management
  const addEquipment = () => {
    if (!newEquipment.trim()) return;
    if (!equipment.includes(newEquipment.trim())) {
      setEquipment((prev) => [...prev, newEquipment.trim()]);
    }
    setNewEquipment("");
  };

  const removeEquipment = (index: number) => {
    setEquipment((prev) => prev.filter((_, i) => i !== index));
  };

  // Skills management
  const addSkill = () => {
    if (!newSkill.trim()) return;
    if (!skills.includes(newSkill.trim())) {
      setSkills((prev) => [...prev, newSkill.trim()]);
    }
    setNewSkill("");
  };

  const removeSkill = (index: number) => {
    setSkills((prev) => prev.filter((_, i) => i !== index));
  };

  // Genres management
  const addGenre = () => {
    if (!newGenre.trim()) return;
    if (!genres.includes(newGenre.trim())) {
      setGenres((prev) => [...prev, newGenre.trim()]);
    }
    setNewGenre("");
  };

  const removeGenre = (index: number) => {
    setGenres((prev) => prev.filter((_, i) => i !== index));
  };

  // Union management
  const addUnion = () => {
    if (!newUnion.trim()) return;
    if (!unionMemberships.includes(newUnion.trim())) {
      setUnionMemberships((prev) => [...prev, newUnion.trim()]);
    }
    setNewUnion("");
  };

  const removeUnion = (index: number) => {
    setUnionMemberships((prev) => prev.filter((_, i) => i !== index));
  };

  // Set availability for any date
  const setDateAvailability = async (dateStr: string, status: 'available' | 'unavailable' | 'tentative') => {
    try {
      if (!user) {
        toast({ title: "Please log in", variant: "destructive" });
        return;
      }
      
      // Check if there's an existing entry for this date
      const { data: existing } = await supabase
        .from('member_availability')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .maybeSingle();

      const today = new Date().toISOString().split('T')[0];

      if (existing) {
        // If same status, remove it (toggle off)
        if (existing.status === status) {
          const { error } = await supabase
            .from('member_availability')
            .delete()
            .eq('id', existing.id);

          if (error) throw error;
          
          // Update week availability
          setWeekAvailability(prev => prev.map(day => 
            day.date === dateStr ? { ...day, status: null } : day
          ));
          if (dateStr === today) setTodayCalendarStatus(null);
          toast({ title: `Availability cleared for ${new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` });
        } else {
          // Update to new status
          const { error } = await supabase
            .from('member_availability')
            .update({ status })
            .eq('id', existing.id);

          if (error) throw error;
          
          // Update week availability
          setWeekAvailability(prev => prev.map(day => 
            day.date === dateStr ? { ...day, status } : day
          ));
          if (dateStr === today) setTodayCalendarStatus(status);
          triggerSaveConfirmation();
          toast({ title: `${new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} marked as ${status}` });
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from('member_availability')
          .insert({ user_id: user.id, date: dateStr, status });

        if (error) throw error;
        
        // Update week availability
        setWeekAvailability(prev => prev.map(day => 
          day.date === dateStr ? { ...day, status } : day
        ));
        if (dateStr === today) setTodayCalendarStatus(status);
        triggerSaveConfirmation();
        toast({ title: `${new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} marked as ${status}` });
      }
    } catch (error) {
      console.error('Error setting availability:', error);
      toast({ title: "Error updating availability", variant: "destructive" });
    }
  };

  // Set availability for a range of dates (for drag)
  const setRangeAvailability = async (startIdx: number, endIdx: number, status: 'available' | 'unavailable' | 'tentative') => {
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    const datesToUpdate = weekAvailability.slice(minIdx, maxIdx + 1);
    
    if (datesToUpdate.length === 0) return;

    try {
      if (!user) {
        toast({ title: "Please log in", variant: "destructive" });
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      // Process each date
      for (const day of datesToUpdate) {
        const { data: existing } = await supabase
          .from('member_availability')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('date', day.date)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('member_availability')
            .update({ status })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('member_availability')
            .insert({ user_id: user.id, date: day.date, status });
        }
      }

      // Update local state
      setWeekAvailability(prev => prev.map((day, idx) => 
        idx >= minIdx && idx <= maxIdx ? { ...day, status } : day
      ));
      
      // Update today's status if in range
      const todayInRange = datesToUpdate.find(d => d.date === today);
      if (todayInRange) setTodayCalendarStatus(status);

      const count = datesToUpdate.length;
      triggerSaveConfirmation();
      toast({ title: `${count} day${count > 1 ? 's' : ''} marked as ${status}` });
    } catch (error) {
      console.error('Error setting range availability:', error);
      toast({ title: "Error updating availability", variant: "destructive" });
    }
  };

  // Set all week to a specific status
  const setAllWeekAvailability = async (status: 'available' | 'unavailable' | 'tentative') => {
    if (!user || weekAvailability.length === 0) return;
    await setRangeAvailability(0, weekAvailability.length - 1, status);
  };

  // Clear all week availability
  const clearAllWeekAvailability = async () => {
    if (!user || weekAvailability.length === 0) return;
    
    // Store current state for undo
    const previousAvailability = [...weekAvailability];
    const previousTodayStatus = todayCalendarStatus;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const datesToClear = weekAvailability.map(d => d.date);
      
      // Delete all availability records for the week
      const { error } = await supabase
        .from('member_availability')
        .delete()
        .eq('user_id', user.id)
        .in('date', datesToClear);
      
      if (error) throw error;
      
      // Update local state
      setWeekAvailability(prev => prev.map(day => ({ ...day, status: null })));
      
      // Update today's status if in range
      if (datesToClear.includes(today)) setTodayCalendarStatus(null);
      
      // Store undo data and show undo button
      setUndoData({ availability: previousAvailability, todayStatus: previousTodayStatus });
      setShowUndo(true);
      setUndoCountdown(5);
      
      // Clear any existing timers
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
      
      // Start countdown interval
      undoIntervalRef.current = setInterval(() => {
        setUndoCountdown(prev => {
          if (prev <= 1) {
            if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Hide undo button after 5 seconds
      undoTimeoutRef.current = setTimeout(() => {
        setShowUndo(false);
        setUndoData(null);
        if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
      }, 5000);
      
      triggerSaveConfirmation();
      toast({ title: "Week availability cleared" });
    } catch (error) {
      console.error('Error clearing availability:', error);
      toast({ title: "Error clearing availability", variant: "destructive" });
    }
  };

  // Undo clear availability
  const undoClearAvailability = async () => {
    if (!user || !undoData) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Restore each day's availability
      for (const day of undoData.availability) {
        if (day.status) {
          await supabase
            .from('member_availability')
            .upsert({
              user_id: user.id,
              date: day.date,
              status: day.status,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,date' });
        }
      }
      
      // Restore local state
      setWeekAvailability(undoData.availability);
      setTodayCalendarStatus(undoData.todayStatus);
      
      // Hide undo button
      setShowUndo(false);
      setUndoData(null);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
      
      triggerSaveConfirmation();
      toast({ title: "Availability restored" });
    } catch (error) {
      console.error('Error restoring availability:', error);
      toast({ title: "Error restoring availability", variant: "destructive" });
    }
  };

  // Ref for day button elements (for touch detection)
  const dayButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Haptic feedback helper
  const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Light) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style });
      } catch (error) {
        console.log('Haptics not available:', error);
      }
    }
  };

  // Visual pulse animation for haptic feedback
  const triggerPulse = (idx: number) => {
    setPulsingIndex(idx);
    setTimeout(() => setPulsingIndex(null), 150);
  };

  // Play confirmation sound effect
  const playConfirmationSound = () => {
    if (!soundEffectsEnabled) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      // Create a pleasant "ding" sound
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      oscillator.frequency.setValueAtTime(1320, ctx.currentTime + 0.1); // E6 note
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } catch (error) {
      console.log('Audio not supported:', error);
    }
  };

  // Toggle sound effects
  const toggleSoundEffects = () => {
    const newValue = !soundEffectsEnabled;
    setSoundEffectsEnabled(newValue);
    localStorage.setItem('soundEffectsEnabled', String(newValue));
    if (newValue) {
      playConfirmationSound(); // Play a preview when enabling
    }
  };

  // Save confirmation animation
  const triggerSaveConfirmation = () => {
    setShowSaveConfirmation(true);
    playConfirmationSound();
    setTimeout(() => setShowSaveConfirmation(false), 1500);
  };

  // Drag handlers for 7-day preview
  const handleDragStart = async (idx: number) => {
    setIsDragging(true);
    setDragStartIndex(idx);
    setDragEndIndex(idx);
    triggerPulse(idx);
    await triggerHaptic(ImpactStyle.Medium);
  };

  const handleDragEnter = async (idx: number) => {
    if (isDragging && dragEndIndex !== idx) {
      setDragEndIndex(idx);
      triggerPulse(idx);
      await triggerHaptic(ImpactStyle.Light);
    }
  };

  const handleDragEnd = async () => {
    if (isDragging && dragStartIndex !== null && dragEndIndex !== null) {
      // Pulse all selected items on release
      const minIdx = Math.min(dragStartIndex, dragEndIndex);
      const maxIdx = Math.max(dragStartIndex, dragEndIndex);
      for (let i = minIdx; i <= maxIdx; i++) {
        triggerPulse(i);
      }
      await triggerHaptic(ImpactStyle.Heavy);
      await setRangeAvailability(dragStartIndex, dragEndIndex, selectedQuickStatus);
    }
    setIsDragging(false);
    setDragStartIndex(null);
    setDragEndIndex(null);
  };

  // Touch handlers for mobile drag support
  const handleTouchStart = async (idx: number, e: React.TouchEvent) => {
    e.preventDefault();
    await handleDragStart(idx);
  };

  const handleTouchMove = async (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const touchX = touch.clientX;
    const touchY = touch.clientY;
    
    // Find which button the touch is currently over
    for (let i = 0; i < dayButtonRefs.current.length; i++) {
      const btn = dayButtonRefs.current[i];
      if (btn) {
        const rect = btn.getBoundingClientRect();
        if (
          touchX >= rect.left &&
          touchX <= rect.right &&
          touchY >= rect.top &&
          touchY <= rect.bottom
        ) {
          if (dragEndIndex !== i) {
            setDragEndIndex(i);
            triggerPulse(i);
            await triggerHaptic(ImpactStyle.Light);
          }
          break;
        }
      }
    }
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Helper to check if index is in drag range
  const isInDragRange = (idx: number): boolean => {
    if (!isDragging || dragStartIndex === null || dragEndIndex === null) return false;
    const minIdx = Math.min(dragStartIndex, dragEndIndex);
    const maxIdx = Math.max(dragStartIndex, dragEndIndex);
    return idx >= minIdx && idx <= maxIdx;
  };

  // Quick-set today's availability
  const setTodayAvailability = async (status: 'available' | 'unavailable' | 'tentative') => {
    const today = new Date().toISOString().split('T')[0];
    await setDateAvailability(today, status);
  };

  // Calculate profile completeness
  const calculateProfileCompleteness = (): number => {
    const fields = [
      !!name,
      !!bio,
      !!email,
      !!phoneNumber,
      photoPreviews.some(p => p),
      Object.values(socialLinks).some(v => v),
      youtubeLinks.length > 0,
      equipment.length > 0,
      skills.length > 0,
      genres.length > 0,
      !!instrument,
      !!yearsExperience,
    ];
    
    const filledCount = fields.filter(Boolean).length;
    return Math.round((filledCount / fields.length) * 100);
  };

  const profileCompleteness = calculateProfileCompleteness();

  const socialPlatforms = [
    { key: "facebook" as keyof SocialLinks, label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/yourprofile" },
    { key: "instagram" as keyof SocialLinks, label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/yourprofile" },
    { key: "twitter" as keyof SocialLinks, label: "X (Twitter)", icon: Twitter, placeholder: "https://x.com/yourprofile" },
    { key: "website" as keyof SocialLinks, label: "Website", icon: Globe, placeholder: "https://yourwebsite.com" },
    { key: "spotify" as keyof SocialLinks, label: "Spotify", icon: Music, placeholder: "https://open.spotify.com/artist/..." },
    { key: "tiktok" as keyof SocialLinks, label: "TikTok", icon: Globe, placeholder: "https://tiktok.com/@yourprofile" },
  ];

  const openExternalLink = async (url: string) => {
    console.log("Opening external link:", url);
    try {
      if (Capacitor.isNativePlatform()) {
        console.log("Using Capacitor Browser");
        await Browser.open({ url });
      } else {
        console.log("Using web fallback");
        // Try multiple approaches for maximum compatibility
        const newWindow = window.open(url, '_blank');
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          // Popup blocked or failed, try anchor click
          console.log("window.open failed, trying anchor");
          const a = document.createElement("a");
          a.href = url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
    } catch (error) {
      console.error("Error opening link:", error);
      // Last resort - navigate in same window
      window.location.href = url;
    }
  };

  if (!hasRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/10">
        <Card className="w-full max-w-4xl border-border/50 shadow-xl">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">Choose Your Role</CardTitle>
                <CardDescription>
                  Select how you'll be using the platform
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { 
                  value: "band_leader", 
                  label: "Band Leader", 
                  description: "Lead your band, manage your group, and connect with booking managers",
                  icon: Crown,
                  iconBg: "bg-primary/10",
                  iconColor: "text-primary"
                },
                { 
                  value: "band_member", 
                  label: "Band Member", 
                  description: "Share your location, showcase your skills, and stay connected",
                  icon: Music,
                  iconBg: "bg-secondary/10",
                  iconColor: "text-secondary"
                },
                { 
                  value: "booking_manager", 
                  label: "Booking Manager", 
                  description: "Discover talented bands and manage your roster",
                  icon: Briefcase,
                  iconBg: "bg-accent/10",
                  iconColor: "text-accent"
                },
              ].map((roleOption) => {
                const Icon = roleOption.icon;
                return (
                  <Card 
                    key={roleOption.value}
                    className="border-border/50 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-105"
                    onClick={() => !loading && handleRoleSelection(roleOption.value)}
                  >
                    <CardContent className="pt-6">
                      <div className={`w-12 h-12 rounded-full ${roleOption.iconBg} flex items-center justify-center mb-4`}>
                        <Icon className={`h-6 w-6 ${roleOption.iconColor}`} />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{roleOption.label}</h3>
                      <p className="text-muted-foreground text-sm">
                        {roleOption.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/10">
      <Card className="w-full max-w-2xl border-border/50 shadow-xl">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">My Profile</CardTitle>
              <CardDescription>
                Manage your account information
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Subscription Prompt - Hide for super_admin */}
          {isSubscribed === false && !checkingSubscription && role !== "super_admin" && !isInvitedPerformer && (
            <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 border border-primary/20 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">Complete Your Subscription</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {role === "artist" && "Start your 14-day free trial at $10.99/mo to unlock all features."}
                    {role === "band_leader" && "Start your 7-day free trial at $14/mo to manage your band."}
                    {role === "booking_manager" && "Start your 7-day free trial at $26/mo to manage artists."}
                    {role === "venue_owner" && "Subscribe at $26/mo (14-day trial) or $49 one-time to book entertainers."}
                    {!["artist", "band_leader", "booking_manager", "venue_owner"].includes(role) && "Subscribe to unlock all features."}
                  </p>
                  <Button 
                    onClick={handleSubscribe} 
                    disabled={subscribing}
                    className="mt-3"
                    size="sm"
                  >
                    {subscribing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Subscribe Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Tabbed Navigation */}
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="w-full grid grid-cols-6 h-auto p-1 mb-6">
              <TabsTrigger value="profile" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                <Music className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="role" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                <Crown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Role</span>
              </TabsTrigger>
              <TabsTrigger value="alerts" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                <Bell className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Alerts</span>
              </TabsTrigger>
              <TabsTrigger value="safety" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Safety</span>
              </TabsTrigger>
              <TabsTrigger value="availability" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                <Clock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Availability</span>
              </TabsTrigger>
              <TabsTrigger value="terms" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Rider</span>
              </TabsTrigger>
            </TabsList>
          
            {/* Profile Completeness Indicator */}
            {(role === "band_leader" || role === "band_member" || role === "artist") && (
              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Profile Completeness</Label>
                  <span className={`text-sm font-bold ${profileCompleteness === 100 ? 'text-green-500' : profileCompleteness >= 70 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                    {profileCompleteness}%
                  </span>
                </div>
                <Progress value={profileCompleteness} className="h-2" />
                {profileCompleteness < 100 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Complete your profile to increase visibility to venues and managers
                  </p>
                )}
              </div>
            )}

            {/* Role Tab - Outside form since it handles its own submission */}
            <TabsContent value="role" className="mt-0 space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    Switch Your Role
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose the role that best describes how you use this app
                  </p>
                </div>
                
                <RoleSwitcher 
                  currentRole={role as "band_leader" | "band_member" | "booking_manager" | "artist" | "tour_manager" | "super_admin" | null} 
                  onRoleChange={() => {
                    // Refresh the page to update role-specific features
                    window.location.reload();
                  }} 
                />
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">About Roles:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li><strong>Band Leader:</strong> Create and manage bands, schedule gigs and rehearsals</li>
                    <li><strong>Band Member:</strong> Respond to gig invites, view schedules, share availability</li>
                    <li><strong>Booking Manager:</strong> Discover and manage multiple bands and artists</li>
                    <li><strong>Tour Manager:</strong> Coordinate tours and manage crew members</li>
                    <li><strong>Artist/Musician:</strong> Build your portfolio and get discovered</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          
            <form onSubmit={handleSubmit}>
              <TabsContent value="profile" className="mt-0 space-y-6">
            <div className="space-y-2">
              <div className="flex items-start gap-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative group cursor-pointer" onClick={() => !processingPhoto && document.getElementById('main-photo')?.click()}>
                    {processingPhoto === 0 ? (
                      <div className="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center bg-muted/10">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : photoPreviews[0] ? (
                      <>
                        <img 
                          src={photoPreviews[0]} 
                          alt="Main profile" 
                          className="w-20 h-20 rounded-full object-cover border-2 border-primary"
                        />
                        <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-medium">Change</span>
                        </div>
                      </>
                    ) : (
                      <div className="w-20 h-20 rounded-full border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/10">
                        <span className="text-muted-foreground text-xs">Upload</span>
                      </div>
                    )}
                  </div>
                  <div className="text-center space-y-1 w-full">
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="text-center"
                    />
                    {(role === "band_member" || role === "band_leader") && (
                      <Input
                        id="band_name"
                        type="text"
                        placeholder="Band name (e.g. The Headliners)"
                        value={bandName}
                        onChange={(e) => setBandName(e.target.value)}
                        className="text-center"
                      />
                    )}
                    <Select value={performerCategory} onValueChange={setPerformerCategory}>
                      <SelectTrigger className="text-center">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Solo">Solo</SelectItem>
                        <SelectItem value="Duo">Duo</SelectItem>
                        <SelectItem value="Band">Band</SelectItem>
                      </SelectContent>
                    </Select>
                    {memberSince && (
                      <span className="text-xs text-muted-foreground">
                        Member since {memberSince}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <Input
                    id="main-photo"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={(e) => handlePhotoChange(e, 0)}
                    className={photoPreviews[0] ? "hidden" : ""}
                    disabled={processingPhoto !== null}
                  />
                  {!photoPreviews[0] && processingPhoto !== 0 && (
                    <span className="text-sm text-muted-foreground">AI will auto-center your face</span>
                  )}
                  {processingPhoto === 0 && (
                    <span className="text-sm text-muted-foreground">Processing with AI...</span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Additional Photos (Optional, 3 max)</Label>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((index) => (
                  <div key={index} className="space-y-2">
                    <div 
                      className="relative group cursor-pointer"
                      onClick={() => !processingPhoto && document.getElementById(`photo-${index}`)?.click()}
                    >
                      {processingPhoto === index ? (
                        <div className="w-full h-32 rounded-lg border-2 border-primary flex items-center justify-center bg-muted/10">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : photoPreviews[index] ? (
                        <>
                          <img 
                            src={photoPreviews[index]} 
                            alt={`Additional photo ${index}`} 
                            className="w-full h-32 rounded-lg object-cover border-2 border-primary"
                          />
                          <div className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs font-medium">Change</span>
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePhoto(index);
                            }}
                          >
                            ✕
                          </Button>
                        </>
                      ) : (
                        <div className="w-full h-32 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/10">
                          <span className="text-muted-foreground text-sm">Photo {index}</span>
                        </div>
                      )}
                    </div>
                    <Input
                      id={`photo-${index}`}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={(e) => handlePhotoChange(e, index)}
                      className={photoPreviews[index] ? "hidden" : "text-sm"}
                      disabled={processingPhoto !== null}
                    />
                  </div>
                ))}
              </div>
            </div>


            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bio">Bio</Label>
                <span className="text-sm text-muted-foreground">
                  {bio.length}/350
                </span>
              </div>
              <Textarea
                id="bio"
                placeholder={
                  role === "band_leader"
                    ? "Tell us about your band, music style, experience, and what makes you unique..."
                    : role === "band_member"
                    ? "Tell us about your music style, experience, and what makes you unique..."
                    : "Tell us about your experience managing bands and artists..."
                }
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={350}
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number (for SMS reminders)</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="e.g., +1234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +1 for US). You'll receive text reminders 1 day and 1 hour before gigs/rehearsals.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timezone
              </Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {/* US Timezones */}
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Phoenix">Arizona (MST - No DST)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                  <SelectItem value="Pacific/Honolulu">Hawaii (HST)</SelectItem>
                  {/* International */}
                  <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                  <SelectItem value="Europe/Paris">Paris (CET/CEST)</SelectItem>
                  <SelectItem value="Europe/Berlin">Berlin (CET/CEST)</SelectItem>
                  <SelectItem value="Europe/Amsterdam">Amsterdam (CET/CEST)</SelectItem>
                  <SelectItem value="Europe/Rome">Rome (CET/CEST)</SelectItem>
                  <SelectItem value="Europe/Madrid">Madrid (CET/CEST)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                  <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                  <SelectItem value="Asia/Singapore">Singapore (SGT)</SelectItem>
                  <SelectItem value="Asia/Dubai">Dubai (GST)</SelectItem>
                  <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                  <SelectItem value="Australia/Sydney">Sydney (AEST/AEDT)</SelectItem>
                  <SelectItem value="Australia/Melbourne">Melbourne (AEST/AEDT)</SelectItem>
                  <SelectItem value="Australia/Perth">Perth (AWST)</SelectItem>
                  <SelectItem value="Pacific/Auckland">Auckland (NZST/NZDT)</SelectItem>
                  <SelectItem value="America/Toronto">Toronto (ET)</SelectItem>
                  <SelectItem value="America/Vancouver">Vancouver (PT)</SelectItem>
                  <SelectItem value="America/Mexico_City">Mexico City (CST)</SelectItem>
                  <SelectItem value="America/Sao_Paulo">São Paulo (BRT)</SelectItem>
                  <SelectItem value="America/Buenos_Aires">Buenos Aires (ART)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                All dates, times, and email notifications will use your selected timezone.
              </p>
            </div>
            
            {(role === "band_leader" || role === "band_member") && (
              <div className="space-y-2">
                <Label htmlFor="instrument">Primary Instrument</Label>
                <Select value={instrument} onValueChange={setInstrument} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your instrument" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guitar">Guitar</SelectItem>
                    <SelectItem value="bass">Bass</SelectItem>
                    <SelectItem value="drums">Drums</SelectItem>
                    <SelectItem value="vocals">Vocals</SelectItem>
                    <SelectItem value="keyboard">Keyboard</SelectItem>
                    <SelectItem value="saxophone">Saxophone</SelectItem>
                    <SelectItem value="trumpet">Trumpet</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Social Media Links */}
            {(role === "band_leader" || role === "band_member" || role === "artist") && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Social Media Links
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add your social media profiles to help venues and fans find you
                  </p>
                </div>
                <div className="grid gap-3">
                  {socialPlatforms.map((platform) => {
                    const Icon = platform.icon;
                    return (
                      <div key={platform.key} className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                          placeholder={platform.placeholder}
                          value={socialLinks[platform.key] || ""}
                          onChange={(e) => handleSocialLinkChange(platform.key, e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* YouTube Links */}
            {(role === "band_leader" || role === "band_member" || role === "artist") && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label className="flex items-center gap-2">
                    <Youtube className="h-4 w-4 text-red-500" />
                    YouTube Videos
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Showcase your performances with YouTube links
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="https://youtube.com/watch?v=..."
                    value={newYoutubeLink}
                    onChange={(e) => setNewYoutubeLink(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addYoutubeLink())}
                  />
                  <Button type="button" onClick={addYoutubeLink} size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {youtubeLinks.length > 0 && (
                  <div className="space-y-3">
                    {youtubeLinks.map((link, index) => {
                      const thumbnail = getYoutubeThumbnail(link);
                      const videoId = getYoutubeVideoId(link);
                      const isPlaying = playingVideoId === videoId;
                      
                      return (
                        <div
                          key={index}
                          className="border rounded-lg bg-muted/50 overflow-hidden"
                        >
                          {isPlaying && videoId ? (
                            <div className="p-2">
                              <div className="flex justify-end mb-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setPlayingVideoId(null)}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Close
                                </Button>
                              </div>
                              <YouTubePlayer videoId={videoId} title="Video" inline />
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 p-2">
                              {thumbnail ? (
                                <button 
                                  type="button"
                                  onClick={() => videoId && setPlayingVideoId(videoId)}
                                  className="shrink-0 relative group cursor-pointer"
                                >
                                  <img 
                                    src={thumbnail} 
                                    alt="Video thumbnail" 
                                    className="w-24 h-14 object-cover rounded-md"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                                    <Play className="h-6 w-6 text-white" />
                                  </div>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => videoId && setPlayingVideoId(videoId)}
                                  className="w-24 h-14 bg-muted rounded-md flex items-center justify-center shrink-0 cursor-pointer"
                                >
                                  <Youtube className="h-6 w-6 text-red-500" />
                                </button>
                              )}
                              <span className="flex-1 text-sm truncate">{link}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeYoutubeLink(index)}
                                className="shrink-0 h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Equipment List */}
            {(role === "band_leader" || role === "band_member" || role === "artist") && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Equipment & Gear
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    List your instruments, amps, mics, and other equipment
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Fender Stratocaster, Roland JC-120..."
                    value={newEquipment}
                    onChange={(e) => setNewEquipment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEquipment())}
                  />
                  <Button type="button" onClick={addEquipment} size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {equipment.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {equipment.map((item, index) => (
                      <Badge key={index} variant="secondary" className="gap-1 pr-1">
                        {item}
                        <button
                          type="button"
                          onClick={() => removeEquipment(index)}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Skills & Abilities */}
            {(role === "band_leader" || role === "band_member" || role === "artist") && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Skills & Abilities
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add skills like sight-reading, improvisation, composition
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Sight-reading, Improvisation, Arranging..."
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                  />
                  <Button type="button" onClick={addSkill} size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((item, index) => (
                      <Badge key={index} variant="outline" className="gap-1 pr-1">
                        {item}
                        <button
                          type="button"
                          onClick={() => removeSkill(index)}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Genres */}
            {(role === "band_leader" || role === "band_member" || role === "artist") && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label className="flex items-center gap-2">
                    <Music className="h-4 w-4" />
                    Genres
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Musical genres you specialize in
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Jazz, Blues, R&B, Rock..."
                    value={newGenre}
                    onChange={(e) => setNewGenre(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGenre())}
                  />
                  <Button type="button" onClick={addGenre} size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {genres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {genres.map((item, index) => (
                      <Badge key={index} className="gap-1 pr-1 bg-primary/10 text-primary hover:bg-primary/20">
                        {item}
                        <button
                          type="button"
                          onClick={() => removeGenre(index)}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    </div>
                  )}
                </div>
              )}
              </TabsContent>

              {/* Alerts Tab */}
              <TabsContent value="alerts" className="mt-0 space-y-6">
                <NotificationPreferences />
              </TabsContent>

              {/* Safety Tab */}
              <TabsContent value="safety" className="mt-0 space-y-6">
                <SafetyManager />
              </TabsContent>

              {/* Availability Tab */}
              <TabsContent value="availability" className="mt-0 space-y-6">
            {(role === "band_leader" || role === "band_member" || role === "artist") && (
              <div className="space-y-4 pt-4 border-t">
                <Label className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Professional Details
                </Label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="yearsExperience" className="text-xs">Years of Experience</Label>
                    <Input
                      id="yearsExperience"
                      type="number"
                      min="0"
                      placeholder="e.g., 10"
                      value={yearsExperience}
                      onChange={(e) => setYearsExperience(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="travelDistance" className="text-xs">Max Travel (miles)</Label>
                    <Input
                      id="travelDistance"
                      type="number"
                      min="0"
                      placeholder="e.g., 100"
                      value={travelDistance}
                      onChange={(e) => setTravelDistance(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="preferredPay" className="text-xs">Preferred Pay ($)</Label>
                    <Input
                      id="preferredPay"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g., 400"
                      value={preferredPay}
                      onChange={(e) => setPreferredPay(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferredPayHours" className="text-xs">For How Many Hours</Label>
                    <Input
                      id="preferredPayHours"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="e.g., 3"
                      value={preferredPayHours}
                      onChange={(e) => setPreferredPayHours(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Today's Availability Status</Label>
                    <button
                      type="button"
                      onClick={toggleSoundEffects}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                        soundEffectsEnabled 
                          ? 'bg-primary/10 text-primary hover:bg-primary/20' 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      title={soundEffectsEnabled ? 'Sound effects on' : 'Sound effects off'}
                    >
                      {soundEffectsEnabled ? (
                        <Volume2 className="h-3 w-3" />
                      ) : (
                        <VolumeX className="h-3 w-3" />
                      )}
                      <span className="hidden sm:inline">{soundEffectsEnabled ? 'Sound On' : 'Sound Off'}</span>
                    </button>
                  </div>
                  
                  {/* Save confirmation animation */}
                  {showSaveConfirmation && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div className="relative">
                        {/* Sparkles */}
                        <div className="absolute -top-2 -left-2 w-2 h-2 bg-yellow-400 rounded-full animate-ping" style={{ animationDuration: '0.5s' }} />
                        <div className="absolute -top-1 -right-3 w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" style={{ animationDuration: '0.6s', animationDelay: '0.1s' }} />
                        <div className="absolute -bottom-1 -left-3 w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" style={{ animationDuration: '0.5s', animationDelay: '0.2s' }} />
                        <div className="absolute -bottom-2 -right-2 w-2 h-2 bg-purple-400 rounded-full animate-ping" style={{ animationDuration: '0.6s' }} />
                        <div className="absolute top-1 right-3 w-1 h-1 bg-pink-400 rounded-full animate-ping" style={{ animationDuration: '0.4s', animationDelay: '0.15s' }} />
                        <div className="absolute bottom-1 left-3 w-1 h-1 bg-cyan-400 rounded-full animate-ping" style={{ animationDuration: '0.45s', animationDelay: '0.1s' }} />
                        
                        {/* Main checkmark */}
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50 animate-scale-in">
                          <Check className="h-7 w-7 text-white" strokeWidth={3} />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className={`flex items-center gap-3 p-3 rounded-lg bg-muted/50 border transition-opacity ${showSaveConfirmation ? 'opacity-30' : ''}`}>
                    <div className="flex items-center gap-2">
                      {todayCalendarStatus === 'available' ? (
                        <>
                          <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-sm font-medium text-green-600">Available</span>
                        </>
                      ) : todayCalendarStatus === 'unavailable' ? (
                        <>
                          <span className="w-3 h-3 rounded-full bg-red-500" />
                          <span className="text-sm font-medium text-red-600">Unavailable</span>
                        </>
                      ) : todayCalendarStatus === 'tentative' ? (
                        <>
                          <span className="w-3 h-3 rounded-full bg-yellow-500" />
                          <span className="text-sm font-medium text-yellow-600">Tentative</span>
                        </>
                      ) : (
                        <>
                          <span className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                          <span className="text-sm text-muted-foreground">Not set</span>
                        </>
                      )}
                    </div>
                    
                    {/* 7-day preview bar with drag/touch support */}
                    <div 
                      className="flex items-center gap-1 ml-auto select-none touch-none"
                      onMouseLeave={handleDragEnd}
                      onMouseUp={handleDragEnd}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <span className="text-xs text-muted-foreground mr-1">Next 7 days:</span>
                      {weekAvailability.map((day, idx) => {
                        const dayLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
                        const dayNum = new Date(day.date + 'T00:00:00').getDate();
                        const inDragRange = isInDragRange(idx);
                        const isPulsing = pulsingIndex === idx;
                        return (
                          <button 
                            key={day.date}
                            ref={(el) => { dayButtonRefs.current[idx] = el; }}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleDragStart(idx);
                            }}
                            onMouseEnter={() => handleDragEnter(idx)}
                            onMouseUp={handleDragEnd}
                            onTouchStart={(e) => handleTouchStart(idx, e)}
                            onClick={() => !isDragging && setDateAvailability(day.date, selectedQuickStatus)}
                            className={`flex flex-col items-center cursor-pointer transition-transform touch-none ${
                              isPulsing ? 'scale-125' : 'hover:scale-110'
                            }`}
                            title={`Click or drag to set ${selectedQuickStatus}`}
                          >
                            <span className="text-[10px] text-muted-foreground">{dayLabel}</span>
                            <div 
                              className={`w-6 h-6 sm:w-5 sm:h-5 rounded-sm flex items-center justify-center text-[10px] sm:text-[9px] font-medium text-white transition-all duration-150 ${
                                isPulsing ? 'scale-110 shadow-lg' : ''
                              } ${
                                inDragRange
                                  ? selectedQuickStatus === 'available'
                                    ? 'bg-green-500 ring-2 ring-green-300 shadow-green-500/50'
                                    : selectedQuickStatus === 'unavailable'
                                      ? 'bg-red-500 ring-2 ring-red-300 shadow-red-500/50'
                                      : 'bg-yellow-500 ring-2 ring-yellow-300 shadow-yellow-500/50'
                                  : day.status === 'available' 
                                    ? 'bg-green-500' 
                                    : day.status === 'unavailable' 
                                      ? 'bg-red-500' 
                                      : day.status === 'tentative' 
                                        ? 'bg-yellow-500' 
                                        : 'bg-muted-foreground/20 text-muted-foreground'
                              } ${idx === 0 && !inDragRange ? 'ring-2 ring-primary ring-offset-1' : ''} ${!inDragRange ? 'hover:ring-2 hover:ring-offset-1 hover:ring-muted-foreground' : ''}`}
                            >
                              {dayNum}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Status selector for quick-set */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Click days to set:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedQuickStatus('available')}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                          selectedQuickStatus === 'available'
                            ? 'bg-green-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                        Available
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedQuickStatus('tentative')}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                          selectedQuickStatus === 'tentative'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        <HelpCircle className="h-3 w-3" />
                        Tentative
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedQuickStatus('unavailable')}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                          selectedQuickStatus === 'unavailable'
                            ? 'bg-red-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        <X className="h-3 w-3" />
                        Unavailable
                      </button>
                    </div>
                  </div>
                  
                  {/* Bulk action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Bulk:</span>
                    <button
                      type="button"
                      onClick={() => setAllWeekAvailability('available')}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors border border-green-500/30"
                    >
                      <Check className="h-3 w-3" />
                      All Available
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllWeekAvailability('unavailable')}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors border border-red-500/30"
                    >
                      <X className="h-3 w-3" />
                      All Unavailable
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllWeekAvailability('tentative')}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 transition-colors border border-yellow-500/30"
                    >
                      <HelpCircle className="h-3 w-3" />
                      All Tentative
                    </button>
                    <div className="w-px h-4 bg-border" />
                    <button
                      type="button"
                      onClick={clearAllWeekAvailability}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors border border-border"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear All
                    </button>
                    
                    {/* Undo button - appears after clearing */}
                    {showUndo && (
                      <button
                        type="button"
                        onClick={undoClearAvailability}
                        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all animate-fade-in shadow-md"
                      >
                        <Undo2 className="h-3 w-3" />
                        Undo
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary-foreground/20 text-[10px] font-bold">
                          {undoCountdown}
                        </span>
                      </button>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Click or drag across days to set availability. Use the calendar below for more options.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Union Memberships</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., AFM Local 47, SAG-AFTRA..."
                      value={newUnion}
                      onChange={(e) => setNewUnion(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUnion())}
                    />
                    <Button type="button" onClick={addUnion} size="icon" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {unionMemberships.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {unionMemberships.map((item, index) => (
                        <Badge key={index} variant="secondary" className="gap-1 pr-1">
                          {item}
                          <button
                            type="button"
                            onClick={() => removeUnion(index)}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Availability Calendar */}
            <div className="pt-4">
              <AvailabilityCalendar onTodayStatusChange={setTodayCalendarStatus} />
            </div>
              </TabsContent>

              {/* Terms Tab */}
              <TabsContent value="terms" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="flex items-center gap-2 text-lg font-semibold">
                      <FileText className="h-5 w-5" />
                      {role === "band_leader" || role === "band_member" ? "Rider Requirements" : "Management Notes"}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your technical and hospitality requirements for gigs
                    </p>
                  </div>
                  
                  {(role === "band_leader" || role === "band_member") && riderNotes && (
                    <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" type="button" className="w-full sm:w-auto">
                          <Mail className="h-4 w-4 mr-2" />
                          Send Rider to Venue
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Send Rider Requirements</DialogTitle>
                          <DialogDescription>
                            Send your rider requirements to a venue or booking manager
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label htmlFor="recipientName2">Recipient Name (Optional)</Label>
                            <Input
                              id="recipientName2"
                              placeholder="e.g., John Smith"
                              value={recipientName}
                              onChange={(e) => setRecipientName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="recipientEmail2">Recipient Email *</Label>
                            <Input
                              id="recipientEmail2"
                              type="email"
                              placeholder="e.g., venue@example.com"
                              value={recipientEmail}
                              onChange={(e) => setRecipientEmail(e.target.value)}
                              required
                            />
                          </div>
                          <Button 
                            onClick={handleSendRider} 
                            disabled={sendingEmail || !recipientEmail.trim()}
                            className="w-full"
                          >
                            {sendingEmail ? "Sending..." : "Send Rider Requirements"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  
                  <Textarea
                    id="rider2"
                    placeholder={
                      role === "band_leader" || role === "band_member"
                        ? "Stage setup, sound requirements, green room needs, etc.\nExample: Needs quiet green room, 3 vocal mics, drum riser"
                        : "Your approach to management, availability, preferred genres..."
                    }
                    value={riderNotes}
                    onChange={(e) => setRiderNotes(e.target.value)}
                    rows={8}
                  />
                  
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Tips for a good rider:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>List your technical requirements (mics, monitors, amps)</li>
                      <li>Include stage plot or setup needs</li>
                      <li>Mention any hospitality requests (food, drinks, green room)</li>
                      <li>Note any special accessibility requirements</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
              
              <Button type="submit" className="w-full mt-6" disabled={loading}>
                {loading ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSetup;
