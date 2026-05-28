import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Trash2, 
  Edit, 
  Search,
  ArrowLeft,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";

type AppRole = "band_leader" | "band_member" | "booking_manager" | "artist" | "tour_manager" | "venue_owner" | "super_admin";

interface UserWithRole {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  instrument: string | null;
  created_at: string | null;
  role: AppRole | null;
  bandNames: string[];
  entertainer_categories?: string[] | null;
  subscription_status?: string | null;
}

interface BandWithMembers {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  band_leader_id: string;
  memberCount: number;
}

const roleLabels: Record<AppRole, string> = {
  super_admin: "admin",
  band_leader: "leader",
  band_member: "member",
  booking_manager: "manager",
  artist: "artist",
  tour_manager: "tour mgr",
  venue_owner: "venue",
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [bands, setBands] = useState<BandWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [entertainerSearchTerm, setEntertainerSearchTerm] = useState("");
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserWithRole | null>(null);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<BandWithMembers | null>(null);
  const [editingGroup, setEditingGroup] = useState<BandWithMembers | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone_number: "",
    role: "" as AppRole | "",
  });
  const [groupEditForm, setGroupEditForm] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    checkSuperAdminAndFetchData();
  }, []);

  const checkSuperAdminAndFetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) {
        navigate("/auth");
        return;
      }

      // Allow super_admin or booking_manager to access
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["super_admin", "booking_manager"]);

      if (!roleData || roleData.length === 0) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You don't have permission to access this page.",
        });
        navigate("/dashboard");
        return;
      }

      setIsSuperAdmin(true);
      await Promise.all([fetchUsers(), fetchBands()]);
    } catch (error: any) {
      console.error("Error checking admin status:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Fetch band memberships
      const { data: bandMembers, error: bandMembersError } = await supabase
        .from("band_members")
        .select("member_id, band_id, bands(name)");

      if (bandMembersError) throw bandMembersError;

      // Fetch bands for leaders
      const { data: allBands, error: bandsError } = await supabase
        .from("bands")
        .select("id, name, band_leader_id");

      if (bandsError) throw bandsError;

      // Fetch entertainer subscriptions
      const { data: entSubs } = await supabase
        .from("entertainer_subscribers")
        .select("user_id, status");

      // Combine profiles with roles and band names
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        
        // Get bands where user is a member
        const memberBands = bandMembers
          ?.filter((bm) => bm.member_id === profile.id)
          .map((bm) => (bm.bands as any)?.name)
          .filter(Boolean) || [];
        
        // Get bands where user is the leader
        const leaderBands = allBands
          ?.filter((b) => b.band_leader_id === profile.id)
          .map((b) => b.name) || [];
        
        // Combine and deduplicate band names
        const allBandNames = [...new Set([...memberBands, ...leaderBands])];

        const sub = entSubs?.find((s) => s.user_id === profile.id);

        return {
          ...profile,
          role: userRole?.role as AppRole || null,
          bandNames: allBandNames,
          entertainer_categories: (profile as any).entertainer_categories || [],
          subscription_status: sub?.status || null,
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        variant: "destructive",
        title: "Error fetching users",
        description: error.message,
      });
    }
  };

  const fetchBands = async () => {
    try {
      // Fetch all bands
      const { data: bandsData, error: bandsError } = await supabase
        .from("bands")
        .select("*")
        .order("created_at", { ascending: false });

      if (bandsError) throw bandsError;

      // Fetch member counts
      const { data: membersData, error: membersError } = await supabase
        .from("band_members")
        .select("band_id");

      if (membersError) throw membersError;

      // Calculate member count for each band
      const bandsWithMembers: BandWithMembers[] = (bandsData || []).map((band) => {
        const memberCount = membersData?.filter((m) => m.band_id === band.id).length || 0;
        return {
          ...band,
          memberCount,
        };
      });

      setBands(bandsWithMembers);
    } catch (error: any) {
      console.error("Error fetching bands:", error);
      toast({
        variant: "destructive",
        title: "Error fetching groups",
        description: error.message,
      });
    }
  };

  const handleEditUser = (user: UserWithRole) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      phone_number: user.phone_number || "",
      role: user.role || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          name: editForm.name,
          phone_number: editForm.phone_number || null,
        })
        .eq("id", editingUser.id);

      if (profileError) throw profileError;

      // Update role if changed
      if (editForm.role && editForm.role !== editingUser.role) {
        // Delete existing role
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", editingUser.id);

        // Insert new role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: editingUser.id,
            role: editForm.role,
          });

        if (roleError) throw roleError;
      }

      toast({
        title: "User updated",
        description: `${editForm.name}'s profile has been updated.`,
      });

      setEditingUser(null);
      await fetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating user",
        description: error.message,
      });
    }
  };

  const handleUpdateRole = async (user: UserWithRole, newRole: AppRole) => {
    try {
      await supabase.from("user_roles").delete().eq("user_id", user.id);
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role: newRole });
      if (error) throw error;
      toast({ title: "Role updated", description: `${user.name} is now ${roleLabels[newRole]}.` });
      await fetchUsers();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error updating role", description: error.message });
    }
  };

  const handleUpdateBand = async (user: UserWithRole, newBandId: string) => {
    try {
      // Remove existing band memberships
      await supabase.from("band_members").delete().eq("member_id", user.id);

      if (newBandId && newBandId !== "__none__") {
        const { error } = await supabase
          .from("band_members")
          .insert({ member_id: user.id, band_id: newBandId });
        if (error) throw error;
      }
      toast({ title: "Group updated", description: `${user.name}'s group has been updated.` });
      await Promise.all([fetchUsers(), fetchBands()]);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error updating group", description: error.message });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;

    try {
      // Delete user role first
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", deleteConfirmUser.id);

      // Delete profile
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", deleteConfirmUser.id);

      if (error) throw error;

      toast({
        title: "User deleted",
        description: `${deleteConfirmUser.name} has been removed.`,
      });

      setDeleteConfirmUser(null);
      await fetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting user",
        description: error.message,
      });
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteConfirmGroup) return;

    try {
      // Delete band members first
      await supabase
        .from("band_members")
        .delete()
        .eq("band_id", deleteConfirmGroup.id);

      // Delete the band
      const { error } = await supabase
        .from("bands")
        .delete()
        .eq("id", deleteConfirmGroup.id);

      if (error) throw error;

      toast({
        title: "Group deleted",
        description: `${deleteConfirmGroup.name} has been removed.`,
      });

      setDeleteConfirmGroup(null);
      await Promise.all([fetchBands(), fetchUsers()]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting group",
        description: error.message,
      });
    }
  };

  const handleEditGroup = (group: BandWithMembers) => {
    setEditingGroup(group);
    setGroupEditForm({
      name: group.name,
      description: group.description || "",
    });
  };

  const handleSaveGroupEdit = async () => {
    if (!editingGroup) return;

    try {
      const { error } = await supabase
        .from("bands")
        .update({
          name: groupEditForm.name,
          description: groupEditForm.description || null,
        })
        .eq("id", editingGroup.id);

      if (error) throw error;

      toast({
        title: "Group updated",
        description: `${groupEditForm.name} has been updated.`,
      });

      setEditingGroup(null);
      await Promise.all([fetchBands(), fetchUsers()]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating group",
        description: error.message,
      });
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.role && roleLabels[user.role].toLowerCase().includes(searchTerm.toLowerCase())) ||
      user.bandNames.some((bn) => bn.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const entertainers = users.filter(
    (u) =>
      u.role === "artist" ||
      u.role === "band_member" ||
      u.role === "band_leader" ||
      (u.entertainer_categories && u.entertainer_categories.length > 0) ||
      !!u.subscription_status
  );

  const filteredEntertainers = entertainers.filter(
    (user) =>
      user.name.toLowerCase().includes(entertainerSearchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(entertainerSearchTerm.toLowerCase()) ||
      (user.entertainer_categories || []).some((c) => c.toLowerCase().includes(entertainerSearchTerm.toLowerCase()))
  );

  const filteredBands = bands.filter(
    (band) =>
      band.name.toLowerCase().includes(groupSearchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav userRole="super_admin" />
      <main className="container mx-auto px-4 py-6 pb-24">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold">All Entertainers</h2>
          <p className="text-muted-foreground">{entertainers.length} entertainers total</p>
        </div>

        <div className="flex justify-end mb-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search entertainers..."
              value={entertainerSearchTerm}
              onChange={(e) => setEntertainerSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntertainers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <input type="checkbox" className="h-4 w-4 rounded border-muted-foreground/40" />
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">{user.phone_number || "—"}</TableCell>
                    <TableCell>
                      {user.bandNames.length > 0
                        ? user.bandNames.join(", ")
                        : <span className="text-muted-foreground">No Group</span>}
                    </TableCell>
                    <TableCell>
                      {user.role ? (
                        <Badge variant="outline">{roleLabels[user.role]}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">none</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteConfirmUser(user)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEntertainers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No entertainers found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user profile and role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={editForm.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                value={editForm.phone_number}
                onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select
                value={editForm.role}
                onValueChange={(value) => setEditForm({ ...editForm, role: value as AppRole })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="band_leader">Band Leader</SelectItem>
                  <SelectItem value="band_member">Band Member</SelectItem>
                  <SelectItem value="booking_manager">Booking Manager</SelectItem>
                  <SelectItem value="artist">Artist</SelectItem>
                  <SelectItem value="tour_manager">Tour Manager</SelectItem>
                  <SelectItem value="venue_owner">Venue Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmUser} onOpenChange={() => setDeleteConfirmUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteConfirmUser?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmUser(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation Dialog */}
      <Dialog open={!!deleteConfirmGroup} onOpenChange={() => setDeleteConfirmGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmGroup?.name}"? This will remove the group and all member associations. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmGroup(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteGroup}>
              Delete Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>
              Update group name and description
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Group Name</label>
              <Input
                value={groupEditForm.name}
                onChange={(e) => setGroupEditForm({ ...groupEditForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={groupEditForm.description}
                onChange={(e) => setGroupEditForm({ ...groupEditForm, description: e.target.value })}
                placeholder="Enter group description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroupEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
