import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Music, Plus, Trash2, Upload, Link as LinkIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string | null;
  order_index: number;
}

interface Setlist {
  id: string;
  title: string;
  description: string | null;
  songs: Song[];
}

export const SetlistManager = () => {
  const { toast } = useToast();
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSetlistTitle, setNewSetlistTitle] = useState("");
  const [newSetlistDescription, setNewSetlistDescription] = useState("");
  const [showNewSetlistDialog, setShowNewSetlistDialog] = useState(false);
  const [selectedSetlist, setSelectedSetlist] = useState<string | null>(null);
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSetlists();
  }, []);

  const fetchSetlists = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: setlistsData, error: setlistsError } = await supabase
        .from("setlists")
        .select("*")
        .eq("band_leader_id", user.id)
        .order("created_at", { ascending: false });

      if (setlistsError) throw setlistsError;

      const setlistsWithSongs = await Promise.all(
        (setlistsData || []).map(async (setlist) => {
          const { data: songsData } = await supabase
            .from("setlist_songs")
            .select("*")
            .eq("setlist_id", setlist.id)
            .order("order_index", { ascending: true });

          return {
            ...setlist,
            songs: songsData || [],
          };
        })
      );

      setSetlists(setlistsWithSongs);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading setlists",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const createSetlist = async () => {
    if (!newSetlistTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Please enter a setlist title",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("setlists").insert({
        title: newSetlistTitle,
        description: newSetlistDescription || null,
        band_leader_id: user.id,
      });

      if (error) throw error;

      toast({
        title: "Setlist created",
        description: "Your new setlist has been created successfully",
      });

      setNewSetlistTitle("");
      setNewSetlistDescription("");
      setShowNewSetlistDialog(false);
      fetchSetlists();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error creating setlist",
        description: error.message,
      });
    }
  };

  const deleteSetlist = async (setlistId: string) => {
    try {
      const { error } = await supabase.from("setlists").delete().eq("id", setlistId);
      if (error) throw error;

      toast({
        title: "Setlist deleted",
        description: "The setlist has been removed",
      });

      fetchSetlists();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting setlist",
        description: error.message,
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedSetlist || !e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    const audioFiles = files.filter(file => file.type.startsWith("audio/"));

    if (audioFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "Invalid files",
        description: "Please upload audio files (mp3, wav, etc.)",
      });
      return;
    }

    if (audioFiles.length !== files.length) {
      toast({
        title: "Some files skipped",
        description: `${files.length - audioFiles.length} non-audio files were skipped`,
      });
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const setlist = setlists.find((s) => s.id === selectedSetlist);
      let currentOrderIndex = setlist ? setlist.songs.length : 0;

      let successCount = 0;
      let failCount = 0;

      for (const file of audioFiles) {
        try {
          const fileExt = file.name.split(".").pop();
          const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("setlist-audio")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from("setlist-audio")
            .getPublicUrl(fileName);

          const { error: insertError } = await supabase.from("setlist_songs").insert({
            setlist_id: selectedSetlist,
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: null,
            audio_url: publicUrl,
            order_index: currentOrderIndex++,
          });

          if (insertError) throw insertError;
          successCount++;
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Songs uploaded",
          description: `Successfully added ${successCount} song${successCount > 1 ? 's' : ''} to the setlist`,
        });
      }

      if (failCount > 0) {
        toast({
          variant: "destructive",
          title: "Some uploads failed",
          description: `${failCount} file${failCount > 1 ? 's' : ''} could not be uploaded`,
        });
      }

      setSongTitle("");
      setSongArtist("");
      fetchSetlists();
      
      // Reset file input
      e.target.value = "";
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error uploading files",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const addYoutubeLink = async () => {
    if (!selectedSetlist || !youtubeLink.trim() || !songTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please enter a song title and YouTube link",
      });
      return;
    }

    // Normalize and validate the YouTube URL
    let url = youtubeLink.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const isYouTube = host.includes('youtube.com') || host.includes('youtu.be');
      if (!isYouTube) {
        throw new Error('Not a valid YouTube domain');
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Invalid YouTube link",
        description: "Please enter a valid YouTube URL (youtube.com or youtu.be)",
      });
      return;
    }

    try {
      const setlist = setlists.find((s) => s.id === selectedSetlist);
      const orderIndex = setlist ? setlist.songs.length : 0;

      const { error } = await supabase.from("setlist_songs").insert({
        setlist_id: selectedSetlist,
        title: songTitle.trim(),
        artist: songArtist.trim() || null,
        audio_url: url,
        order_index: orderIndex,
      });

      if (error) throw error;

      toast({
        title: "Song added",
        description: "The YouTube link has been added successfully",
      });

      setSongTitle("");
      setSongArtist("");
      setYoutubeLink("");
      fetchSetlists();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error adding song",
        description: error.message,
      });
    }
  };

  const deleteSong = async (songId: string) => {
    try {
      const { error } = await supabase.from("setlist_songs").delete().eq("id", songId);
      if (error) throw error;

      toast({
        title: "Song removed",
        description: "The song has been deleted from the setlist",
      });

      fetchSetlists();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting song",
        description: error.message,
      });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading setlists...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Manage Setlists</h2>
        <Dialog open={showNewSetlistDialog} onOpenChange={setShowNewSetlistDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Setlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Setlist</DialogTitle>
              <DialogDescription>Add a new setlist for your band members to access</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Setlist for Gig below</Label>
                <Input
                  id="title"
                  value={newSetlistTitle}
                  onChange={(e) => setNewSetlistTitle(e.target.value)}
                  placeholder="e.g., Spring 2024 Tour"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={newSetlistDescription}
                  onChange={(e) => setNewSetlistDescription(e.target.value)}
                  placeholder="Add any notes about this setlist..."
                />
              </div>
              <Button onClick={createSetlist} className="w-full">
                Create Setlist
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {setlists.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No setlists yet. Create your first one!</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        setlists.map((setlist) => (
          <Card key={setlist.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-muted-foreground">For:</span>
                    {setlist.title}
                  </CardTitle>
                  {setlist.description && (
                    <CardDescription className="mt-2">{setlist.description}</CardDescription>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteSetlist(setlist.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="upload">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload" onClick={() => setSelectedSetlist(setlist.id)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload MP3
                  </TabsTrigger>
                  <TabsTrigger value="youtube" onClick={() => setSelectedSetlist(setlist.id)}>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    YouTube Link
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="space-y-4">
                  <div>
                    <Label htmlFor="audio-file">Audio Files (Select multiple)</Label>
                    <Input
                      id="audio-file"
                      type="file"
                      accept="audio/*"
                      multiple
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      You can select up to 30+ songs at once. File names will be used as song titles.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="youtube" className="space-y-4">
                  <div>
                    <Label htmlFor="yt-song-title">Song Title</Label>
                    <Input
                      id="yt-song-title"
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      placeholder="Enter song title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="yt-song-artist">Artist (optional)</Label>
                    <Input
                      id="yt-song-artist"
                      value={songArtist}
                      onChange={(e) => setSongArtist(e.target.value)}
                      placeholder="Enter artist name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="youtube-link">YouTube Link</Label>
                    <Input
                      id="youtube-link"
                      value={youtubeLink}
                      onChange={(e) => setYoutubeLink(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                  <Button onClick={addYoutubeLink} className="w-full">
                    Add Song
                  </Button>
                </TabsContent>
              </Tabs>

              {setlist.songs.length > 0 && (
                <div className="space-y-2 mt-6">
                  <h3 className="font-semibold text-sm">Songs ({setlist.songs.length})</h3>
                  {setlist.songs.map((song, index) => (
                    <div
                      key={song.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-accent/50"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-sm text-muted-foreground font-medium w-6">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium">{song.title}</p>
                          {song.artist && (
                            <p className="text-sm text-foreground">{song.artist}</p>
                          )}
                          {song.audio_url && (song.audio_url.includes('youtube.com') || song.audio_url.includes('youtu.be')) && (
                            <div className="space-y-1">
                              <a 
                                href={encodeURI(song.audio_url)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline break-all inline-block"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {song.audio_url}
                              </a>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const url = song.audio_url;
                                    try {
                                      const w = window.open(url, '_blank', 'noopener,noreferrer');
                                      if (w) return;
                                      if (window.top) {
                                        window.top.location.href = url;
                                        return;
                                      }
                                      window.location.href = url;
                                    } catch {
                                      if (window.top) {
                                        window.top.location.href = url;
                                      } else {
                                        window.location.href = url;
                                      }
                                    }
                                  }}
                                >
                                  Open
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await navigator.clipboard.writeText(song.audio_url);
                                      toast({ title: 'Link copied', description: 'YouTube URL copied to clipboard' });
                                    } catch {
                                      toast({ variant: 'destructive', title: 'Copy failed', description: 'Unable to copy link' });
                                    }
                                  }}
                                >
                                  Copy link
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteSong(song.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
