import { useState, useEffect, useCallback, useRef } from 'react';
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
  const registrationRef = useRef<(ServiceWorkerRegistration & { pushManager?: PushManager }) | null>(null);
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

          const registration = await navigator.serviceWorker.register('/sw.js') as ServiceWorkerRegistration & { pushManager?: PushManager };
          registrationRef.current = registration;
          await checkSubscription(registration);
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

  const checkSubscription = async (existingRegistration?: ServiceWorkerRegistration & { pushManager?: PushManager }) => {
    try {
      const registration = existingRegistration
        ?? registrationRef.current
        ?? await navigator.serviceWorker.getRegistration('/sw.js') as (ServiceWorkerRegistration & { pushManager?: PushManager }) | undefined;

      if (!registration?.pushManager) {
        setIsSubscribed(false);
        return null;
      }

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
        description: /iPhone|iPad|iPod/i.test(navigator.userAgent)
          ? 'On iPhone, open GigGme from the Home Screen app icon before enabling push notifications.'
          : 'Push notifications are not supported in this browser.',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);

    try {
      // Request permission first, directly from the user's toggle click.
      // Some browsers block the prompt if any async work happens first.
      const permissionResult = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
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

      const registration = registrationRef.current
        ?? await navigator.serviceWorker.register('/sw.js') as ServiceWorkerRegistration & { pushManager?: PushManager };
      registrationRef.current = registration;
      console.log('Service Worker registered:', registration);

      if (!registration.pushManager) {
        toast({
          title: 'Open from Home Screen',
          description: 'On iPhone or iPad, add GigGme to your Home Screen and open it from that icon before enabling push notifications.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return false;
      }

      // Subscribe to push
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      console.log('Push subscription:', subscription);

      // Get current user
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      
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
    } catch (error: unknown) {
      console.error('Error subscribing to push:', error);
      const message = error instanceof Error ? error.message : 'Failed to enable notifications. Please try again.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return false;
    }
  }, [isSupported, toast]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js') as (ServiceWorkerRegistration & { pushManager?: PushManager }) | undefined;
      const subscription = await registration?.pushManager?.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove from database
        const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
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
