import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Music, Calendar, Clock, MapPin, User } from "lucide-react";
import { format } from "date-fns";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  order_index: number;
  set_number: number;
}

interface SharedSetlistData {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  event_time: string | null;
  call_time: string | null;
  address: string | null;
  notes: string | null;
  songs: Song[];
  band_name: string | null;
  music_leader_name: string | null;
}

export default function SharedSetlist() {
  const { token } = useParams<{ token: string }>();
  const [setlistData, setSetlistData] = useState<SharedSetlistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchSharedSetlist();
    }
  }, [token]);

  const fetchSharedSetlist = async () => {
    try {
      // Find the shared setlist by token
      const { data: sharedData, error: sharedError } = await supabase
        .from("shared_setlists")
        .select("setlist_id, is_active, expires_at")
        .eq("share_token", token)
        .maybeSingle();

      if (sharedError) throw sharedError;
      
      if (!sharedData) {
        setError("This shared link is invalid or has expired.");
        setLoading(false);
        return;
      }

      if (!sharedData.is_active) {
        setError("This shared link has been deactivated.");
        setLoading(false);
        return;
      }

      if (sharedData.expires_at && new Date(sharedData.expires_at) < new Date()) {
        setError("This shared link has expired.");
        setLoading(false);
        return;
      }

      // Fetch the setlist details
      const { data: setlist, error: setlistError } = await supabase
        .from("setlists")
        .select(`
          id,
          title,
          description,
          event_date,
          event_time,
          call_time,
          address,
          notes,
          band_id,
          music_leader_id
        `)
        .eq("id", sharedData.setlist_id)
        .maybeSingle();

      if (setlistError) throw setlistError;
      
      if (!setlist) {
        setError("The setlist could not be found.");
        setLoading(false);
        return;
      }

      // Fetch songs
      const { data: songs, error: songsError } = await supabase
        .from("setlist_songs")
        .select("id, title, artist, order_index, set_number")
        .eq("setlist_id", setlist.id)
        .order("set_number", { ascending: true })
        .order("order_index", { ascending: true });

      if (songsError) throw songsError;

      // Fetch band name if available
      let bandName: string | null = null;
      if (setlist.band_id) {
        const { data: band } = await supabase
          .from("groups")
          .select("name")
          .eq("id", setlist.band_id)
          .maybeSingle();
        bandName = band?.name || null;
      }

      // Fetch music leader name if available
      let musicLeaderName: string | null = null;
      if (setlist.music_leader_id) {
        const { data: leader } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", setlist.music_leader_id)
          .maybeSingle();
        musicLeaderName = leader?.name || null;
      }

      setSetlistData({
        ...setlist,
        songs: songs || [],
        band_name: bandName,
        music_leader_name: musicLeaderName,
      });
    } catch (err: any) {
      console.error("Error fetching shared setlist:", err);
      setError("An error occurred while loading the setlist.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Music className="h-12 w-12 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading setlist...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>Setlist Not Available</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!setlistData) return null;

  // Group songs by set number
  const songsBySet = setlistData.songs.reduce((acc, song) => {
    const setNum = song.set_number || 1;
    if (!acc[setNum]) acc[setNum] = [];
    acc[setNum].push(song);
    return acc;
  }, {} as Record<number, Song[]>);

  const setNumbers = Object.keys(songsBySet).map(Number).sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center border-b">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Music className="h-6 w-6 text-primary" />
              {setlistData.band_name && (
                <Badge variant="secondary">{setlistData.band_name}</Badge>
              )}
            </div>
            <CardTitle className="text-2xl">{setlistData.title}</CardTitle>
            {setlistData.description && (
              <CardDescription className="text-base">{setlistData.description}</CardDescription>
            )}
          </CardHeader>
          
          <CardContent className="pt-6">
            {/* Event Details */}
            <div className="space-y-3 mb-6 pb-6 border-b">
              {setlistData.event_date && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(new Date(setlistData.event_date), "EEEE, MMMM d, yyyy")}
                    {setlistData.event_time && ` at ${setlistData.event_time}`}
                  </span>
                </div>
              )}
              
              {setlistData.call_time && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Call Time: {setlistData.call_time}</span>
                </div>
              )}
              
              {setlistData.address && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{setlistData.address}</span>
                </div>
              )}
              
              {setlistData.music_leader_name && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Music Director: {setlistData.music_leader_name}</span>
                </div>
              )}
            </div>

            {/* Songs */}
            <div className="space-y-6">
              {setNumbers.map((setNum) => (
                <div key={setNum}>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Badge variant="outline">Set {setNum}</Badge>
                    <span className="text-muted-foreground text-sm">
                      ({songsBySet[setNum].length} songs)
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {songsBySet[setNum]
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((song, index) => (
                        <div
                          key={song.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <span className="text-muted-foreground font-mono text-sm w-6">
                            {index + 1}.
                          </span>
                          <div className="flex-1">
                            <p className="font-medium">{song.title}</p>
                            {song.artist && (
                              <p className="text-sm text-muted-foreground">{song.artist}</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            {setlistData.notes && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-semibold mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {setlistData.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground mt-4">
          Shared via GigHub
        </p>
      </div>
    </div>
  );
}
