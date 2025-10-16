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
import { LogOut, Crown, Music, Briefcase, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("");
  const [hasRole, setHasRole] = useState(false);
  
  const [bio, setBio] = useState("");
  const [instrument, setInstrument] = useState("");
  const [riderNotes, setRiderNotes] = useState("");
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>(["", "", "", ""]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  
  // Image positioning state
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [currentEditIndex, setCurrentEditIndex] = useState<number | null>(null);
  const [tempImageSrc, setTempImageSrc] = useState("");
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
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
          setBio(profile.bio || "");
          setInstrument(profile.instrument || "");
          setRiderNotes(profile.rider_notes || "");
          const urls = profile.photo_urls || [];
          setPhotoUrls(urls);
          setPhotoPreviews(urls.length > 0 ? [...urls, "", "", "", ""].slice(0, 4) : ["", "", "", ""]);
        }
        
        if (roleData) {
          setRole(roleData.role);
          setHasRole(true);
        }
      }
    };
    
    getUser();
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imgSrc = reader.result as string;
        setTempImageSrc(imgSrc);
        setCurrentEditIndex(index);
        
        // Load image to calculate centered position
        const img = new Image();
        img.onload = () => {
          const containerWidth = 768; // max-w-3xl container
          const containerHeight = 384; // h-96
          
          // Calculate scale to fit image nicely in container
          const scaleToFitWidth = containerWidth / img.width;
          const scaleToFitHeight = containerHeight / img.height;
          const initialScale = Math.min(scaleToFitWidth, scaleToFitHeight, 1.2); // Max 1.2x zoom
          
          // Calculate centered position
          const scaledWidth = img.width * initialScale;
          const scaledHeight = img.height * initialScale;
          const centerX = (containerWidth - scaledWidth) / 2;
          const centerY = (containerHeight - scaledHeight) / 2;
          
          setImageScale(initialScale);
          setImagePosition({ x: centerX, y: centerY });
          setShowPositionModal(true);
        };
        img.src = imgSrc;
      };
      reader.readAsDataURL(file);
      
      const newFiles = [...photoFiles];
      newFiles[index] = file;
      setPhotoFiles(newFiles);
    }
  };

  const handleSavePosition = () => {
    if (currentEditIndex === null || !tempImageSrc) return;
    
    // Create a canvas to crop the positioned image
    const canvas = document.createElement('canvas');
    const size = currentEditIndex === 0 ? 400 : 800; // Smaller for profile, larger for additional
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      const img = new Image();
      img.onload = () => {
        // Clear canvas
        ctx.clearRect(0, 0, size, size);
        
        // Calculate dimensions
        const scaledWidth = img.width * imageScale;
        const scaledHeight = img.height * imageScale;
        
        // Draw the image with current position and scale
        ctx.drawImage(
          img,
          imagePosition.x,
          imagePosition.y,
          scaledWidth,
          scaledHeight
        );
        
        // Convert canvas to blob and update preview
        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const newPreviews = [...photoPreviews];
              newPreviews[currentEditIndex] = reader.result as string;
              setPhotoPreviews(newPreviews);
            };
            reader.readAsDataURL(blob);
            
            // Update the file
            const newFiles = [...photoFiles];
            newFiles[currentEditIndex] = new File([blob], `photo-${currentEditIndex}.jpg`, { type: 'image/jpeg' });
            setPhotoFiles(newFiles);
          }
        }, 'image/jpeg', 0.95);
      };
      img.src = tempImageSrc;
    }
    
    setShowPositionModal(false);
    setCurrentEditIndex(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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
        bio,
        instrument: (role === "band_leader" || role === "band_member" ? instrument : null) as any,
        rider_notes: riderNotes,
        photo_urls: uploadedPhotoUrls,
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

  // Show role selection if user hasn't selected a role yet
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
              <div className="flex items-center gap-4">
                <div className="relative group cursor-pointer" onClick={() => document.getElementById('main-photo')?.click()}>
                  {photoPreviews[0] ? (
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
                <Input
                  id="main-photo"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(e) => handlePhotoChange(e, 0)}
                  className={photoPreviews[0] ? "hidden" : "flex-1"}
                />
                {!photoPreviews[0] && (
                  <span className="text-sm text-muted-foreground">Click the circle or choose a file</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Additional Photos (Optional, 3 max)</Label>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((index) => (
                  <div key={index} className="space-y-2">
                    <div 
                      className="relative group cursor-pointer"
                      onClick={() => document.getElementById(`photo-${index}`)?.click()}
                    >
                      {photoPreviews[index] ? (
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
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Image Positioning Modal */}
      <Dialog open={showPositionModal} onOpenChange={setShowPositionModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Position Your Photo</DialogTitle>
            <DialogDescription>
              Drag to position and use the slider to zoom
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div 
              className="relative w-full h-96 bg-muted rounded-lg overflow-hidden cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {tempImageSrc && (
                <img
                  src={tempImageSrc}
                  alt="Position preview"
                  className="absolute select-none"
                  draggable={false}
                  style={{
                    transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
                    transformOrigin: 'top left',
                  }}
                />
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Zoom: {Math.round(imageScale * 100)}%</Label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={imageScale}
                onChange={(e) => setImageScale(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowPositionModal(false)}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleSavePosition}
              >
                Save Position
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileSetup;
