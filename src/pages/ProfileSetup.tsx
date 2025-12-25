import { useState, useEffect } from "react";
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
import { LogOut, Crown, Music, Briefcase, Mail, Loader2, Youtube, Facebook, Instagram, Twitter, Globe, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { detectFaceAndCrop, loadImage } from "@/utils/imageCropping";
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
  
  // Email sending state
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        // Fetch profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        
        // Fetch role from user_roles table
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        
        if (profile) {
          setName(profile.name || "");
          setBio(profile.bio || "");
          setInstrument(profile.instrument || "");
          setPhoneNumber(profile.phone_number || "");
          setEmail(profile.email || "");
          setRiderNotes(profile.rider_notes || "");
          setTimezone(profile.timezone || "America/Chicago");
          const urls = profile.photo_urls || [];
          setPhotoUrls(urls);
          setPhotoPreviews(urls.length > 0 ? [...urls, "", "", "", ""].slice(0, 4) : ["", "", "", ""]);
          
          // Load social links and youtube links
          setSocialLinks((profile.social_links as SocialLinks) || {});
          setYoutubeLinks(profile.youtube_links || []);
          
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
      }
    };
    
    getUser();
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

      const updates = {
        id: user.id,
        name,
        bio,
        email,
        instrument: (role === "band_leader" || role === "band_member" ? instrument : null) as any,
        phone_number: phoneNumber || null,
        rider_notes: riderNotes,
        timezone,
        photo_urls: uploadedPhotoUrls,
        social_links: socialLinks as Json,
        youtube_links: youtubeLinks,
        updated_at: new Date().toISOString(),
      };

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

  const socialPlatforms = [
    { key: "facebook" as keyof SocialLinks, label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/yourprofile" },
    { key: "instagram" as keyof SocialLinks, label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/yourprofile" },
    { key: "twitter" as keyof SocialLinks, label: "X (Twitter)", icon: Twitter, placeholder: "https://x.com/yourprofile" },
    { key: "website" as keyof SocialLinks, label: "Website", icon: Globe, placeholder: "https://yourwebsite.com" },
    { key: "spotify" as keyof SocialLinks, label: "Spotify", icon: Music, placeholder: "https://open.spotify.com/artist/..." },
    { key: "tiktok" as keyof SocialLinks, label: "TikTok", icon: Globe, placeholder: "https://tiktok.com/@yourprofile" },
  ];

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
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">Edit Profile</CardTitle>
              <CardDescription>
                {role === "band_leader"
                  ? "Add your band details to help booking managers find you"
                  : role === "band_member"
                  ? "Add your musical details to help managers find you"
                  : "Add your details to start connecting with bands"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Phoenix">Arizona Time (MST - No DST)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                  <SelectItem value="Pacific/Honolulu">Hawaii Time (HST)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                All dates and times will be displayed in your selected timezone.
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
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="rider">
                  {role === "band_leader" || role === "band_member" ? "Rider Requirements" : "Management Notes"}
                </Label>
                {(role === "band_leader" || role === "band_member") && riderNotes && (
                  <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" type="button">
                        <Mail className="h-4 w-4 mr-2" />
                        Send Rider
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
                          <Label htmlFor="recipientName">Recipient Name (Optional)</Label>
                          <Input
                            id="recipientName"
                            placeholder="e.g., John Smith"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="recipientEmail">Recipient Email *</Label>
                          <Input
                            id="recipientEmail"
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
              </div>
              <Textarea
                id="rider"
                placeholder={
                  role === "band_leader" || role === "band_member"
                    ? "Stage setup, sound requirements, green room needs, etc.\nExample: Needs quiet green room, 3 vocal mics, drum riser"
                    : "Your approach to management, availability, preferred genres..."
                }
                value={riderNotes}
                onChange={(e) => setRiderNotes(e.target.value)}
                rows={4}
              />
            </div>

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
                  <div className="space-y-2">
                    {youtubeLinks.map((link, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50"
                      >
                        <Youtube className="h-4 w-4 text-red-500 shrink-0" />
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
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSetup;
