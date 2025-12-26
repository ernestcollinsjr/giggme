import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TopNav } from "@/components/TopNav";
import { 
  ArrowLeft, 
  Bell, 
  Calendar as CalendarIcon,
  Clock,
  Users as UsersIcon,
  Send
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  name: string;
  email: string;
  instrument: string | null;
}

interface MemberGroup {
  id: string;
  name: string;
  member_ids: string[];
}

interface Band {
  id: string;
  name: string;
}

const REMINDER_OPTIONS = [
  { value: "5_minutes", label: "5 minutes before" },
  { value: "15_minutes", label: "15 minutes before" },
  { value: "30_minutes", label: "30 minutes before" },
  { value: "1_hour", label: "1 hour before" },
  { value: "2_hours", label: "2 hours before" },
  { value: "1_day", label: "1 day before" },
  { value: "2_days", label: "2 days before" },
];

export default function ScheduleReminder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const eventType = searchParams.get("type") || "custom";
  const eventId = searchParams.get("eventId");
  const eventName = searchParams.get("name") || "";
  const eventDateParam = searchParams.get("date");
  
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Members and groups
  const [members, setMembers] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [bands, setBands] = useState<Band[]>([]);
  const [selectedBandId, setSelectedBandId] = useState<string>("");
  
  // Selection state
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Reminder timing
  const [isRelative, setIsRelative] = useState(true);
  const [selectedReminderTimes, setSelectedReminderTimes] = useState<string[]>([]);
  const [customDate, setCustomDate] = useState<Date | undefined>();
  const [customTime, setCustomTime] = useState("09:00");
  
  // Event details
  const [eventNameState, setEventNameState] = useState(eventName);
  const [eventDate, setEventDate] = useState<Date | undefined>(
    eventDateParam ? new Date(eventDateParam) : undefined
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (selectedBandId) {
      fetchBandMembers();
      fetchMemberGroups();
    }
  }, [selectedBandId]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleData) {
        setUserRole(roleData.role);
        
        if (roleData.role === "band_leader") {
          await fetchBands(user.id);
        } else if (roleData.role === "booking_manager") {
          await fetchManagedArtists(user.id);
        }
      }
    } catch (error) {
      console.error("Auth check error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBands = async (userId: string) => {
    const { data } = await supabase
      .from("bands")
      .select("id, name")
      .eq("band_leader_id", userId);
    
    if (data && data.length > 0) {
      setBands(data);
      setSelectedBandId(data[0].id);
    }
  };

  const fetchBandMembers = async () => {
    if (!selectedBandId) return;

    const { data: memberData } = await supabase
      .from("band_members")
      .select("member_id")
      .eq("band_id", selectedBandId);

    if (memberData) {
      const memberIds = memberData.map(m => m.member_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, instrument")
        .in("id", memberIds);

      setMembers(profiles || []);
    }
  };

  const fetchMemberGroups = async () => {
    if (!selectedBandId) return;

    const { data } = await supabase
      .from("member_groups")
      .select("*")
      .eq("band_id", selectedBandId);

    setGroups(data || []);
  };

  const fetchManagedArtists = async (userId: string) => {
    const { data } = await supabase
      .from("booking_manager_artists")
      .select("artist_id")
      .eq("booking_manager_id", userId);

    if (data) {
      const artistIds = data.map(a => a.artist_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, instrument")
        .in("id", artistIds);

      setMembers(profiles || []);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedMemberIds([]);
      setSelectAll(false);
    } else {
      setSelectedMemberIds(members.map(m => m.id));
      setSelectAll(true);
    }
  };

  const handleMemberToggle = (memberId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleGroupToggle = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (selectedGroupIds.includes(groupId)) {
      setSelectedGroupIds(prev => prev.filter(id => id !== groupId));
      setSelectedMemberIds(prev => prev.filter(id => !group.member_ids.includes(id)));
    } else {
      setSelectedGroupIds(prev => [...prev, groupId]);
      setSelectedMemberIds(prev => [...new Set([...prev, ...group.member_ids])]);
    }
  };

  const handleReminderTimeToggle = (time: string) => {
    setSelectedReminderTimes(prev =>
      prev.includes(time)
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const handleScheduleReminder = async () => {
    if (!eventNameState.trim()) {
      toast({ variant: "destructive", title: "Event name required" });
      return;
    }

    if (!eventDate) {
      toast({ variant: "destructive", title: "Event date required" });
      return;
    }

    if (selectedMemberIds.length === 0) {
      toast({ variant: "destructive", title: "Select at least one member" });
      return;
    }

    if (isRelative && selectedReminderTimes.length === 0) {
      toast({ variant: "destructive", title: "Select at least one reminder time" });
      return;
    }

    if (!isRelative && !customDate) {
      toast({ variant: "destructive", title: "Select a custom date/time" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("scheduled_reminders")
        .insert({
          user_id: user.id,
          event_type: eventType,
          event_id: eventId || null,
          event_name: eventNameState,
          event_date: eventDate.toISOString(),
          reminder_times: isRelative ? selectedReminderTimes : [],
          is_relative: isRelative,
          custom_datetime: !isRelative && customDate 
            ? new Date(`${format(customDate, "yyyy-MM-dd")}T${customTime}`).toISOString() 
            : null,
          target_member_ids: selectedMemberIds,
          target_groups: selectedGroupIds,
          message: message || null,
        });

      if (error) throw error;

      toast({
        title: "Reminder scheduled!",
        description: `Reminder set for ${selectedMemberIds.length} member(s)`,
      });

      navigate(-1);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav userRole={(userRole as "band_leader" | "booking_manager") || "band_leader"} />
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6" />
              Schedule Reminder
            </h1>
            <p className="text-muted-foreground text-sm">
              When should members receive the reminder?
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column - Select Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UsersIcon className="h-5 w-5" />
                Select Members
              </CardTitle>
              <CardDescription>
                Choose which members should receive reminders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Band Selector for Band Leaders */}
              {userRole === "band_leader" && bands.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {bands.map(band => (
                    <Badge
                      key={band.id}
                      variant={selectedBandId === band.id ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setSelectedBandId(band.id)}
                    >
                      {band.name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Groups */}
              {groups.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge
                    variant={selectAll ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={handleSelectAll}
                  >
                    All ({members.length})
                  </Badge>
                  {groups.map(group => (
                    <Badge
                      key={group.id}
                      variant={selectedGroupIds.includes(group.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleGroupToggle(group.id)}
                    >
                      {group.name} ({group.member_ids.length})
                    </Badge>
                  ))}
                </div>
              )}

              {/* Members List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No members found
                  </p>
                ) : (
                  <>
                    <div 
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={handleSelectAll}
                    >
                      <Checkbox checked={selectAll} />
                      <span className="text-sm font-medium">Select All Members ({members.length})</span>
                    </div>
                    {members.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleMemberToggle(member.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={selectedMemberIds.includes(member.id)} />
                          <div>
                            <p className="text-sm font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        {member.instrument && (
                          <Badge variant="secondary" className="text-xs">
                            {member.instrument}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Reminder Timing */}
          <div className="space-y-6">
            {/* Event Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarIcon className="h-5 w-5" />
                  Event Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Event Name</Label>
                  <Input
                    value={eventNameState}
                    onChange={(e) => setEventNameState(e.target.value)}
                    placeholder="Enter event name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Event Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !eventDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {eventDate ? format(eventDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={eventDate}
                        onSelect={setEventDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>

            {/* Reminder Timing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5" />
                  Reminder Timing
                </CardTitle>
                <CardDescription>
                  When should members receive the reminder?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Timing Type Toggle */}
                <div className="flex gap-2">
                  <Button
                    variant={isRelative ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsRelative(true)}
                    className="flex-1"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Relative to Event
                  </Button>
                  <Button
                    variant={!isRelative ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsRelative(false)}
                    className="flex-1"
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Custom Date/Time
                  </Button>
                </div>

                {isRelative ? (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Select reminder times (choose multiple):
                    </Label>
                    <div className="space-y-2">
                      {REMINDER_OPTIONS.map(option => (
                        <div
                          key={option.value}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            selectedReminderTimes.includes(option.value)
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          )}
                          onClick={() => handleReminderTimeToggle(option.value)}
                        >
                          <Checkbox checked={selectedReminderTimes.includes(option.value)} />
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                    </div>
                    {selectedReminderTimes.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {selectedReminderTimes.length} time(s) selected
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Custom Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !customDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customDate ? format(customDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customDate}
                            onSelect={setCustomDate}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Custom Message */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Custom Message (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a custom message to include with the reminder..."
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Event Date Display */}
            {eventDate && (
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Event Date:
                </p>
                <p className="font-semibold text-primary">
                  {format(eventDate, "EEEE, MMMM d, yyyy")}
                </p>
              </div>
            )}

            {/* Schedule Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleScheduleReminder}
              disabled={saving || selectedMemberIds.length === 0}
            >
              <Send className="h-4 w-4 mr-2" />
              {saving ? "Scheduling..." : "Schedule Reminder"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
