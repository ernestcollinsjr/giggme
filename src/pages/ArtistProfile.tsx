import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Plus, Trash2, Youtube, ArrowLeft, Loader2 } from "lucide-react";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { TopNav } from "@/components/TopNav";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { detectFaceAndCrop, loadImage } from "@/utils/imageCropping";

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
}

interface Profile {
  name: string;
  bio: string | null;
  photo_urls: string[];
}

const ArtistProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch basic profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch artist profile
      const { data: artistData, error: artistError } = await supabase
        .from("artist_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (artistError && artistError.code !== "PGRST116") throw artistError;

      if (artistData) {
        setArtistProfile({
          ...artistData,
          youtube_videos: (artistData.youtube_videos as any) || [],
          social_links: (artistData.social_links as any) || {},
        });
      } else {
        // Create initial artist profile
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
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
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
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Artist/Musician Profile
        </h1>

        <div className="space-y-6">
          {/* Profile Photo Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Photos</CardTitle>
              <CardDescription>
                Upload up to {MAX_PHOTOS} professional photos ({profile?.photo_urls?.length || 0}/{MAX_PHOTOS})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo Grid */}
              <div className="grid grid-cols-4 gap-4">
                {profile?.photo_urls?.map((url, index) => (
                  <div key={index} className="relative group">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={url} className="object-cover" />
                      <AvatarFallback>{index + 1}</AvatarFallback>
                    </Avatar>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemovePhoto(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                
                {/* Upload Button */}
                {(profile?.photo_urls?.length || 0) < MAX_PHOTOS && (
                  <Label htmlFor="photo-upload" className={uploadingPhoto ? "cursor-wait" : "cursor-pointer"}>
                    <div className={`h-20 w-20 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${
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
                />
              </div>

              <div>
                <Label htmlFor="stage-name">Stage Name</Label>
                <Input
                  id="stage-name"
                  value={artistProfile?.stage_name || ""}
                  onChange={(e) => setArtistProfile({ ...artistProfile!, stage_name: e.target.value })}
                  placeholder="Your stage name"
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
                  />
                </div>

                <div>
                  <Label htmlFor="experience">Years of Experience</Label>
                  <Input
                    id="experience"
                    type="number"
                    value={artistProfile?.years_experience || ""}
                    onChange={(e) => setArtistProfile({ ...artistProfile!, years_experience: parseInt(e.target.value) })}
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
                  />
                </div>

                <div>
                  <Label htmlFor="rate">Rate Range</Label>
                  <Input
                    id="rate"
                    value={artistProfile?.rate_range || ""}
                    onChange={(e) => setArtistProfile({ ...artistProfile!, rate_range: e.target.value })}
                    placeholder="$100-$500 per gig"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* YouTube Videos */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Videos</CardTitle>
              <CardDescription>Add YouTube links to your best performances</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="space-y-4">
                {artistProfile?.youtube_videos?.map((video, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                    <Youtube className="h-6 w-6 text-red-500" />
                    <div className="flex-1">
                      <p className="font-medium">{video.title}</p>
                      <p className="text-sm text-muted-foreground">{video.url}</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleRemoveVideo(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {(!artistProfile?.youtube_videos || artistProfile.youtube_videos.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">No videos added yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Availability Calendar */}
          <AvailabilityCalendar />

          {/* Save Button */}
          <Button onClick={handleSaveProfile} disabled={saving} className="w-full" size="lg">
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default ArtistProfile;
