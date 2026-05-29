import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBand } from "@/contexts/BandContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Music, Plus, Trash2, Upload, Link as LinkIcon, ChevronUp, ChevronDown, FileText, GripVertical, Bell, Pencil, Calendar, Clock, MapPin, ArrowUpDown, Filter, Archive, RotateCcw, CheckSquare, Square, Download, Share2, Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import jsPDF from "jspdf";

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
  event_date?: string | null;
  event_time?: string | null;
  call_time?: string | null;
  address?: string | null;
  rehearsal_date?: string | null;
  rehearsal_time?: string | null;
}

interface Band {
  id: string;
  name: string;
  description: string | null;
  band_leader_id: string;
}

export const SetlistManager = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedBandId, setSelectedBandId } = useBand();
  const [bands, setBands] = useState<Band[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'created'>('date');
  const [filterBy, setFilterBy] = useState<'all' | 'upcoming' | 'past'>('all');
  const [newSetlistTitle, setNewSetlistTitle] = useState("");
  const [newSetlistDescription, setNewSetlistDescription] = useState("");
  const [newSetlistBandId, setNewSetlistBandId] = useState<string>("");
  const [showNewSetlistDialog, setShowNewSetlistDialog] = useState(false);
  const [showEditSetlistDialog, setShowEditSetlistDialog] = useState(false);
  const [editingSetlist, setEditingSetlist] = useState<any>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoringSetlist, setRestoringSetlist] = useState<any>(null);
  const [restoreDate, setRestoreDate] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingSetlist, setDeletingSetlist] = useState<any>(null);
  const [selectedForBulkDelete, setSelectedForBulkDelete] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [selectedSetlist, setSelectedSetlist] = useState<string | null>(null);
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songLyrics, setSongLyrics] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [selectedSet, setSelectedSet] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string } | null>(null);
  const [fetchingVideoInfo, setFetchingVideoInfo] = useState(false);
  
  // New setlist event fields
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [callTime, setCallTime] = useState("");
  const [rehearsalDate, setRehearsalDate] = useState("");
  const [rehearsalTime, setRehearsalTime] = useState("");
  const [rehearsalCallTime, setRehearsalCallTime] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [venueLat, setVenueLat] = useState<number | null>(null);
  const [venueLng, setVenueLng] = useState<number | null>(null);
  const [eventNotes, setEventNotes] = useState("");
  const [bandMembers, setBandMembers] = useState<{ id: string; name: string }[]>([]);
  const [musicLeaderId, setMusicLeaderId] = useState<string>("");
  
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
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharingSetlistId, setSharingSetlistId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [generatingShare, setGeneratingShare] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
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
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
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
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
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

  // Fetch band members when band is selected in the dialog
  const fetchBandMembers = async (bandId: string) => {
    if (!bandId) {
      setBandMembers([]);
      return;
    }
    
    try {
      const { data: members, error } = await supabase
        .from("band_members")
        .select("member_id, profiles!band_members_member_id_fkey(id, name)")
        .eq("band_id", bandId);
      
      if (error) throw error;
      
      const memberProfiles = members
        ?.map((m: any) => m.profiles)
        .filter((p: any): p is { id: string; name: string } => p !== null) || [];
      
      // Also include the band leader
      const band = bands.find(b => b.id === bandId);
      if (band) {
        const { data: leaderProfile } = await supabase
          .from("profiles")
          .select("id, name")
          .eq("id", (band as any).band_leader_id)
          .maybeSingle();
        
        if (leaderProfile && !memberProfiles.some(m => m.id === leaderProfile.id)) {
          memberProfiles.unshift(leaderProfile);
        }
      }
      
      setBandMembers(memberProfiles);
    } catch (error) {
      console.error("Error fetching band members:", error);
    }
  };

  const resetNewSetlistForm = () => {
    setNewSetlistTitle("");
    setNewSetlistDescription("");
    setNewSetlistBandId("");
    setEventDate("");
    setEventTime("");
    setCallTime("");
    setRehearsalDate("");
    setRehearsalTime("");
    setRehearsalCallTime("");
    setEventAddress("");
    setVenueLat(null);
    setVenueLng(null);
    setEventNotes("");
    setMusicLeaderId("");
    setBandMembers([]);
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
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) return;

      const { error } = await supabase.from("setlists").insert({
        title: newSetlistTitle,
        description: newSetlistDescription || null,
        band_leader_id: user.id,
        band_id: newSetlistBandId,
        event_date: eventDate ? new Date(eventDate).toISOString() : null,
        event_time: eventTime || null,
        call_time: callTime || null,
        rehearsal_date: rehearsalDate ? new Date(rehearsalDate).toISOString() : null,
        rehearsal_time: rehearsalTime || null,
        rehearsal_call_time: rehearsalCallTime || null,
        address: eventAddress || null,
        venue_lat: venueLat,
        venue_lng: venueLng,
        notes: eventNotes || null,
        music_leader_id: musicLeaderId || null,
      });

      if (error) throw error;

      toast({
        title: "Setlist created",
        description: "Your new setlist has been created successfully",
      });

      resetNewSetlistForm();
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

  const openEditDialog = async (setlist: any) => {
    // Fetch full setlist details
    try {
      const { data, error } = await supabase
        .from("setlists")
        .select("*")
        .eq("id", setlist.id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return;
      
      setEditingSetlist(data);
      setNewSetlistTitle(data.title);
      setNewSetlistDescription(data.description || "");
      setNewSetlistBandId(data.band_id || "");
      setEventDate(data.event_date ? new Date(data.event_date).toISOString().split('T')[0] : "");
      setEventTime(data.event_time || "");
      setCallTime(data.call_time || "");
      setRehearsalDate(data.rehearsal_date ? new Date(data.rehearsal_date).toISOString().split('T')[0] : "");
      setRehearsalTime(data.rehearsal_time || "");
      setRehearsalCallTime(data.rehearsal_call_time || "");
      setEventAddress(data.address || "");
      setVenueLat(data.venue_lat);
      setVenueLng(data.venue_lng);
      setEventNotes(data.notes || "");
      setMusicLeaderId(data.music_leader_id || "");
      
      if (data.band_id) {
        await fetchBandMembers(data.band_id);
      }
      
      setShowEditSetlistDialog(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading setlist",
        description: error.message,
      });
    }
  };

  const updateSetlist = async () => {
    if (!editingSetlist || !newSetlistTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Please enter a setlist title",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("setlists")
        .update({
          title: newSetlistTitle,
          description: newSetlistDescription || null,
          band_id: newSetlistBandId || null,
          event_date: eventDate ? new Date(eventDate).toISOString() : null,
          event_time: eventTime || null,
          call_time: callTime || null,
          rehearsal_date: rehearsalDate ? new Date(rehearsalDate).toISOString() : null,
          rehearsal_time: rehearsalTime || null,
          rehearsal_call_time: rehearsalCallTime || null,
          address: eventAddress || null,
          venue_lat: venueLat,
          venue_lng: venueLng,
          notes: eventNotes || null,
          music_leader_id: musicLeaderId || null,
        })
        .eq("id", editingSetlist.id);

      if (error) throw error;

      toast({
        title: "Setlist updated",
        description: "Your setlist has been updated successfully",
      });

      resetNewSetlistForm();
      setEditingSetlist(null);
      setShowEditSetlistDialog(false);
      fetchSetlists();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating setlist",
        description: error.message,
      });
    }
  };

  const openDeleteDialog = (setlist: any) => {
    setDeletingSetlist(setlist);
    setShowDeleteDialog(true);
  };

  const deleteSetlist = async () => {
    if (!deletingSetlist) return;
    
    try {
      const { error } = await supabase.from("setlists").delete().eq("id", deletingSetlist.id);
      if (error) throw error;

      toast({
        title: "Setlist deleted",
        description: "The setlist has been removed",
      });

      setShowDeleteDialog(false);
      setDeletingSetlist(null);
      fetchSetlists();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting setlist",
        description: error.message,
      });
    }
  };

  const toggleBulkDeleteSelection = (setlistId: string) => {
    setSelectedForBulkDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(setlistId)) {
        newSet.delete(setlistId);
      } else {
        newSet.add(setlistId);
      }
      return newSet;
    });
  };

  const getArchivedSetlistIds = () => {
    return setlists
      .filter(setlist => {
        if (!setlist.event_date) return false;
        const eventDate = new Date(setlist.event_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate < today;
      })
      .map(s => s.id);
  };

  const selectAllArchived = () => {
    const archivedIds = getArchivedSetlistIds();
    setSelectedForBulkDelete(new Set(archivedIds));
  };

  const clearBulkSelection = () => {
    setSelectedForBulkDelete(new Set());
  };

  const bulkDeleteSetlists = async () => {
    if (selectedForBulkDelete.size === 0) return;

    try {
      const idsToDelete = Array.from(selectedForBulkDelete);
      const { error } = await supabase
        .from("setlists")
        .delete()
        .in("id", idsToDelete);

      if (error) throw error;

      toast({
        title: "Setlists deleted",
        description: `${idsToDelete.length} archived setlist${idsToDelete.length > 1 ? 's have' : ' has'} been removed`,
      });

      setShowBulkDeleteDialog(false);
      setSelectedForBulkDelete(new Set());
      fetchSetlists();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting setlists",
        description: error.message,
      });
    }
  };

  const exportSetlistToPdf = (setlist: Setlist) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;
    const lineHeight = 7;
    const margin = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(setlist.title, pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    // Event details
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    if (setlist.event_date) {
      const eventDate = new Date(setlist.event_date).toLocaleDateString(undefined, { 
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
      });
      doc.text(`Date: ${eventDate}${setlist.event_time ? ` at ${setlist.event_time}` : ''}`, margin, yPos);
      yPos += lineHeight;
    }

    if (setlist.call_time) {
      doc.text(`Call Time: ${setlist.call_time}`, margin, yPos);
      yPos += lineHeight;
    }

    if (setlist.address) {
      doc.text(`Location: ${setlist.address}`, margin, yPos);
      yPos += lineHeight;
    }

    if (setlist.description) {
      yPos += 3;
      doc.text(`Notes: ${setlist.description}`, margin, yPos);
      yPos += lineHeight;
    }

    yPos += 5;

    // Group songs by set
    const songsBySet = setlist.songs.reduce((acc, song) => {
      const setNum = song.set_number || 1;
      if (!acc[setNum]) acc[setNum] = [];
      acc[setNum].push(song);
      return acc;
    }, {} as Record<number, Song[]>);

    const setNumbers = Object.keys(songsBySet).map(Number).sort((a, b) => a - b);

    setNumbers.forEach((setNum) => {
      const songs = songsBySet[setNum].sort((a, b) => a.order_index - b.order_index);
      
      // Check if we need a new page
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      // Set header
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Set ${setNum}`, margin, yPos);
      yPos += 8;

      // Songs
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      
      songs.forEach((song, index) => {
        if (yPos > 275) {
          doc.addPage();
          yPos = 20;
        }

        const songText = `${index + 1}. ${song.title}${song.artist ? ` - ${song.artist}` : ''}`;
        doc.text(songText, margin, yPos);
        yPos += lineHeight;
      });

      yPos += 5;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 290, { align: "center" });

    // Save the PDF
    const filename = `${setlist.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_setlist.pdf`;
    doc.save(filename);

    toast({
      title: "PDF exported",
      description: `Setlist saved as ${filename}`,
    });
  };

  const openShareDialog = async (setlistId: string) => {
    setSharingSetlistId(setlistId);
    setShareLink(null);
    setLinkCopied(false);
    setShareDialogOpen(true);
    
    // Check if there's already an active share link
    try {
      const { data: existingShare } = await supabase
        .from("shared_setlists")
        .select("share_token")
        .eq("setlist_id", setlistId)
        .eq("is_active", true)
        .maybeSingle();
      
      if (existingShare) {
        const link = `${window.location.origin}/shared-setlist/${existingShare.share_token}`;
        setShareLink(link);
      }
    } catch (error) {
      console.error("Error checking existing share:", error);
    }
  };

  const generateShareLink = async () => {
    if (!sharingSetlistId) return;
    
    setGeneratingShare(true);
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("shared_setlists")
        .insert({
          setlist_id: sharingSetlistId,
          created_by: user.id,
        })
        .select("share_token")
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/shared-setlist/${data.share_token}`;
      setShareLink(link);
      
      toast({
        title: "Share link created",
        description: "Your setlist can now be shared with this link",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error creating share link",
        description: error.message,
      });
    } finally {
      setGeneratingShare(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      toast({
        title: "Link copied",
        description: "Share link copied to clipboard",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Please copy the link manually",
      });
    }
  };

  const openRestoreDialog = (setlist: any) => {
    setRestoringSetlist(setlist);
    // Default to tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setRestoreDate(tomorrow.toISOString().split('T')[0]);
    setShowRestoreDialog(true);
  };

  const restoreSetlist = async () => {
    if (!restoringSetlist || !restoreDate) {
      toast({
        variant: "destructive",
        title: "Date required",
        description: "Please select a new event date",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("setlists")
        .update({
          event_date: new Date(restoreDate).toISOString(),
        })
        .eq("id", restoringSetlist.id);

      if (error) throw error;

      toast({
        title: "Setlist restored",
        description: "The setlist has been moved to the new date",
      });

      setShowRestoreDialog(false);
      setRestoringSetlist(null);
      setRestoreDate("");
      fetchSetlists();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error restoring setlist",
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
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Manage Setlists</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterBy} onValueChange={(value: 'all' | 'upcoming' | 'past') => setFilterBy(value)}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Filter..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="past">Past</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(value: 'date' | 'name' | 'created') => setSortBy(value)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">By Event Date</SelectItem>
                <SelectItem value="name">By Name</SelectItem>
                <SelectItem value="created">By Created</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Dialog open={showNewSetlistDialog} onOpenChange={setShowNewSetlistDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Setlist
              </Button>
            </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Setlist</DialogTitle>
              <DialogDescription>Schedule an event with optional rehearsal information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Setlist Title */}
              <div>
                <Label htmlFor="title">Event/Gig Title *</Label>
                <Input
                  id="title"
                  value={newSetlistTitle}
                  onChange={(e) => setNewSetlistTitle(e.target.value)}
                  placeholder="Sunday Morning Service, Concert, etc."
                />
              </div>

              {/* Select Band */}
              <div>
                <Label htmlFor="band">Group/Team</Label>
                <Select 
                  value={newSetlistBandId} 
                  onValueChange={(value) => {
                    setNewSetlistBandId(value);
                    fetchBandMembers(value);
                  }}
                >
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

              {/* Event Information Section */}
              <div className="pt-2">
                <h4 className="text-sm font-semibold text-primary mb-3">Event/Gig Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="event-date">Event Date</Label>
                    <Input
                      id="event-date"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-time">Event Time</Label>
                    <Input
                      id="event-time"
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="call-time">Call Time</Label>
                    <Input
                      id="call-time"
                      type="time"
                      value={callTime}
                      onChange={(e) => setCallTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Rehearsal Information Section */}
              <div className="pt-2">
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">Rehearsal Information (Optional)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="rehearsal-date">Rehearsal Date</Label>
                    <Input
                      id="rehearsal-date"
                      type="date"
                      value={rehearsalDate}
                      onChange={(e) => setRehearsalDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rehearsal-time">Rehearsal Time</Label>
                    <Input
                      id="rehearsal-time"
                      type="time"
                      value={rehearsalTime}
                      onChange={(e) => setRehearsalTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rehearsal-call-time">Rehearsal Call Time</Label>
                    <Input
                      id="rehearsal-call-time"
                      type="time"
                      value={rehearsalCallTime}
                      onChange={(e) => setRehearsalCallTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Address and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <PlaceAutocomplete
                    value={eventAddress}
                    onChange={(value, placeDetails) => {
                      setEventAddress(value);
                      if (placeDetails?.geometry?.location) {
                        const lat = typeof placeDetails.geometry.location.lat === 'function' 
                          ? placeDetails.geometry.location.lat() 
                          : placeDetails.geometry.location.lat;
                        const lng = typeof placeDetails.geometry.location.lng === 'function' 
                          ? placeDetails.geometry.location.lng() 
                          : placeDetails.geometry.location.lng;
                        setVenueLat(lat as number);
                        setVenueLng(lng as number);
                      }
                    }}
                    placeholder="Search for venue or address"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={eventNotes}
                    onChange={(e) => setEventNotes(e.target.value)}
                    placeholder="Enter notes"
                  />
                </div>
              </div>

              {/* Music Leader/Director */}
              <div>
                <Label htmlFor="music-leader">Music Leader/Director</Label>
                <Select value={musicLeaderId} onValueChange={setMusicLeaderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Leader/Director" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-background">
                    {bandMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={newSetlistDescription}
                  onChange={(e) => setNewSetlistDescription(e.target.value)}
                  placeholder="Add any notes about this setlist..."
                  rows={2}
                />
              </div>

              <Button onClick={createSetlist} className="w-full">
                Create Setlist
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Setlist Dialog */}
        <Dialog open={showEditSetlistDialog} onOpenChange={(open) => {
          setShowEditSetlistDialog(open);
          if (!open) {
            resetNewSetlistForm();
            setEditingSetlist(null);
          }
        }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Setlist</DialogTitle>
              <DialogDescription>Update the event and setlist information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Setlist Title */}
              <div>
                <Label htmlFor="edit-title">Event/Gig Title *</Label>
                <Input
                  id="edit-title"
                  value={newSetlistTitle}
                  onChange={(e) => setNewSetlistTitle(e.target.value)}
                  placeholder="Sunday Morning Service, Concert, etc."
                />
              </div>

              {/* Select Band */}
              <div>
                <Label htmlFor="edit-band">Group/Team</Label>
                <Select 
                  value={newSetlistBandId} 
                  onValueChange={(value) => {
                    setNewSetlistBandId(value);
                    fetchBandMembers(value);
                  }}
                >
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

              {/* Event Information Section */}
              <div className="pt-2">
                <h4 className="text-sm font-semibold text-primary mb-3">Event/Gig Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="edit-event-date">Event Date</Label>
                    <Input
                      id="edit-event-date"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-event-time">Event Time</Label>
                    <Input
                      id="edit-event-time"
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-call-time">Call Time</Label>
                    <Input
                      id="edit-call-time"
                      type="time"
                      value={callTime}
                      onChange={(e) => setCallTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Rehearsal Information Section */}
              <div className="pt-2">
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">Rehearsal Information (Optional)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="edit-rehearsal-date">Rehearsal Date</Label>
                    <Input
                      id="edit-rehearsal-date"
                      type="date"
                      value={rehearsalDate}
                      onChange={(e) => setRehearsalDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-rehearsal-time">Rehearsal Time</Label>
                    <Input
                      id="edit-rehearsal-time"
                      type="time"
                      value={rehearsalTime}
                      onChange={(e) => setRehearsalTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-rehearsal-call-time">Rehearsal Call Time</Label>
                    <Input
                      id="edit-rehearsal-call-time"
                      type="time"
                      value={rehearsalCallTime}
                      onChange={(e) => setRehearsalCallTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Address and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-address">Address</Label>
                  <PlaceAutocomplete
                    value={eventAddress}
                    onChange={(value, placeDetails) => {
                      setEventAddress(value);
                      if (placeDetails?.geometry?.location) {
                        const lat = typeof placeDetails.geometry.location.lat === 'function' 
                          ? placeDetails.geometry.location.lat() 
                          : placeDetails.geometry.location.lat;
                        const lng = typeof placeDetails.geometry.location.lng === 'function' 
                          ? placeDetails.geometry.location.lng() 
                          : placeDetails.geometry.location.lng;
                        setVenueLat(lat as number);
                        setVenueLng(lng as number);
                      }
                    }}
                    placeholder="Search for venue or address"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Input
                    id="edit-notes"
                    value={eventNotes}
                    onChange={(e) => setEventNotes(e.target.value)}
                    placeholder="Enter notes"
                  />
                </div>
              </div>

              {/* Music Leader/Director */}
              <div>
                <Label htmlFor="edit-music-leader">Music Leader/Director</Label>
                <Select value={musicLeaderId} onValueChange={setMusicLeaderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Leader/Director" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-background">
                    {bandMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="edit-description">Description (optional)</Label>
                <Textarea
                  id="edit-description"
                  value={newSetlistDescription}
                  onChange={(e) => setNewSetlistDescription(e.target.value)}
                  placeholder="Add any notes about this setlist..."
                  rows={2}
                />
              </div>

              <Button onClick={updateSetlist} className="w-full">
                Update Setlist
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Restore Setlist Dialog */}
        <Dialog open={showRestoreDialog} onOpenChange={(open) => {
          setShowRestoreDialog(open);
          if (!open) {
            setRestoringSetlist(null);
            setRestoreDate("");
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Restore Setlist</DialogTitle>
              <DialogDescription>
                Set a new event date to restore "{restoringSetlist?.title}" from the archive
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="restore-date">New Event Date</Label>
                <Input
                  id="restore-date"
                  type="date"
                  value={restoreDate}
                  onChange={(e) => setRestoreDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowRestoreDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={restoreSetlist} className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
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
        <>
        {/* Bulk Delete Bar */}
        {getArchivedSetlistIds().length > 0 && (
          <div className="flex items-center justify-between bg-muted/50 border rounded-lg p-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {selectedForBulkDelete.size > 0 ? (
                  <>{selectedForBulkDelete.size} archived setlist{selectedForBulkDelete.size > 1 ? 's' : ''} selected</>
                ) : (
                  <>Select archived setlists to delete</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedForBulkDelete.size > 0 ? (
                <>
                  <Button variant="ghost" size="sm" onClick={clearBulkSelection}>
                    Clear
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => setShowBulkDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Selected
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={selectAllArchived}>
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Select All Archived
                </Button>
              )}
            </div>
          </div>
        )}
        {[...setlists]
          .filter((setlist) => {
            if (filterBy === 'all') return true;
            if (!setlist.event_date) return filterBy === 'upcoming'; // No date = show in upcoming
            const eventDate = new Date(setlist.event_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            eventDate.setHours(0, 0, 0, 0);
            if (filterBy === 'upcoming') {
              return eventDate >= today;
            } else {
              return eventDate < today;
            }
          })
          .sort((a, b) => {
            if (sortBy === 'name') {
              return a.title.localeCompare(b.title);
            } else if (sortBy === 'date') {
              // Sort by event date, upcoming first (no date goes to end)
              if (!a.event_date && !b.event_date) return 0;
              if (!a.event_date) return 1;
              if (!b.event_date) return -1;
              return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
            } else {
              // Sort by created (newest first) - default
              return 0; // Already sorted by created_at desc from fetch
            }
          }).map((setlist) => {
            const isPast = setlist.event_date && (() => {
              const eventDate = new Date(setlist.event_date);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              eventDate.setHours(0, 0, 0, 0);
              return eventDate < today;
            })();
            
            return (
          <Card key={setlist.id} className={`relative overflow-hidden ${isPast ? "opacity-60 bg-muted/30" : ""} ${selectedForBulkDelete.has(setlist.id) ? "ring-2 ring-destructive" : ""}`}>
            {isPast && (
              <div className="absolute top-0 right-0 z-10 flex items-center">
                {/* Bulk Select Checkbox for Archived */}
                <button
                  onClick={() => toggleBulkDeleteSelection(setlist.id)}
                  className="p-1.5 hover:bg-muted/80 transition-colors"
                  title={selectedForBulkDelete.has(setlist.id) ? "Deselect" : "Select for bulk delete"}
                >
                  {selectedForBulkDelete.has(setlist.id) ? (
                    <CheckSquare className="h-4 w-4 text-destructive" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <div className="flex items-center gap-1 bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-bl-lg border-l border-b border-border">
                  <Archive className="h-3 w-3" />
                  <span>Archived</span>
                </div>
              </div>
            )}
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-muted-foreground">For:</span>
                      {setlist.title}
                    </CardTitle>
                    {setlist.event_date && (() => {
                      const eventDate = new Date(setlist.event_date);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      eventDate.setHours(0, 0, 0, 0);
                      const diffTime = eventDate.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      
                      if (diffDays < 0) {
                        return <Badge variant="secondary" className="text-xs">Past</Badge>;
                      } else if (diffDays === 0) {
                        return <Badge className="text-xs bg-green-500 hover:bg-green-600">Today</Badge>;
                      } else if (diffDays <= 7) {
                        return <Badge className="text-xs bg-amber-500 hover:bg-amber-600">In {diffDays} day{diffDays > 1 ? 's' : ''}</Badge>;
                      } else {
                        return <Badge variant="outline" className="text-xs">Upcoming</Badge>;
                      }
                    })()}
                  </div>
                  {setlist.description && (
                    <CardDescription className="mt-1">{setlist.description}</CardDescription>
                  )}
                  {/* Event Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                    {setlist.event_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(setlist.event_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    )}
                    {setlist.event_time && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{setlist.event_time}</span>
                      </div>
                    )}
                    {setlist.call_time && (
                      <div className="flex items-center gap-1 text-primary/80">
                        <span className="font-medium">Call:</span>
                        <span>{setlist.call_time}</span>
                      </div>
                    )}
                    {setlist.address && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[200px]">{setlist.address}</span>
                      </div>
                    )}
                  </div>
                  {/* Rehearsal Info */}
                  {(setlist.rehearsal_date || setlist.rehearsal_time) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground/70">
                      <span className="font-medium">Rehearsal:</span>
                      {setlist.rehearsal_date && (
                        <span>{new Date(setlist.rehearsal_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      )}
                      {setlist.rehearsal_time && <span>at {setlist.rehearsal_time}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isPast && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openRestoreDialog(setlist)}
                      title="Restore setlist"
                      className="text-primary hover:text-primary"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openShareDialog(setlist.id)}
                    title="Share setlist"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => exportSetlistToPdf(setlist)}
                    title="Export to PDF"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(setlist)}
                    title="Edit setlist"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/schedule-reminder?type=setlist&eventId=${setlist.id}&name=${encodeURIComponent(setlist.title)}`)}
                    title="Schedule reminder"
                  >
                    <Bell className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDeleteDialog(setlist)}
                    title="Delete setlist"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
            );
          })
        }
        </>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Setlist</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingSetlist?.title}"? This action cannot be undone and all songs in this setlist will be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteSetlist}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedForBulkDelete.size} Archived Setlist{selectedForBulkDelete.size > 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedForBulkDelete.size} archived setlist{selectedForBulkDelete.size > 1 ? 's' : ''}? This action cannot be undone and all songs in these setlists will be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={bulkDeleteSetlists}>
              Delete All
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Setlist Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Setlist
            </DialogTitle>
            <DialogDescription>
              Create a shareable link for group members to view this setlist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!shareLink ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Generate a link that anyone can use to view this setlist (read-only).
                </p>
                <Button onClick={generateShareLink} disabled={generatingShare}>
                  {generatingShare ? "Generating..." : "Generate Share Link"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input 
                    value={shareLink} 
                    readOnly 
                    className="text-sm"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={copyShareLink}
                    title="Copy link"
                  >
                    {linkCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Anyone with this link can view the setlist details and song list.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
