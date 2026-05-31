import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Eye, Trash2, X, Users, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ManagedArtist {
  id: string;
  artist_id: string;
  group_type: string;
  profile: {
    id: string;
    name: string;
    instrument: string | null;
    photo_urls: string[] | null;
    email: string;
  };
}

interface AvailabilityRequest {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  target_artist_ids: string[];
  response_count?: number;
}

interface ArtistAvailabilityManagerProps {
  managedArtists: ManagedArtist[];
  onViewResponses?: (requestId: string) => void;
}

export const ArtistAvailabilityManager = ({
  managedArtists,
  onViewResponses,
}: ArtistAvailabilityManagerProps) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);

  useEffect(() => {
    fetchRequests();

    // Subscribe to real-time updates for availability responses
    const channel = supabase
      .channel(`availability-responses-artist-manager-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'availability_responses'
        },
        (payload) => {
          console.log('New availability response received:', payload);
          // Update the response count for the affected request
          setRequests(prev => {
            const updatedRequests = prev.map(request => {
              if (request.id === payload.new.request_id) {
                // Show toast for this request
                toast({
                  title: "New Availability Response",
                  description: `An artist responded to "${request.title}"`,
                });
                return {
                  ...request,
                  response_count: (request.response_count || 0) + 1
                };
              }
              return request;
            });
            return updatedRequests;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRequests = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) return;

      const { data, error } = await supabase
        .from("availability_requests")
        .select("*")
        .eq("booking_manager_id", user.id)
        .is("band_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get response counts for each request
      if (data && data.length > 0) {
        const requestIds = data.map(r => r.id);
        const { data: responseCounts } = await supabase
          .from("availability_responses")
          .select("request_id")
          .in("request_id", requestIds);

        const countMap = new Map<string, number>();
        responseCounts?.forEach(r => {
          countMap.set(r.request_id, (countMap.get(r.request_id) || 0) + 1);
        });

        const requestsWithCounts = data.map(r => ({
          ...r,
          response_count: countMap.get(r.id) || 0
        }));

        setRequests(requestsWithCounts);
      } else {
        setRequests([]);
      }
    } catch (error: any) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleArtist = (artistId: string) => {
    setSelectedArtists((prev) =>
      prev.includes(artistId)
        ? prev.filter((id) => id !== artistId)
        : [...prev, artistId]
    );
  };

  const selectAllArtists = () => {
    if (selectedArtists.length === managedArtists.length) {
      setSelectedArtists([]);
    } else {
      setSelectedArtists(managedArtists.map((a) => a.artist_id));
    }
  };

  const handleCreate = async () => {
    if (!title || !startDate || !endDate || selectedArtists.length === 0) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields and select at least one artist.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      const { data: request, error } = await supabase
        .from("availability_requests")
        .insert({
          booking_manager_id: user.id,
          created_by: user.id,
          title,
          description: description || null,
          start_date: startDate,
          end_date: endDate,
          target_artist_ids: selectedArtists,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;

      // Send notifications if enabled
      if (notifyEmail || notifySms) {
        try {
          await supabase.functions.invoke("notify-availability-request", {
            body: {
              request_id: request.id,
              member_ids: selectedArtists,
              notify_email: notifyEmail,
              notify_sms: notifySms,
            },
          });
        } catch (notifyError) {
          console.error("Notification error:", notifyError);
        }
      }

      toast({
        title: "Request created",
        description: `Availability request sent to ${selectedArtists.length} artist(s).`,
      });

      // Reset form
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setSelectedArtists([]);
      setDialogOpen(false);
      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteRequest = async (id: string) => {
    try {
      const { error } = await supabase
        .from("availability_requests")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Request deleted",
        description: "The availability request has been removed.",
      });

      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getArtistNames = (artistIds: string[]) => {
    return artistIds
      .map((id) => managedArtists.find((a) => a.artist_id === id)?.profile.name)
      .filter(Boolean)
      .join(", ");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Artist Availability Requests
            </CardTitle>
            <CardDescription>
              Request availability from artists in your roster
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Availability Request</DialogTitle>
                <DialogDescription>
                  Send an availability request to artists in your roster
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., New Year's Eve Event"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Additional details about the event..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Select Artists *</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectAllArtists}
                    >
                      {selectedArtists.length === managedArtists.length
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                  </div>
                  <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                    {managedArtists.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No artists in your roster yet
                      </p>
                    ) : (
                      managedArtists.map((artist) => (
                        <div
                          key={artist.artist_id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                        >
                          <Checkbox
                            id={artist.artist_id}
                            checked={selectedArtists.includes(artist.artist_id)}
                            onCheckedChange={() => toggleArtist(artist.artist_id)}
                          />
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-muted">
                            {artist.profile.photo_urls?.[0] ? (
                              <img
                                src={artist.profile.photo_urls[0]}
                                alt={artist.profile.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Users className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <label
                            htmlFor={artist.artist_id}
                            className="flex-1 cursor-pointer"
                          >
                            <p className="text-sm font-medium">{artist.profile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {artist.group_type} • {artist.profile.instrument || "No instrument"}
                            </p>
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedArtists.length} artist(s) selected
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Notifications</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="notifyEmail"
                        checked={notifyEmail}
                        onCheckedChange={(checked) => setNotifyEmail(checked as boolean)}
                      />
                      <label htmlFor="notifyEmail" className="text-sm">
                        Email
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="notifySms"
                        checked={notifySms}
                        onCheckedChange={(checked) => setNotifySms(checked as boolean)}
                      />
                      <label htmlFor="notifySms" className="text-sm">
                        SMS
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Create Request
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No availability requests yet. Create one to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{request.title}</p>
                    <Badge
                      variant={request.status === "open" ? "default" : "secondary"}
                    >
                      {request.status}
                    </Badge>
                    {request.response_count !== undefined && request.response_count > 0 && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Users className="h-3 w-3 mr-1" />
                        {request.response_count} response{request.response_count !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(request.start_date).toLocaleDateString()} -{" "}
                    {new Date(request.end_date).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Artists: {getArtistNames(request.target_artist_ids || [])}
                  </p>
                </div>
                <div className="flex gap-2">
                  {onViewResponses && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewResponses(request.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteRequest(request.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
