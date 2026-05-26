import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Trash2, 
  Edit, 
  Search,
  UserPlus,
  Users,
  Calendar,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import BottomNav from "@/components/BottomNav";

interface ManagedArtist {
  id: string;
  artist_id: string;
  group_type: string | null;
  notes: string | null;
  created_at: string;
  profile: {
    id: string;
    name: string;
    email: string;
    phone_number: string | null;
    instrument: string | null;
  };
}

interface UpcomingGig {
  id: string;
  date: string;
  venue: string;
  venue_name: string | null;
  status: string;
  artist_name: string;
  artist_id: string;
}

export default function BookingManagerAdmin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const artistFilter = searchParams.get("artist");
  const { toast } = useToast();
  const [managedArtists, setManagedArtists] = useState<ManagedArtist[]>([]);
  const [upcomingGigs, setUpcomingGigs] = useState<UpcomingGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [gigSearchTerm, setGigSearchTerm] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  
  // Edit artist dialog
  const [editingArtist, setEditingArtist] = useState<ManagedArtist | null>(null);
  const [editForm, setEditForm] = useState({
    group_type: "",
    notes: "",
  });
  
  // Delete confirmation
  const [deleteConfirmArtist, setDeleteConfirmArtist] = useState<ManagedArtist | null>(null);

  useEffect(() => {
    checkRoleAndFetchData();
  }, []);

  const checkRoleAndFetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      // Check if user is a booking manager
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "booking_manager")
        .maybeSingle();

      if (!roleData) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You don't have permission to access this page.",
        });
        navigate("/dashboard");
        return;
      }

      await Promise.all([
        fetchManagedArtists(user.id),
        fetchUpcomingGigs(user.id)
      ]);
    } catch (error: any) {
      console.error("Error checking role:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchManagedArtists = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("booking_manager_artists")
        .select(`
          id,
          artist_id,
          group_type,
          notes,
          created_at
        `)
        .eq("booking_manager_id", uid)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for each artist
      if (data && data.length > 0) {
        const artistIds = data.map(a => a.artist_id);
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name, email, phone_number, instrument")
          .in("id", artistIds);

        if (profilesError) throw profilesError;

        const artistsWithProfiles = data.map(artist => ({
          ...artist,
          profile: profiles?.find(p => p.id === artist.artist_id) || {
            id: artist.artist_id,
            name: "Unknown",
            email: "",
            phone_number: null,
            instrument: null
          }
        }));

        setManagedArtists(artistsWithProfiles);
      } else {
        setManagedArtists([]);
      }
    } catch (error: any) {
      console.error("Error fetching managed artists:", error);
      toast({
        variant: "destructive",
        title: "Error fetching artists",
        description: error.message,
      });
    }
  };

  const fetchUpcomingGigs = async (uid: string) => {
    try {
      // Get managed artist IDs
      const { data: artistLinks } = await supabase
        .from("booking_manager_artists")
        .select("artist_id")
        .eq("booking_manager_id", uid);

      if (!artistLinks || artistLinks.length === 0) {
        setUpcomingGigs([]);
        return;
      }

      const artistIds = artistLinks.map(a => a.artist_id);

      // Get gigs where managed artists are members
      const { data: gigMembers, error: gmError } = await supabase
        .from("gig_members")
        .select(`
          member_id,
          gigs (
            id,
            date,
            venue,
            venue_name,
            status
          )
        `)
        .in("member_id", artistIds)
        .eq("status", "accepted");

      if (gmError) throw gmError;

      // Fetch profiles for artist names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", artistIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

      // Transform and filter future gigs
      const today = new Date().toISOString().split('T')[0];
      const gigs: UpcomingGig[] = (gigMembers || [])
        .filter((gm: any) => gm.gigs && gm.gigs.date >= today)
        .map((gm: any) => ({
          id: gm.gigs.id,
          date: gm.gigs.date,
          venue: gm.gigs.venue,
          venue_name: gm.gigs.venue_name,
          status: gm.gigs.status,
          artist_name: profileMap.get(gm.member_id) || "Unknown",
          artist_id: gm.member_id,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setUpcomingGigs(gigs);
    } catch (error: any) {
      console.error("Error fetching upcoming gigs:", error);
    }
  };

  const handleEditArtist = (artist: ManagedArtist) => {
    setEditingArtist(artist);
    setEditForm({
      group_type: artist.group_type || "",
      notes: artist.notes || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingArtist) return;

    try {
      const { error } = await supabase
        .from("booking_manager_artists")
        .update({
          group_type: editForm.group_type || null,
          notes: editForm.notes || null,
        })
        .eq("id", editingArtist.id);

      if (error) throw error;

      toast({
        title: "Artist updated",
        description: `${editingArtist.profile.name}'s details have been updated.`,
      });

      setEditingArtist(null);
      if (userId) await fetchManagedArtists(userId);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating artist",
        description: error.message,
      });
    }
  };

  const handleRemoveArtist = async () => {
    if (!deleteConfirmArtist) return;

    try {
      const { error } = await supabase
        .from("booking_manager_artists")
        .delete()
        .eq("id", deleteConfirmArtist.id);

      if (error) throw error;

      toast({
        title: "Artist removed",
        description: `${deleteConfirmArtist.profile.name} has been removed from your roster.`,
      });

      setDeleteConfirmArtist(null);
      if (userId) {
        await Promise.all([
          fetchManagedArtists(userId),
          fetchUpcomingGigs(userId)
        ]);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error removing artist",
        description: error.message,
      });
    }
  };

  const filteredArtists = managedArtists.filter(
    (artist) =>
      artist.profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      artist.profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (artist.group_type && artist.group_type.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredGigs = upcomingGigs.filter(
    (gig) => {
      const matchesSearch = gig.venue.toLowerCase().includes(gigSearchTerm.toLowerCase()) ||
        gig.artist_name.toLowerCase().includes(gigSearchTerm.toLowerCase()) ||
        (gig.venue_name && gig.venue_name.toLowerCase().includes(gigSearchTerm.toLowerCase()));
      const matchesArtist = !artistFilter || gig.artist_id === artistFilter;
      return matchesSearch && matchesArtist;
    }
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden">
      <TopNav userRole="booking_manager" />
      <main className="container mx-auto px-3 sm:px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Booking Manager Admin</h1>
          <p className="text-muted-foreground">Manage your artists and upcoming gigs</p>
        </div>

        <Tabs defaultValue={artistFilter ? "gigs" : "artists"} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="artists" className="gap-2">
              <Users className="h-4 w-4" />
              My Artists
            </TabsTrigger>
            <TabsTrigger value="gigs" className="gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Gigs
            </TabsTrigger>
          </TabsList>

          {/* Artists Tab */}
          <TabsContent value="artists">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Managed Artists</h2>
                <p className="text-sm text-muted-foreground">{managedArtists.length} artists in your roster</p>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button onClick={() => navigate("/artists")} size="sm" className="gap-1 flex-shrink-0">
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Artist</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </div>
            </div>

            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="hidden md:table-cell">Phone</TableHead>
                      <TableHead className="hidden lg:table-cell">Instrument</TableHead>
                      <TableHead className="hidden sm:table-cell">Group Type</TableHead>
                      <TableHead className="hidden lg:table-cell">Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredArtists.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No artists in your roster yet. Add artists from the Discover page.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredArtists.map((artist) => (
                        <TableRow key={artist.id}>
                          <TableCell className="font-medium">{artist.profile.name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{artist.profile.email}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {artist.profile.phone_number || "—"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {artist.profile.instrument || "—"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {artist.group_type ? (
                              <Badge variant="outline">{artist.group_type}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {new Date(artist.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditArtist(artist)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirmArtist(artist)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Gigs Tab */}
          <TabsContent value="gigs">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold">Upcoming Gigs</h2>
                <p className="text-sm text-muted-foreground">{upcomingGigs.length} upcoming gigs for your artists</p>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search gigs..."
                  value={gigSearchTerm}
                  onChange={(e) => setGigSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>Artist</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGigs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No upcoming gigs for your artists.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGigs.map((gig) => (
                        <TableRow key={`${gig.id}-${gig.artist_id}`}>
                          <TableCell className="font-medium">
                            {new Date(gig.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </TableCell>
                          <TableCell>
                            <div>
                              {gig.venue_name && <div className="font-medium">{gig.venue_name}</div>}
                              <div className="text-muted-foreground text-sm">{gig.venue}</div>
                            </div>
                          </TableCell>
                          <TableCell>{gig.artist_name}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                gig.status === "confirmed" ? "default" :
                                gig.status === "pending" ? "secondary" : "outline"
                              }
                            >
                              {gig.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Artist Dialog */}
        <Dialog open={!!editingArtist} onOpenChange={() => setEditingArtist(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Artist Details</DialogTitle>
              <DialogDescription>
                Update the details for {editingArtist?.profile.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group_type">Group Type</Label>
                <Input
                  id="group_type"
                  value={editForm.group_type}
                  onChange={(e) => setEditForm({ ...editForm, group_type: e.target.value })}
                  placeholder="e.g., Solo, Duo, Trio, Band"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Add any notes about this artist..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingArtist(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmArtist} onOpenChange={() => setDeleteConfirmArtist(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Artist</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove {deleteConfirmArtist?.profile.name} from your roster?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmArtist(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRemoveArtist}>
                Remove Artist
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <BottomNav />
    </div>
  );
}