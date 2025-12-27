import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, MessageSquare, Smartphone, Loader2, Send, Volume2, VolumeX, Play, Volume1 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useSoundPreference, SoundType } from "@/hooks/useSoundPreference";

interface NotificationPrefs {
  id?: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  reminder_1_week: boolean;
  reminder_1_day: boolean;
  reminder_day_of: boolean;
  sound_muted: boolean;
  sound_type: SoundType;
  sound_volume: number;
}

export const NotificationPreferences = () => {
  const { toast } = useToast();
  const { isSupported, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const { playTestSound } = useSoundPreference();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    email_enabled: true,
    sms_enabled: true,
    push_enabled: true,
    reminder_1_week: true,
    reminder_1_day: true,
    reminder_day_of: true,
    sound_muted: false,
    sound_type: 'chime',
    sound_volume: 0.5,
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
          sound_muted: (data as any).sound_muted ?? false,
          sound_type: (data as any).sound_type ?? 'chime',
          sound_volume: (data as any).sound_volume ?? 0.5,
        });
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPrefs, value: boolean | SoundType | number) => {
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
        {/* Sound Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Sound Settings
          </h4>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {prefs.sound_muted ? (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Volume2 className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="sound-muted" className="cursor-pointer">
                  Notification Sounds
                </Label>
                <p className="text-xs text-muted-foreground">
                  Play sounds for real-time notifications
                </p>
              </div>
            </div>
            <Switch
              id="sound-muted"
              checked={!prefs.sound_muted}
              onCheckedChange={(checked) => updatePreference("sound_muted", !checked)}
              disabled={saving}
            />
          </div>

          {/* Sound Type Selection */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Play className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="cursor-pointer">
                  Sound Type
                </Label>
                <p className="text-xs text-muted-foreground">
                  Choose your notification sound
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(['chime', 'bell', 'ding'] as const).map((type) => (
                <Button
                  key={type}
                  variant={prefs.sound_type === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    updatePreference("sound_type", type);
                    playTestSound(type, prefs.sound_volume);
                  }}
                  disabled={saving}
                  className="capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume1 className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="cursor-pointer">
                  Volume
                </Label>
                <p className="text-xs text-muted-foreground">
                  Adjust notification sound volume
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-40">
              <VolumeX className="h-3 w-3 text-muted-foreground" />
              <Slider
                value={[prefs.sound_volume * 100]}
                onValueChange={(values) => {
                  const newVolume = values[0] / 100;
                  setPrefs(prev => ({ ...prev, sound_volume: newVolume }));
                }}
                onValueCommit={(values) => {
                  const newVolume = values[0] / 100;
                  updatePreference("sound_volume", newVolume);
                  playTestSound(prefs.sound_type, newVolume);
                }}
                max={100}
                step={5}
                disabled={saving || prefs.sound_muted}
                className="flex-1"
              />
              <Volume2 className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Notification Channels */}
        <div className="space-y-4 pt-4 border-t">
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="push-notifications" className="cursor-pointer">
                    Push Notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isSupported 
                      ? "Receive browser push notifications"
                      : "Not supported in this browser"}
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
                disabled={pushLoading || !isSupported}
              />
            </div>
            
            {isSubscribed && (
              <Button
                variant="outline"
                size="sm"
                className="ml-7"
                disabled={sendingTest}
                onClick={async () => {
                  setSendingTest(true);
                  try {
                    // Send test notification using the Notification API directly
                    if ('serviceWorker' in navigator && 'Notification' in window) {
                      const registration = await navigator.serviceWorker.ready;
                      await registration.showNotification('Test Notification 🎵', {
                        body: 'Push notifications are working! You will receive gig reminders here.',
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
                }}
              >
                {sendingTest ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Test Notification
              </Button>
            )}
          </div>
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
