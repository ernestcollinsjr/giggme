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
import { LogOut, Crown, Music, Briefcase } from "lucide-react";

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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>("");

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
          setPhotoUrl(profile.photo_url || "");
          setPhotoPreview(profile.photo_url || "");
        }
        
        if (roleData) {
          setRole(roleData.role);
          setHasRole(true);
        }
      }
    };
    
    getUser();
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile || !user) return photoUrl;

    try {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, photoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Photo upload failed",
        description: error.message,
      });
      return null;
    }
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

      const uploadedPhotoUrl = await uploadPhoto();

      const updates = {
        id: user.id,
        bio,
        instrument: (role === "band_leader" || role === "band_member" ? instrument : null) as any,
        rider_notes: riderNotes,
        photo_url: uploadedPhotoUrl || photoUrl,
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
              <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
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
              <Label htmlFor="photo">Profile Photo</Label>
              <div className="flex items-center gap-4">
                {photoPreview && (
                  <img 
                    src={photoPreview} 
                    alt="Profile preview" 
                    className="w-20 h-20 rounded-full object-cover border-2 border-primary"
                  />
                )}
                <Input
                  id="photo"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
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
              <Label htmlFor="rider">
                {role === "band_leader" || role === "band_member" ? "Rider Requirements" : "Management Notes"}
              </Label>
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
    </div>
  );
};

export default ProfileSetup;
