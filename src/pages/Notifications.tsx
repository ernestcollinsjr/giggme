import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, MessageSquare, Smartphone, Loader2, Send, Clock, FileCheck, Settings, History, Check, CheckCheck, Filter } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { TopNav } from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import { formatDistanceToNow } from "date-fns";

interface NotificationPrefs {
  id?: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  reminder_1_week: boolean;
  reminder_1_day: boolean;
  reminder_day_of: boolean;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

type UserRole = "band_leader" | "band_member" | "booking_manager" | "artist" | "tour_manager" | "venue_owner" | "super_admin" | null;
type FilterType = "all" | "unread" | "read";

const Notifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSupported, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    email_enabled: true,
    sms_enabled: true,
    push_enabled: true,
    reminder_1_week: true,
    reminder_1_day: true,
    reminder_day_of: true,
  });

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      // Fetch user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData) {
        setUserRole(roleData.role as UserRole);
      }

      // Fetch preferences
      const { data: prefsData, error: prefsError } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!prefsError && prefsData) {
        setPrefs({
          id: prefsData.id,
          email_enabled: prefsData.email_enabled ?? true,
          sms_enabled: prefsData.sms_enabled ?? true,
          push_enabled: prefsData.push_enabled ?? true,
          reminder_1_week: prefsData.reminder_1_week ?? true,
          reminder_1_day: prefsData.reminder_1_day ?? true,
          reminder_day_of: prefsData.reminder_day_of ?? true,
        });
      }

      // Fetch notifications
      const { data: notificationsData } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (notificationsData) {
        setNotifications(notificationsData);
      }

      // Subscribe to real-time notifications
      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            setNotifications((prev) => [newNotification, ...prev]);
            toast({
              title: newNotification.title,
              description: newNotification.message,
            });
          }
        )
        .subscribe();

      setLoading(false);
    };

    init();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [navigate, toast]);

  const updatePreference = async (key: keyof NotificationPrefs, value: boolean) => {
    setSaving(true);
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);

    try {
      if (!userId) return;

      if (prefs.id) {
        const { error } = await supabase
          .from("notification_preferences")
          .update({ [key]: value, updated_at: new Date().toISOString() } as any)
          .eq("id", prefs.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("notification_preferences")
          .insert({
            user_id: userId,
            ...newPrefs,
          })
          .select()
          .single();

        if (error) throw error;
        setPrefs({ ...newPrefs, id: data.id });
      }

      toast({
        title: "Preferences updated",
        description: "Your notification settings have been saved.",
      });
    } catch (error: any) {
      console.error("Error updating preferences:", error);
      setPrefs(prefs);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    setMarkingRead(notificationId);
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );

      toast({
        title: "Marked as read",
        description: "Notification has been marked as read.",
      });
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      toast({
        variant: "destructive",
        title: "Failed to update",
        description: error.message,
      });
    } finally {
      setMarkingRead(null);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setMarkingRead("all");
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", unreadIds);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );

      toast({
        title: "All marked as read",
        description: `${unreadIds.length} notifications marked as read.`,
      });
    } catch (error: any) {
      console.error("Error marking all as read:", error);
      toast({
        variant: "destructive",
        title: "Failed to update",
        description: error.message,
      });
    } finally {
      setMarkingRead(null);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.is_read;
    if (filter === "read") return n.is_read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const sendTestNotification = async () => {
    setSendingTest(true);
    try {
      if ('serviceWorker' in navigator && 'Notification' in window) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('Test Push from GigMe! 🎵', {
          body: 'Your push notifications are working perfectly! 🎉',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        } as NotificationOptions);
        toast({
          title: 'Test sent!',
          description: 'Check your notifications - you should see the test message.',
        });
      } else {
        throw new Error('Push notifications not available');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        variant: 'destructive',
        title: 'Test failed',
        description: 'Could not send test notification. Make sure notifications are enabled.',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'gig_reminder':
        return '🎵';
      case 'gig_response':
        return '✅';
      case 'availability_request':
        return '📅';
      default:
        return '📬';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav userRole={userRole} />
      
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            Notifications
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your notification preferences and view notification history
          </p>
        </div>

        <Tabs defaultValue="preferences" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="status" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Status</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="test" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Test</span>
            </TabsTrigger>
          </TabsList>

          {/* Status Tab */}
          <TabsContent value="status">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                  Notification Status
                </CardTitle>
                <CardDescription>
                  Current status of your notification channels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive gig updates via email</p>
                    </div>
                  </div>
                  <Badge variant={prefs.email_enabled ? "default" : "secondary"}>
                    {prefs.email_enabled ? "Active" : "Disabled"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">SMS Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive text message reminders</p>
                    </div>
                  </div>
                  <Badge variant={prefs.sms_enabled ? "default" : "secondary"}>
                    {prefs.sms_enabled ? "Active" : "Disabled"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">Browser push alerts</p>
                    </div>
                  </div>
                  <Badge variant={isSubscribed ? "default" : "secondary"}>
                    {isSubscribed ? "Subscribed" : "Not Subscribed"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Choose how you want to receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Notification Channels */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Notification Channels
                  </h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label htmlFor="email-notifications" className="cursor-pointer">
                          Email Notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Receive notifications via email
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={prefs.email_enabled}
                      onCheckedChange={(checked) => updatePreference("email_enabled", checked)}
                      disabled={saving}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label htmlFor="sms-notifications" className="cursor-pointer">
                          SMS Notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Receive notifications via text message
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="sms-notifications"
                      checked={prefs.sms_enabled}
                      onCheckedChange={(checked) => updatePreference("sms_enabled", checked)}
                      disabled={saving}
                    />
                  </div>

                  {isSupported && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label htmlFor="push-notifications" className="cursor-pointer">
                            Push Notifications
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Receive browser push notifications
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="push-notifications"
                        checked={isSubscribed}
                        onCheckedChange={async (checked) => {
                          if (checked) {
                            await subscribe();
                          } else {
                            await unsubscribe();
                          }
                        }}
                        disabled={pushLoading}
                      />
                    </div>
                  )}
                </div>

                {/* Reminder Settings */}
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Gig Reminders
                  </h4>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="reminder-week" className="cursor-pointer">
                        1 Week Before
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Get reminded 1 week before gigs
                      </p>
                    </div>
                    <Switch
                      id="reminder-week"
                      checked={prefs.reminder_1_week}
                      onCheckedChange={(checked) => updatePreference("reminder_1_week", checked)}
                      disabled={saving}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="reminder-day" className="cursor-pointer">
                        1 Day Before
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Get reminded 1 day before gigs
                      </p>
                    </div>
                    <Switch
                      id="reminder-day"
                      checked={prefs.reminder_1_day}
                      onCheckedChange={(checked) => updatePreference("reminder_1_day", checked)}
                      disabled={saving}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="reminder-dayof" className="cursor-pointer">
                        Day Of Event
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Get reminded on the day of gigs
                      </p>
                    </div>
                    <Switch
                      id="reminder-dayof"
                      checked={prefs.reminder_day_of}
                      onCheckedChange={(checked) => updatePreference("reminder_day_of", checked)}
                      disabled={saving}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" />
                      Notification History
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {unreadCount} unread
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Recent notifications sent to you
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={filter} onValueChange={(value: FilterType) => setFilter(value)}>
                      <SelectTrigger className="w-[130px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="unread">Unread</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                      </SelectContent>
                    </Select>
                    {unreadCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={markAllAsRead}
                        disabled={markingRead === "all"}
                        className="gap-2"
                      >
                        {markingRead === "all" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCheck className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Mark all read</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{filter === "all" ? "No notifications yet" : `No ${filter} notifications`}</p>
                    <p className="text-sm">
                      {filter === "all" 
                        ? "You'll see your notification history here" 
                        : "Try changing the filter to see other notifications"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`flex items-start gap-3 p-4 rounded-lg transition-colors cursor-pointer ${
                          notification.is_read 
                            ? "bg-muted/30 hover:bg-muted/50" 
                            : "bg-primary/5 hover:bg-primary/10 border-l-4 border-primary"
                        }`}
                        onClick={() => !notification.is_read && markAsRead(notification.id)}
                      >
                        <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${!notification.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {notification.is_read ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              <Check className="h-3 w-3 mr-1" />
                              read
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              disabled={markingRead === notification.id}
                              className="gap-1 text-xs"
                            >
                              {markingRead === notification.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              Mark read
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Test Tab */}
          <TabsContent value="test">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Test Notifications
                </CardTitle>
                <CardDescription>
                  Send a test notification to verify your setup
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-6 rounded-lg bg-muted/50 text-center">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h3 className="text-lg font-semibold mb-2">Test Your Notifications</h3>
                  <p className="text-muted-foreground mb-6">
                    Click the button below to send a test push notification and verify everything is working correctly.
                  </p>
                  
                  {isSubscribed ? (
                    <Button
                      onClick={sendTestNotification}
                      disabled={sendingTest}
                      className="gap-2"
                    >
                      {sendingTest ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send Test Notification
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        Push notifications are not enabled. Enable them in the Preferences tab first.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const tabsList = document.querySelector('[data-state="active"]');
                          // Navigate to preferences tab
                        }}
                      >
                        Go to Preferences
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Notifications;
