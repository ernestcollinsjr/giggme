import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBand } from "@/contexts/BandContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Music, Plus, Trash2, Upload, Link as LinkIcon, ChevronUp, ChevronDown, FileText, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { YouTubePlayer } from "@/components/YouTubePlayer";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string | null;
  order_index: number;
  set_number: number;
  lyrics: string | null;
}

interface Setlist {
  id: string;
  title: string;
  description: string | null;
  songs: Song[];
}

interface Band {
  id: string;
  name: string;
  description: string | null;
}

export const SetlistManager = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedBandId, setSelectedBandId } = useBand();
  const [bands, setBands] = useState<Band[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSetlistTitle, setNewSetlistTitle] = useState("");
  const [newSetlistDescription, setNewSetlistDescription] = useState("");
  const [newSetlistBandId, setNewSetlistBandId] = useState<string>("");
  const [showNewSetlistDialog, setShowNewSetlistDialog] = useState(false);
  const [selectedSetlist, setSelectedSetlist] = useState<string | null>(null);
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songLyrics, setSongLyrics] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [selectedSet, setSelectedSet] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string } | null>(null);
  const [fetchingVideoInfo, setFetchingVideoInfo] = useState(false);
  
  // Drag and drop state
  const [draggedSongIndex, setDraggedSongIndex] = useState<number | null>(null);
  const [draggedSetNum, setDraggedSetNum] = useState<number | null>(null);
  const [draggedSetlistId, setDraggedSetlistId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedAvailableSongId, setDraggedAvailableSongId] = useState<string | null>(null);
  const [isDraggingOverSelectedArea, setIsDraggingOverSelectedArea] = useState(false);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [recentlyReordered, setRecentlyReordered] = useState<string | null>(null);
  const songItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedSongsAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchBands();
  }, []);

  useEffect(() => {
    if (selectedBandId) {
      fetchSetlists();
    }
  }, [selectedBandId]);

  // Default the dialog's band selector to the current band (or first band)
  useEffect(() => {
    if (showNewSetlistDialog) {
      setNewSetlistBandId(selectedBandId || (bands[0]?.id ?? ""));
    }
  }, [showNewSetlistDialog, selectedBandId, bands]);

  const fetchBands = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[SetlistManager] Current user:', user?.id);
      if (!user) return;

      const { data: bandsData, error } = await supabase
        .from("bands")
        .select("*")
        .eq("band_leader_id", user.id)
        .order("created_at", { ascending: false });

      console.log('[SetlistManager] Bands fetched:', { bandsData, error, userId: user.id });

      if (error) throw error;

      setBands(bandsData || []);
      
      // Auto-select first band if none selected
      if (bandsData && bandsData.length > 0 && !selectedBandId) {
        setSelectedBandId(bandsData[0].id);
      }
    } catch (error: any) {
      console.error('[SetlistManager] Error fetching bands:', error);
      toast({
        variant: "destructive",
        title: "Error loading bands",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSetlists = async () => {
    if (!selectedBandId) {
      setSetlists([]);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: setlistsData, error: setlistsError } = await supabase
        .from("setlists")
        .select("*")
        .eq("band_leader_id", user.id)
        .eq("band_id", selectedBandId)
        .order("created_at", { ascending: false });

      if (setlistsError) throw setlistsError;

      const setlistsWithSongs = await Promise.all(
        (setlistsData || []).map(async (setlist) => {
      const { data: songsData } = await supabase
        .from("setlist_songs")
        .select("*")
        .eq("setlist_id", setlist.id)
        .order("set_number", { ascending: true })
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

    if (!newSetlistBandId) {
      toast({
        variant: "destructive",
        title: "No band selected",
        description: "Please select a band for this setlist.",
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
        band_id: newSetlistBandId,
      });

      if (error) throw error;

      toast({
        title: "Setlist created",
        description: "Your new setlist has been created successfully",
      });

      setNewSetlistTitle("");
      setNewSetlistDescription("");
      setNewSetlistBandId("");
      setShowNewSetlistDialog(false);
      setSelectedBandId(newSetlistBandId);
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
            title: songTitle.trim() || file.name.replace(/\.[^/.]+$/, ""),
            artist: songArtist.trim() || null,
            audio_url: publicUrl,
            lyrics: songLyrics.trim() || null,
            order_index: currentOrderIndex++,
            set_number: selectedSet,
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
      setSongLyrics("");
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

  const fetchVideoInfo = async (url: string) => {
    if (!url.trim()) return;

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Validate YouTube URL
    try {
      const parsed = new URL(normalizedUrl);
      const host = parsed.hostname.toLowerCase();
      const isYouTube = host.includes('youtube.com') || host.includes('youtu.be');
      if (!isYouTube) return;
    } catch (e) {
      return;
    }

    setFetchingVideoInfo(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-youtube', {
        body: { url: normalizedUrl }
      });

      if (error) throw error;

      if (data?.title && data?.channelTitle) {
        setSongTitle(data.title);
        setSongArtist(data.channelTitle);
        toast({
          title: "Video info fetched!",
          description: "Title and artist have been auto-filled",
        });
      }
    } catch (error: any) {
      console.error('Error fetching video info:', error);
      toast({
        title: "Could not fetch video info",
        description: "Please enter title and artist manually",
        variant: "destructive",
      });
    } finally {
      setFetchingVideoInfo(false);
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
        lyrics: songLyrics.trim() || null,
        order_index: orderIndex,
        set_number: selectedSet,
      });

      if (error) throw error;

      toast({
        title: "Song added",
        description: "The YouTube link has been added successfully",
      });

      setSongTitle("");
      setSongArtist("");
      setSongLyrics("");
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

  const moveSongUp = async (setlistId: string, songId: string, currentSet: number, currentIndex: number) => {
    const setlist = setlists.find(s => s.id === setlistId);
    if (!setlist) return;

    const setSongs = setlist.songs.filter(s => s.set_number === currentSet);
    if (currentIndex === 0) return; // Already at top

    const currentSong = setSongs[currentIndex];
    const aboveSong = setSongs[currentIndex - 1];

    try {
      // Swap order_index values
      await supabase.from("setlist_songs").update({ order_index: currentSong.order_index }).eq("id", aboveSong.id);
      await supabase.from("setlist_songs").update({ order_index: aboveSong.order_index }).eq("id", currentSong.id);

      toast({ title: "Song moved up" });
      fetchSetlists();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error moving song", description: error.message });
    }
  };

  const moveSongDown = async (setlistId: string, songId: string, currentSet: number, currentIndex: number) => {
    const setlist = setlists.find(s => s.id === setlistId);
    if (!setlist) return;

    const setSongs = setlist.songs.filter(s => s.set_number === currentSet);
    if (currentIndex === setSongs.length - 1) return; // Already at bottom

    const currentSong = setSongs[currentIndex];
    const belowSong = setSongs[currentIndex + 1];

    try {
      // Swap order_index values
      await supabase.from("setlist_songs").update({ order_index: currentSong.order_index }).eq("id", belowSong.id);
      await supabase.from("setlist_songs").update({ order_index: belowSong.order_index }).eq("id", currentSong.id);

      toast({ title: "Song moved down" });
      fetchSetlists();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error moving song", description: error.message });
    }
  };

  const moveSongToSet = async (songId: string, targetSet: number) => {
    try {
      // Get all songs in the target set to determine the new order_index
      const { data: targetSetSongs } = await supabase
        .from("setlist_songs")
        .select("order_index")
        .eq("set_number", targetSet);

      const maxOrderIndex = targetSetSongs && targetSetSongs.length > 0
        ? Math.max(...targetSetSongs.map(s => s.order_index))
        : -1;

      await supabase
        .from("setlist_songs")
        .update({ 
          set_number: targetSet,
          order_index: maxOrderIndex + 1
        })
        .eq("id", songId);

      toast({ title: "Song moved to set", description: `Song moved to Set ${targetSet}` });
      fetchSetlists();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error moving song", description: error.message });
    }
  };

  const extractVideoId = (url: string): string | null => {
    if (!url) return null;
    try {
      const u = new URL(url.trim());
      const host = u.hostname.toLowerCase().replace('www.', '');
      let id = '';
      if (host === 'youtu.be') {
        id = u.pathname.substring(1).split('?')[0];
      } else if (host.includes('youtube.com')) {
        if (u.pathname === '/watch') {
          id = u.searchParams.get('v') || '';
        } else if (u.pathname.startsWith('/shorts/')) {
          id = u.pathname.split('/')[2] || '';
        } else if (u.pathname.startsWith('/embed/')) {
          id = u.pathname.split('/')[2] || '';
        } else if (u.pathname.startsWith('/v/')) {
          id = u.pathname.split('/')[2] || '';
        }
      }
      id = id.split('&')[0].split('?')[0];
      return id && id.length >= 10 ? id : null;
    } catch {
      return null;
    }
  };

  // Drag and drop handlers
  const handleDragStart = (setlistId: string, setNum: number, index: number, e: React.DragEvent) => {
    setDraggedSongIndex(index);
    setDraggedSetNum(setNum);
    setDraggedSetlistId(setlistId);
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
    setGhostPosition({ x: e.clientX, y: e.clientY });
  };

  const handleDrag = (e: React.DragEvent) => {
    if (e.clientX === 0 && e.clientY === 0) return;
    setGhostPosition({ x: e.clientX, y: e.clientY });
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertBefore = e.clientY < midpoint;
    setInsertionIndex(insertBefore ? index : index + 1);
  };

  const handleDragEnd = async () => {
    if (draggedSongIndex !== null && insertionIndex !== null && draggedSetlistId && draggedSetNum !== null) {
      const setlist = setlists.find(s => s.id === draggedSetlistId);
      if (setlist) {
        const setSongs = setlist.songs.filter(s => s.set_number === draggedSetNum);
        
        if (draggedSongIndex !== insertionIndex && draggedSongIndex !== insertionIndex - 1) {
          const draggedSong = setSongs[draggedSongIndex];
          if (draggedSong) {
            setRecentlyReordered(draggedSong.id);
            setTimeout(() => setRecentlyReordered(null), 600);
            
            // Reorder songs
            const newOrdered = [...setSongs];
            const [removed] = newOrdered.splice(draggedSongIndex, 1);
            const adjustedIndex = insertionIndex > draggedSongIndex ? insertionIndex - 1 : insertionIndex;
            newOrdered.splice(adjustedIndex, 0, removed);
            
            // Update order_index in database
            try {
              for (let i = 0; i < newOrdered.length; i++) {
                await supabase
                  .from("setlist_songs")
                  .update({ order_index: i })
                  .eq("id", newOrdered[i].id);
              }
              toast({ title: "Song order updated" });
              fetchSetlists();
            } catch (error: any) {
              toast({ variant: "destructive", title: "Error reordering songs", description: error.message });
            }
          }
        }
      }
    }

    setDraggedSongIndex(null);
    setDraggedSetNum(null);
    setDraggedSetlistId(null);
    setDragOverIndex(null);
    setIsTouchDragging(false);
    setGhostPosition(null);
    setInsertionIndex(null);
  };

  // Touch handlers for mobile
  const handleTouchStart = useCallback((setlistId: string, setNum: number, index: number, e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    setDraggedSongIndex(index);
    setDraggedSetNum(setNum);
    setDraggedSetlistId(setlistId);
    setIsTouchDragging(true);
    setGhostPosition({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (draggedSongIndex === null || !isTouchDragging) return;
    const touch = e.touches[0];
    setGhostPosition({ x: touch.clientX, y: touch.clientY });

    const elementAtTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    for (let i = 0; i < songItemRefs.current.length; i++) {
      const ref = songItemRefs.current[i];
      if (ref && (ref === elementAtTouch || ref.contains(elementAtTouch as Node))) {
        if (i !== dragOverIndex) setDragOverIndex(i);
        const rect = ref.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const insertBefore = touch.clientY < midpoint;
        setInsertionIndex(insertBefore ? i : i + 1);
        break;
      }
    }
  }, [draggedSongIndex, dragOverIndex, isTouchDragging]);

  const handleTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [draggedSongIndex, dragOverIndex, draggedSetlistId, draggedSetNum, insertionIndex, setlists]);

  const getDraggedSongTitle = () => {
    if (draggedSongIndex === null || draggedSetlistId === null || draggedSetNum === null) return '';
    const setlist = setlists.find(s => s.id === draggedSetlistId);
    if (!setlist) return '';
    const setSongs = setlist.songs.filter(s => s.set_number === draggedSetNum);
    const draggedSong = setSongs[draggedSongIndex];
    return draggedSong ? draggedSong.title : '';
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
                <Label htmlFor="band">Select Band</Label>
                <Select value={newSetlistBandId} onValueChange={setNewSetlistBandId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a band..." />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-background">
                    {bands.map((band) => (
                      <SelectItem key={band.id} value={band.id}>
                        {band.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                    <Label htmlFor="set-number-upload">Select Set</Label>
                    <Select value={selectedSet.toString()} onValueChange={(value) => setSelectedSet(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Set 1</SelectItem>
                        <SelectItem value="2">Set 2</SelectItem>
                        <SelectItem value="3">Set 3</SelectItem>
                        <SelectItem value="4">Set 4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="upload-song-title">Song Title (optional)</Label>
                    <Input
                      id="upload-song-title"
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      placeholder="Leave empty to use filename"
                    />
                  </div>
                  <div>
                    <Label htmlFor="upload-song-artist">Artist (optional)</Label>
                    <Input
                      id="upload-song-artist"
                      value={songArtist}
                      onChange={(e) => setSongArtist(e.target.value)}
                      placeholder="Enter artist name"
                    />
                  </div>
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
                      If uploading multiple files, the title/artist above will apply to all. Leave empty to use filenames.
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="youtube" className="space-y-4">
                  <div>
                    <Label htmlFor="set-number-youtube">Select Set</Label>
                    <Select value={selectedSet.toString()} onValueChange={(value) => setSelectedSet(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Set 1</SelectItem>
                        <SelectItem value="2">Set 2</SelectItem>
                        <SelectItem value="3">Set 3</SelectItem>
                        <SelectItem value="4">Set 4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                    <div className="flex gap-2">
                      <Input
                        id="youtube-link"
                        value={youtubeLink}
                        onChange={(e) => setYoutubeLink(e.target.value)}
                        onBlur={(e) => {
                          if (e.target.value.trim() && !songTitle.trim()) {
                            fetchVideoInfo(e.target.value);
                          }
                        }}
                        placeholder="https://youtube.com/watch?v=..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fetchVideoInfo(youtubeLink)}
                        disabled={!youtubeLink.trim() || fetchingVideoInfo}
                      >
                        {fetchingVideoInfo ? "Fetching..." : "Autofill"}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Paste a YouTube link and click Autofill to automatically get the title and artist
                    </p>
                  </div>
                  <Button onClick={addYoutubeLink} className="w-full">
                    Add Song
                  </Button>
                </TabsContent>
              </Tabs>

              {setlist.songs.length > 0 && (
                <div className="space-y-3 mt-4">
                  {[1, 2, 3, 4].map((setNum) => {
                    const setSongs = setlist.songs.filter(song => song.set_number === setNum);
                    if (setSongs.length === 0) return null;
                    
                    return (
                      <div key={setNum} className="space-y-1">
                        <h3 className="text-xs font-semibold text-muted-foreground/70 mb-0.5">Set {setNum} ({setSongs.length} songs)</h3>
                        {setSongs.map((song, index) => {
                          const isDragging = draggedSongIndex === index && draggedSetlistId === setlist.id && draggedSetNum === setNum;
                          const isInSameDragContext = draggedSetlistId === setlist.id && draggedSetNum === setNum && draggedSongIndex !== null;
                          
                          // Calculate smooth shift for items making room
                          let translateY = 0;
                          if (isInSameDragContext && insertionIndex !== null && !isDragging && draggedSongIndex !== null) {
                            if (draggedSongIndex < index && insertionIndex > index) {
                              translateY = -44; // Shift up (item height + gap)
                            } else if (draggedSongIndex > index && insertionIndex <= index) {
                              translateY = 44; // Shift down
                            }
                          }
                          
                          return (
                          <div 
                            key={song.id} 
                            className="relative"
                            style={{
                              transform: `translateY(${translateY}px)`,
                              transition: 'transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
                            }}
                          >
                            <div
                              ref={(el) => { songItemRefs.current[index] = el; }}
                              draggable
                              onDragStart={(e) => handleDragStart(setlist.id, setNum, index, e)}
                              onDrag={handleDrag}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragEnd={handleDragEnd}
                              onTouchStart={(e) => handleTouchStart(setlist.id, setNum, index, e)}
                              onTouchMove={handleTouchMove}
                              onTouchEnd={handleTouchEnd}
                              className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-200 ${
                                isDragging 
                                  ? 'opacity-30 scale-95 bg-muted border-2 border-dashed border-primary/40' 
                                  : 'bg-slate-100 dark:bg-slate-800/20 hover:bg-slate-200 dark:hover:bg-slate-700/30'
                              } ${recentlyReordered === song.id ? 'animate-spring-settle bg-primary/10 ring-2 ring-primary/30' : ''}`}
                            >
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground font-medium w-4 shrink-0">
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate leading-tight">{song.title}</p>
                                {song.artist && (
                                  <p className="text-[10px] text-muted-foreground truncate leading-tight">{song.artist}</p>
                                )}
                                {song.audio_url && (song.audio_url.includes('youtube.com') || song.audio_url.includes('youtu.be')) && (
                                  <div className="space-y-0.5 mt-0.5">
                                    <a 
                                      href={`/open?to=${encodeURIComponent(song.audio_url)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-primary hover:underline break-all inline-block leading-tight"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {song.audio_url}
                                     </a>
                                     <div className="flex items-center gap-1">
                                       <Button
                                         variant="ghost"
                                         size="sm"
                                         className="h-6 text-[10px] px-1.5 py-0"
                                         onClick={async () => {
                                           const localVideoId = song.audio_url ? extractVideoId(song.audio_url) : null;
                                           if (localVideoId) {
                                             setPlayingVideo({ videoId: localVideoId, title: song.title });
                                             return;
                                           }
                                           try {
                                             const { data } = await supabase.functions.invoke('fetch-youtube', {
                                               body: { url: song.audio_url }
                                             });
                                             if (data?.videoId) {
                                               setPlayingVideo({ videoId: data.videoId, title: song.title });
                                             } else {
                                               toast({ variant: 'destructive', title: 'Could not load video' });
                                             }
                                           } catch {
                                             toast({ variant: 'destructive', title: 'Could not load video' });
                                           }
                                         }}
                                       >
                                         Watch
                                       </Button>
                                       <Button
                                         variant="ghost"
                                         size="sm"
                                         className="h-6 text-[10px] px-1.5 py-0"
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
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] px-1.5 py-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/setlist/lyrics/${song.id}`);
                                        }}
                                      >
                                        <FileText className="h-2.5 w-2.5 mr-0.5" />
                                        Lyrics
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Select
                                value={song.set_number.toString()}
                                onValueChange={(value) => moveSongToSet(song.id, parseInt(value))}
                              >
                                <SelectTrigger className="w-16 h-6 text-[10px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">Set 1</SelectItem>
                                  <SelectItem value="2">Set 2</SelectItem>
                                  <SelectItem value="3">Set 3</SelectItem>
                                  <SelectItem value="4">Set 4</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => deleteSong(song.id)}
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* Smooth floating ghost card */}
      {ghostPosition && draggedSongIndex !== null && draggedSetlistId && draggedSetNum !== null && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: ghostPosition.x - 120,
            top: ghostPosition.y - 24,
            transition: 'left 0.02s linear, top 0.02s linear',
          }}
        >
          <div 
            className="w-[260px] py-2 px-3 rounded-lg bg-card shadow-2xl border-2 border-primary ring-4 ring-primary/20"
            style={{
              transform: 'rotate(-1deg) scale(1.02)',
            }}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{getDraggedSongTitle()}</p>
                <p className="text-xs text-muted-foreground">Drag to reorder</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {playingVideo && (
        <YouTubePlayer
          videoId={playingVideo.videoId}
          title={playingVideo.title}
          isOpen={!!playingVideo}
          onClose={() => setPlayingVideo(null)}
        />
      )}
    </div>
  );
};
