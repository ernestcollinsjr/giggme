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

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("");
  
  const [bio, setBio] = useState("");
  const [instrument, setInstrument] = useState("");
  const [riderNotes, setRiderNotes] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          setRole(profile.role);
          setBio(profile.bio || "");
          setInstrument(profile.instrument || "");
          setRiderNotes(profile.rider_notes || "");
        }
      }
    };
    
    getUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) throw new Error("No user found");

      const updates = {
        id: user.id,
        bio,
        instrument: (role === "band" ? instrument : null) as any,
        rider_notes: riderNotes,
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/10">
      <Card className="w-full max-w-2xl border-border/50 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            {role === "band" 
              ? "Add your musical details to help managers find you" 
              : "Add your details to start connecting with bands"}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder={role === "band" 
                  ? "Tell us about your music style, experience, and what makes you unique..." 
                  : "Tell us about your experience managing bands and artists..."}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                required
              />
            </div>
            
            {role === "band" && (
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
                {role === "band" ? "Rider Requirements" : "Management Notes"}
              </Label>
              <Textarea
                id="rider"
                placeholder={role === "band"
                  ? "Stage setup, sound requirements, green room needs, etc.\nExample: Needs quiet green room, 3 vocal mics, drum riser"
                  : "Your approach to management, availability, preferred genres..."}
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
