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
import { CalendarPlus, Calendar, Users, Loader2, Eye, Trash2, Mail, MessageSquare } from "lucide-react";
import { format, differenceInDays } from "date-fns";

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
                  <p className="text-xs text-muted-foreground">
                    {selectedMembers.length} of {bandMembers.length} member(s) selected
                  </p>
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
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{request.title}</h4>
                        <Badge variant={request.status === "open" ? "default" : "secondary"}>
                          {request.status}
                        </Badge>
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
                      <div className="flex items-center gap-1 mt-2 text-sm">
                        <Users className="h-4 w-4" />
                        <span>{request.response_count} response{request.response_count !== 1 ? "s" : ""}</span>
                      </div>
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
    </Card>
  );
}
