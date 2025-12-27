import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// VAPID public key - this should match what's in your edge function
const VAPID_PUBLIC_KEY = 'BP4oEUFagD8xlyYkPwGvMqIMBtAvQBIR0R1rO7QvDEBG6INVSJEbSVJN1y9E2aAY3IQm90vnRFYlLzzR3h2ZPc';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { toast } = useToast();

  useEffect(() => {
    const checkSupport = async () => {
      try {
        const hasServiceWorker = 'serviceWorker' in navigator;
        const hasPushManager = 'PushManager' in window;
        const hasNotification = 'Notification' in window;
        
        console.log('[Push Debug] serviceWorker:', hasServiceWorker);
        console.log('[Push Debug] PushManager:', hasPushManager);
        console.log('[Push Debug] Notification:', hasNotification);
        
        const supported = hasServiceWorker && hasPushManager && hasNotification;
        console.log('[Push Debug] Overall supported:', supported);
        
        setIsSupported(supported);
        
        if (supported) {
          console.log('[Push Debug] Permission:', Notification.permission);
          setPermission(Notification.permission);
          await checkSubscription();
        }
      } catch (error) {
        console.error('[Push Debug] Error checking push support:', error);
        setIsSupported(false);
      } finally {
        console.log('[Push Debug] Setting isLoading to false');
        setIsLoading(false);
      }
    };

    checkSupport();
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
      return subscription;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return null;
    }
  };

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: 'Not Supported',
        description: 'Push notifications are not supported in this browser.',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);

      // Request permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        toast({
          title: 'Permission Denied',
          description: 'Please enable notifications in your browser settings.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return false;
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      console.log('Push subscription:', subscription);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to enable notifications.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return false;
      }

      // Save subscription to database
      const { error } = await supabase.from('push_tokens').upsert({
        user_id: user.id,
        token: JSON.stringify(subscription.toJSON()),
        platform: 'web',
        device_info: {
          userAgent: navigator.userAgent,
          language: navigator.language,
        },
      }, {
        onConflict: 'user_id,token',
      });

      if (error) {
        console.error('Error saving subscription:', error);
        throw error;
      }

      setIsSubscribed(true);
      toast({
        title: 'Notifications Enabled',
        description: 'You will now receive push notifications.',
      });

      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast({
        title: 'Error',
        description: 'Failed to enable notifications. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return false;
    }
  }, [isSupported, toast]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove from database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('push_tokens')
            .delete()
            .eq('user_id', user.id)
            .eq('platform', 'web');
        }
      }

      setIsSubscribed(false);
      toast({
        title: 'Notifications Disabled',
        description: 'You will no longer receive push notifications.',
      });

      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast({
        title: 'Error',
        description: 'Failed to disable notifications.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return false;
    }
  }, [toast]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  };
}
