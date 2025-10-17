import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Music, Edit, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import { Textarea } from "@/components/ui/textarea";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  lyrics: string | null;
}

const SongLyrics = () => {
  const navigate = useNavigate();
  const { songId } = useParams();
  const { toast } = useToast();
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData) {
        setUserRole(roleData.role);
      }
      
      fetchSong();
    };

    checkAuth();
  }, [navigate, songId]);

  const fetchSong = async () => {
    try {
      const { data, error } = await supabase
        .from("setlist_songs")
        .select("id, title, artist, lyrics")
        .eq("id", songId)
        .single();

      if (error) throw error;

      setSong(data);
      setEditedLyrics(data.lyrics || "");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading song",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLyrics = async () => {
    setSaving(true);

    try {
      const { error } = await supabase
        .from("setlist_songs")
        .update({ lyrics: editedLyrics.trim() || null })
        .eq("id", songId);

      if (error) throw error;

      setSong((prev) => prev ? { ...prev, lyrics: editedLyrics.trim() || null } : null);
      setIsEditing(false);

      toast({
        title: "Lyrics saved",
        description: "The lyrics have been updated successfully",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error saving lyrics",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedLyrics(song?.lyrics || "");
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading lyrics...</div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Song not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 pb-20">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/setlist")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {song.title}
            </h1>
            {song.artist && (
              <p className="text-muted-foreground mt-1">{song.artist}</p>
            )}
          </div>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Lyrics
              </CardTitle>
              {userRole === "band_leader" && !isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Import Lyrics
                </Button>
              )}
              {userRole === "band_leader" && isEditing && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveLyrics} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editedLyrics}
                  onChange={(e) => setEditedLyrics(e.target.value)}
                  placeholder="Paste or type lyrics here..."
                  rows={20}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Only add lyrics you have legal access to
                </p>
              </div>
            ) : (
              <>
                {song.lyrics ? (
                  <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {song.lyrics}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No lyrics available yet. {userRole === "band_leader" ? "Click 'Import Lyrics' to add them." : "Your band leader can add them."}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
};

export default SongLyrics;
