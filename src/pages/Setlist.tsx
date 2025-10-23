import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBand } from "@/contexts/BandContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, ArrowLeft, Play, Pause, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import { SetlistManager } from "@/components/SetlistManager";
import { YouTubePlayer } from "@/components/YouTubePlayer";

interface SetlistSong {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string | null;
  order_index: number;
  set_number: number;
}

interface Setlist {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  songs: SetlistSong[];
}

const Setlist = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedBandId } = useBand();
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string } | null>(null);
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
      
      fetchSetlists();
    };

    checkAuth();
  }, [navigate, selectedBandId]);

  const fetchSetlists = async () => {
    try {
      // Fetch setlists filtered by selected band
      let query = supabase
        .from("setlists")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (selectedBandId) {
        query = query.eq("band_id", selectedBandId);
      }
      
      const { data: setlistsData, error: setlistsError } = await query;

      if (setlistsError) throw setlistsError;

      // Fetch songs for each setlist
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

  const extractVideoId = (url: string): string | null => {
    if (!url) return null;
    
    try {
      const cleanUrl = url.trim();
      const u = new URL(cleanUrl);
      const host = u.hostname.toLowerCase().replace('www.', '');
      let id = "";

      if (host === "youtu.be") {
        id = u.pathname.substring(1).split('?')[0];
      } else if (host.includes("youtube.com")) {
        if (u.pathname === "/watch") {
          id = u.searchParams.get("v") || "";
        } else if (u.pathname.startsWith("/shorts/")) {
          id = u.pathname.split("/")[2] || "";
        } else if (u.pathname.startsWith("/embed/")) {
          id = u.pathname.split("/")[2] || "";
        } else if (u.pathname.startsWith("/v/")) {
          id = u.pathname.split("/")[2] || "";
        }
      }
      
      id = id.split('&')[0].split('?')[0];
      
      if (!id || id.length < 10) {
        return null;
      }

      return id;
    } catch (error) {
      console.error('[Setlist] Error parsing YouTube URL:', error);
      return null;
    }
  };

  const handlePlayPause = (song: SetlistSong) => {
    if (!song.audio_url) {
      toast({
        variant: "destructive",
        title: "No audio available",
        description: "This song doesn't have an audio file yet.",
      });
      return;
    }

    // If already playing this song, pause it
    if (playingSongId === song.id && playingAudio) {
      playingAudio.pause();
      setPlayingAudio(null);
      setPlayingSongId(null);
      return;
    }

    // Stop any currently playing audio
    if (playingAudio) {
      playingAudio.pause();
    }

    // Play new audio
    const audio = new Audio(song.audio_url);
    audio.play();
    audio.onended = () => {
      setPlayingAudio(null);
      setPlayingSongId(null);
    };
    setPlayingAudio(audio);
    setPlayingSongId(song.id);
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (playingAudio) {
        playingAudio.pause();
      }
    };
  }, [playingAudio]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading setlists...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 pb-20">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Setlists
            </h1>
            <p className="text-muted-foreground mt-1">
              {userRole === "band_leader" 
                ? "Manage and upload setlists for your band" 
                : "View and play songs from your band's setlists"}
            </p>
          </div>
        </div>

        {userRole === "band_leader" ? (
          <Card className="border-border/20 shadow-lg">
            <CardContent className="pt-6">
              <SetlistManager />
            </CardContent>
          </Card>
        ) : (
          <>
            {setlists.length === 0 ? (
              <Card className="border-border/20 shadow-lg">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No setlists available yet. Your band leader will upload them soon!
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              setlists.map((setlist) => (
            <Card key={setlist.id} className="border-border/20 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-muted-foreground">For:</span>
                  {setlist.title}
                </CardTitle>
                {setlist.description && (
                  <CardDescription>{setlist.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {setlist.songs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No songs in this setlist yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((setNum) => {
                      const setSongs = setlist.songs.filter(song => song.set_number === setNum);
                      if (setSongs.length === 0) return null;
                      
                      return (
                         <div key={setNum} className="space-y-1">
                          <h3 className="text-xs font-semibold text-muted-foreground/70 mb-0.5">Set {setNum} ({setSongs.length} songs)</h3>
                          {setSongs.map((song, index) => (
                            <div key={song.id}>
                              <div className="group relative flex items-center justify-between py-1.5 px-2 rounded bg-muted/15 hover:bg-muted/25 transition-colors">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <span className="text-xs text-muted-foreground font-medium w-4 shrink-0">
                                    {index + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate leading-tight">{song.title}</p>
                                    {song.artist && (
                                      <p className="text-[10px] text-muted-foreground truncate leading-tight">{song.artist}</p>
                                    )}
                                  </div>
                                </div>
                                 <div className="flex items-center gap-1 shrink-0">
                                   {song.audio_url && /(youtu\.be|youtube\.com|youtube-nocookie\.com)/i.test(song.audio_url) && (
                                     <Button
                                       variant="default"
                                       size="sm"
                                       className="h-6 text-[10px] px-1.5 py-0"
                                       onClick={async () => {
                                         // Try local extraction first
                                         const localVideoId = extractVideoId(song.audio_url!);
                                         if (localVideoId) {
                                           setPlayingVideo({ videoId: localVideoId, title: song.title });
                                           return;
                                         }

                                         // Fallback to backend for search URLs
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
                                        <Play className="h-2.5 w-2.5 mr-0.5" />
                                        Watch
                                    </Button>
                                   )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] px-1.5 py-0"
                                    onClick={() => navigate(`/setlist/lyrics/${song.id}`)}
                                  >
                                    <FileText className="h-2.5 w-2.5 mr-0.5" />
                                    Lyrics
                                  </Button>
                                    {song.audio_url && !/(youtu\.be|youtube\.com|youtube-nocookie\.com)/i.test(song.audio_url) && (
                                      <Button
                                        size="icon"
                                        className="h-6 w-6"
                                        variant={playingSongId === song.id ? "default" : "ghost"}
                                        onClick={() => handlePlayPause(song)}
                                      >
                                        {playingSongId === song.id ? (
                                          <Pause className="h-2.5 w-2.5" />
                                        ) : (
                                          <Play className="h-2.5 w-2.5" />
                                        )}
                                      </Button>
                                     )}
                                  </div>
                               </div>
                            </div>
                           ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
          </>
        )}
      </div>

      {playingVideo && (
        <YouTubePlayer
          videoId={playingVideo.videoId}
          title={playingVideo.title}
          isOpen={!!playingVideo}
          onClose={() => setPlayingVideo(null)}
        />
      )}

      <BottomNav />
    </div>
  );
};

export default Setlist;
