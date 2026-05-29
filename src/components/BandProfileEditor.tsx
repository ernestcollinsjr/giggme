import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Youtube, Facebook, Instagram, Twitter, Globe, Music, Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Json } from "@/integrations/supabase/types";

interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  website?: string;
  spotify?: string;
  tiktok?: string;
}

interface BandProfileEditorProps {
  bandId: string;
  bandName: string;
}

export const BandProfileEditor = ({ bandId, bandName }: BandProfileEditorProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [youtubeLinks, setYoutubeLinks] = useState<string[]>([]);
  const [newYoutubeLink, setNewYoutubeLink] = useState("");

  useEffect(() => {
    if (dialogOpen) {
      fetchBandProfile();
    }
  }, [bandId, dialogOpen]);

  const fetchBandProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("social_links, youtube_links")
        .eq("id", bandId)
        .single();

      if (error) throw error;

      setSocialLinks((data?.social_links as SocialLinks) || {});
      setYoutubeLinks(data?.youtube_links || []);
    } catch (error: any) {
      console.error("Error fetching group profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("groups")
        .update({
          social_links: socialLinks as Json,
          youtube_links: youtubeLinks,
        })
        .eq("id", bandId);

      if (error) throw error;

      toast({
        title: "Group profile updated!",
        description: "Your social media and YouTube links have been saved.",
      });
      setDialogOpen(false);
    } catch (error: any) {
      console.error("Error saving group profile:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save group profile.",
      });
    } finally {
      setSaving(false);
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
    
    // Basic YouTube URL validation
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
    { key: "facebook" as keyof SocialLinks, label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/yourband" },
    { key: "instagram" as keyof SocialLinks, label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/yourband" },
    { key: "twitter" as keyof SocialLinks, label: "X (Twitter)", icon: Twitter, placeholder: "https://x.com/yourband" },
    { key: "website" as keyof SocialLinks, label: "Website", icon: Globe, placeholder: "https://yourband.com" },
    { key: "spotify" as keyof SocialLinks, label: "Spotify", icon: Music, placeholder: "https://open.spotify.com/artist/..." },
    { key: "tiktok" as keyof SocialLinks, label: "TikTok", icon: Globe, placeholder: "https://tiktok.com/@yourband" },
  ];

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          Edit Group Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Band Profile - {bandName}</DialogTitle>
          <DialogDescription>
            Add social media links and YouTube videos to showcase your group
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Social Media Links */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Social Media Links
              </h3>
              <div className="grid gap-4">
                {socialPlatforms.map((platform) => {
                  const Icon = platform.icon;
                  return (
                    <div key={platform.key} className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <Input
                          placeholder={platform.placeholder}
                          value={socialLinks[platform.key] || ""}
                          onChange={(e) => handleSocialLinkChange(platform.key, e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* YouTube Links */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-500" />
                YouTube Videos
              </h3>
              <p className="text-sm text-muted-foreground">
                Add YouTube links to showcase your performances
              </p>
              
              <div className="flex gap-2">
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  value={newYoutubeLink}
                  onChange={(e) => setNewYoutubeLink(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addYoutubeLink())}
                />
                <Button type="button" onClick={addYoutubeLink} size="icon">
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

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
