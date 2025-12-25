import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, MessageSquare, Smartphone, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface NotificationPrefs {
  id?: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  reminder_1_week: boolean;
  reminder_1_day: boolean;
  reminder_day_of: boolean;
}

export const NotificationPreferences = () => {
  const { toast } = useToast();
  const { isSupported, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    email_enabled: true,
    sms_enabled: true,
    push_enabled: true,
    reminder_1_week: true,
    reminder_1_day: true,
    reminder_day_of: true,
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching preferences:", error);
        return;
      }

      if (data) {
        setPrefs({
          id: data.id,
          email_enabled: data.email_enabled ?? true,
          sms_enabled: data.sms_enabled ?? true,
          push_enabled: data.push_enabled ?? true,
          reminder_1_week: data.reminder_1_week ?? true,
          reminder_1_day: data.reminder_1_day ?? true,
          reminder_day_of: data.reminder_day_of ?? true,
        });
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPrefs, value: boolean) => {
    setSaving(true);
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (prefs.id) {
        // Update existing record
        const { error } = await supabase
          .from("notification_preferences")
          .update({ [key]: value, updated_at: new Date().toISOString() })
          .eq("id", prefs.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from("notification_preferences")
          .insert({
            user_id: user.id,
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
      // Revert on error
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

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
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
  );
};
