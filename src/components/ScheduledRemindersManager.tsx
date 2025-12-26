import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, Calendar, Clock, Users, Trash2, Pencil, Plus } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ScheduledReminder {
  id: string;
  event_name: string;
  event_type: string;
  event_date: string;
  reminder_times: string[];
  is_relative: boolean;
  custom_datetime: string | null;
  target_member_ids: string[];
  message: string | null;
  status: string;
  created_at: string;
}

const REMINDER_LABELS: Record<string, string> = {
  "5_minutes": "5 min before",
  "15_minutes": "15 min before",
  "30_minutes": "30 min before",
  "1_hour": "1 hour before",
  "2_hours": "2 hours before",
  "1_day": "1 day before",
  "2_days": "2 days before",
  "1_week": "1 week before",
};

export const ScheduledRemindersManager = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reminders, setReminders] = useState<ScheduledReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReminder, setDeletingReminder] = useState<ScheduledReminder | null>(null);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("scheduled_reminders")
        .select("*")
        .eq("user_id", user.id)
        .order("event_date", { ascending: true });

      if (error) throw error;
      setReminders(data || []);
    } catch (error: any) {
      console.error("Error fetching reminders:", error);
      toast({
        variant: "destructive",
        title: "Error loading reminders",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (reminder: ScheduledReminder) => {
    setDeletingReminder(reminder);
    setDeleteDialogOpen(true);
  };

  const deleteReminder = async () => {
    if (!deletingReminder) return;

    try {
      const { error } = await supabase
        .from("scheduled_reminders")
        .delete()
        .eq("id", deletingReminder.id);

      if (error) throw error;

      toast({
        title: "Reminder deleted",
        description: "The scheduled reminder has been removed.",
      });

      setDeleteDialogOpen(false);
      setDeletingReminder(null);
      fetchReminders();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const upcomingReminders = reminders.filter(r => 
    r.status === "active" && new Date(r.event_date) >= new Date()
  );
  
  const pastReminders = reminders.filter(r => 
    r.status !== "active" || new Date(r.event_date) < new Date()
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading reminders...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Scheduled Reminders
              </CardTitle>
              <CardDescription>
                Manage your upcoming event reminders
              </CardDescription>
            </div>
            <Button onClick={() => navigate("/schedule-reminder?type=custom")} className="gap-2">
              <Plus className="h-4 w-4" />
              New Reminder
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reminders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No scheduled reminders yet.</p>
              <Button 
                variant="link" 
                onClick={() => navigate("/schedule-reminder?type=custom")}
                className="mt-2"
              >
                Schedule your first reminder
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {upcomingReminders.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                    Upcoming ({upcomingReminders.length})
                  </h3>
                  <div className="space-y-3">
                    {upcomingReminders.map((reminder) => (
                      <div
                        key={reminder.id}
                        className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{reminder.event_name}</h4>
                              <Badge variant="secondary" className="text-xs">
                                {reminder.event_type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {format(new Date(reminder.event_date), "MMM d, yyyy")}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {reminder.target_member_ids.length} member(s)
                              </span>
                            </div>
                            {reminder.is_relative && reminder.reminder_times.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {reminder.reminder_times.map((time) => (
                                  <Badge key={time} variant="outline" className="text-xs">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {REMINDER_LABELS[time] || time}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {!reminder.is_relative && reminder.custom_datetime && (
                              <div className="mt-2">
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {format(new Date(reminder.custom_datetime), "MMM d 'at' h:mm a")}
                                </Badge>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(reminder)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pastReminders.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                    Past / Completed ({pastReminders.length})
                  </h3>
                  <div className="space-y-2">
                    {pastReminders.slice(0, 5).map((reminder) => (
                      <div
                        key={reminder.id}
                        className="p-3 border rounded-lg bg-muted/30 opacity-60"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium">{reminder.event_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {format(new Date(reminder.event_date), "MMM d, yyyy")}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(reminder)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Reminder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the reminder for "{deletingReminder?.event_name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteReminder}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
