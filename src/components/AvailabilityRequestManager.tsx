import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { CalendarPlus, Calendar, Users, Loader2, Eye, Trash2, Mail, MessageSquare, FolderPlus, Folder } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AvailabilityRequest {
  id: string;
  band_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  response_count?: number;
}

interface BandMember {
  id: string;
  member_id: string;
  profiles: {
    id: string;
    name: string;
    email: string;
    phone_number: string | null;
  };
}

interface MemberGroup {
  id: string;
  band_id: string;
  name: string;
  member_ids: string[];
}

interface AvailabilityRequestManagerProps {
  bandId: string;
  onViewResponses?: (requestId: string) => void;
}

export function AvailabilityRequestManager({ bandId, onViewResponses }: AvailabilityRequestManagerProps) {
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberGroups, setMemberGroups] = useState<MemberGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [manageGroupsOpen, setManageGroupsOpen] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchRequests();
    fetchBandMembers();
    fetchMemberGroups();

    // Subscribe to real-time updates for availability responses
    const channel = supabase
      .channel('availability-responses-manager')
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
          setRequests(prev => prev.map(request => {
            if (request.id === payload.new.request_id) {
              return {
                ...request,
                response_count: (request.response_count || 0) + 1
              };
            }
            return request;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bandId]);

  const fetchBandMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("band_members")
        .select(`
          id,
          member_id,
          profiles (
            id,
            name,
            email,
            phone_number
          )
        `)
        .eq("band_id", bandId);

      if (error) throw error;
      
      const members = ((data || []) as unknown as BandMember[]).filter(m => m.profiles);
      setBandMembers(members);
      // Select all members by default
      setSelectedMembers(members.map(m => m.member_id));
    } catch (error) {
      console.error("Error fetching band members:", error);
    }
  };

  const fetchMemberGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("member_groups")
        .select("*")
        .eq("band_id", bandId)
        .order("name");

      if (error) throw error;
      setMemberGroups((data || []) as MemberGroup[]);
    } catch (error) {
      console.error("Error fetching member groups:", error);
    }
  };

  const handleSaveGroup = async () => {
    if (!newGroupName.trim()) {
      toast({ title: "Please enter a group name", variant: "destructive" });
      return;
    }
    if (selectedMembers.length === 0) {
      toast({ title: "Please select at least one member", variant: "destructive" });
      return;
    }

    setSavingGroup(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("member_groups")
        .insert({
          band_id: bandId,
          name: newGroupName.trim(),
          member_ids: selectedMembers,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setMemberGroups(prev => [...prev, data as MemberGroup].sort((a, b) => a.name.localeCompare(b.name)));
      setNewGroupName("");
      toast({ title: `Group "${newGroupName.trim()}" saved!` });
    } catch (error: any) {
      console.error("Error saving group:", error);
      toast({ title: "Error saving group", description: error.message, variant: "destructive" });
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from("member_groups")
        .delete()
        .eq("id", groupId);

      if (error) throw error;

      setMemberGroups(prev => prev.filter(g => g.id !== groupId));
      toast({ title: "Group deleted" });
    } catch (error: any) {
      console.error("Error deleting group:", error);
      toast({ title: "Error deleting group", variant: "destructive" });
    }
  };

  const handleSelectGroup = (groupId: string) => {
    const group = memberGroups.find(g => g.id === groupId);
    if (group) {
      // Filter to only include members that are still in the band
      const validMemberIds = group.member_ids.filter(id => 
        bandMembers.some(m => m.member_id === id)
      );
      setSelectedMembers(validMemberIds);
    }
  };

  const fetchRequests = async () => {
    try {
      const { data: requestsData, error } = await supabase
        .from("availability_requests")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get response counts for each request
      if (requestsData && requestsData.length > 0) {
        const requestIds = requestsData.map(r => r.id);
        const { data: responseCounts } = await supabase
          .from("availability_responses")
          .select("request_id")
          .in("request_id", requestIds);

        const countMap = new Map<string, number>();
        responseCounts?.forEach(r => {
          countMap.set(r.request_id, (countMap.get(r.request_id) || 0) + 1);
        });

        const requestsWithCounts = requestsData.map(r => ({
          ...r,
          response_count: countMap.get(r.id) || 0
        }));

        setRequests(requestsWithCounts);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title || !startDate || !endDate) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    if (selectedMembers.length === 0) {
      toast({ title: "Please select at least one member", variant: "destructive" });
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast({ title: "End date must be after start date", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("availability_requests")
        .insert({
          band_id: bandId,
          created_by: user.id,
          title,
          description: description || null,
          start_date: startDate,
          end_date: endDate,
          status: "open"
        })
        .select()
        .single();

      if (error) throw error;

      // Send notifications to band members
      const notify_via: ('email' | 'sms')[] = [];
      if (notifyEmail) notify_via.push('email');
      if (notifySms) notify_via.push('sms');

      if (notify_via.length > 0) {
        try {
          const { data: notifyResult, error: notifyError } = await supabase.functions.invoke(
            'notify-availability-request',
            {
              body: {
                request_id: data.id,
                band_id: bandId,
                title,
                description: description || undefined,
                start_date: startDate,
                end_date: endDate,
                notify_via,
                member_ids: selectedMembers
              }
            }
          );

          if (notifyError) {
            console.error('Notification error:', notifyError);
            toast({ 
              title: "Request created, but notifications failed", 
              description: "Members can still see the request in their dashboard",
              variant: "destructive" 
            });
          } else {
            console.log('Notification results:', notifyResult);
            const methods = [];
            if (notifyResult?.results?.emails_sent > 0) methods.push(`${notifyResult.results.emails_sent} email(s)`);
            if (notifyResult?.results?.sms_sent > 0) methods.push(`${notifyResult.results.sms_sent} SMS`);
            
            toast({ 
              title: "Availability request created!", 
              description: methods.length > 0 
                ? `Notified members via ${methods.join(' and ')}`
                : "Members will see it in their dashboard"
            });
          }
        } catch (notifyErr) {
          console.error('Error sending notifications:', notifyErr);
        }
      } else {
        toast({ title: "Availability request created!" });
      }

      setRequests(prev => [{ ...data, response_count: 0 }, ...prev]);
      
      // Reset form
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setNotifyEmail(true);
      setNotifySms(true);
      setSelectedMembers(bandMembers.map(m => m.member_id));
      setDialogOpen(false);
    } catch (error: any) {
      console.error("Error creating request:", error);
      toast({ title: "Error creating request", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("availability_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast({ title: "Request deleted" });
    } catch (error: any) {
      console.error("Error deleting request:", error);
      toast({ title: "Error deleting request", variant: "destructive" });
    }
  };

  const handleCloseRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("availability_requests")
        .update({ status: "closed" })
        .eq("id", requestId);

      if (error) throw error;

      setRequests(prev => prev.map(r => 
        r.id === requestId ? { ...r, status: "closed" } : r
      ));
      toast({ title: "Request closed" });
    } catch (error: any) {
      console.error("Error closing request:", error);
      toast({ title: "Error closing request", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Availability Requests
            </CardTitle>
            <CardDescription>
              Request availability from your band members for upcoming dates
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <CalendarPlus className="h-4 w-4" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Member Availability</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., March Booking Opportunities"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Additional details about these potential bookings..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date *</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date *</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                
                {/* Member Selection */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Select Members *</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedMembers(bandMembers.map(m => m.member_id))}
                        className="text-xs h-7"
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedMembers([])}
                        className="text-xs h-7"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Group Selection Dropdown */}
                  {memberGroups.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <Select onValueChange={handleSelectGroup}>
                        <SelectTrigger className="flex-1 h-8">
                          <SelectValue placeholder="Load from saved group..." />
                        </SelectTrigger>
                        <SelectContent>
                          {memberGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name} ({group.member_ids.length} members)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {bandMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No band members found</p>
                  ) : (
                    <div className="space-y-2 max-h-[150px] overflow-y-auto border rounded-md p-2">
                      {bandMembers.map((member) => (
                        <div key={member.member_id} className="flex items-center gap-2">
                          <Checkbox
                            id={`member-${member.member_id}`}
                            checked={selectedMembers.includes(member.member_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedMembers(prev => [...prev, member.member_id]);
                              } else {
                                setSelectedMembers(prev => prev.filter(id => id !== member.member_id));
                              }
                            }}
                          />
                          <Label 
                            htmlFor={`member-${member.member_id}`} 
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {member.profiles.name}
                            {member.profiles.email && (
                              <span className="text-muted-foreground ml-2 text-xs">
                                ({member.profiles.email})
                              </span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Save Current Selection as Group */}
                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      placeholder="New group name..."
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSaveGroup}
                      disabled={savingGroup || selectedMembers.length === 0}
                      className="gap-1 h-8"
                    >
                      {savingGroup ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FolderPlus className="h-3 w-3" />
                      )}
                      Save Group
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {selectedMembers.length} of {bandMembers.length} member(s) selected
                    </p>
                    {memberGroups.length > 0 && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => setManageGroupsOpen(true)}
                        className="text-xs h-auto p-0"
                      >
                        Manage Groups
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-sm font-medium">Notify Members Via</Label>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="notify-email"
                        checked={notifyEmail}
                        onCheckedChange={(checked) => setNotifyEmail(checked === true)}
                      />
                      <Label htmlFor="notify-email" className="flex items-center gap-1.5 text-sm font-normal cursor-pointer">
                        <Mail className="h-4 w-4" />
                        Email
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="notify-sms"
                        checked={notifySms}
                        onCheckedChange={(checked) => setNotifySms(checked === true)}
                      />
                      <Label htmlFor="notify-sms" className="flex items-center gap-1.5 text-sm font-normal cursor-pointer">
                        <MessageSquare className="h-4 w-4" />
                        SMS
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating} className="gap-2">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No availability requests yet</p>
            <p className="text-sm">Create a request to ask members for their available dates</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const dayCount = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
              return (
                <div
                  key={request.id}
                  className="p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium truncate">{request.title}</h4>
                        <Badge variant={request.status === "open" ? "default" : "secondary"}>
                          {request.status}
                        </Badge>
                        {request.response_count !== undefined && request.response_count > 0 && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <Users className="h-3 w-3 mr-1" />
                            {request.response_count} response{request.response_count !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(request.start_date), "MMM d")} - {format(new Date(request.end_date), "MMM d, yyyy")}
                        <span className="ml-2">({dayCount} days)</span>
                      </p>
                      {request.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {request.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {onViewResponses && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewResponses(request.id)}
                          className="gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      )}
                      {request.status === "open" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCloseRequest(request.id)}
                        >
                          Close
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(request.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Manage Groups Dialog */}
      <Dialog open={manageGroupsOpen} onOpenChange={setManageGroupsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Manage Member Groups
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {memberGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No groups saved yet. Create groups from the availability request form.
              </p>
            ) : (
              memberGroups.map((group) => {
                const memberNames = group.member_ids
                  .map(id => bandMembers.find(m => m.member_id === id)?.profiles.name)
                  .filter(Boolean);
                return (
                  <div
                    key={group.id}
                    className="p-3 border rounded-lg flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{group.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {group.member_ids.length} member(s)
                      </p>
                      {memberNames.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {memberNames.join(", ")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteGroup(group.id)}
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageGroupsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
