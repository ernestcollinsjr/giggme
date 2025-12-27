import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

export const useNativePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSupport = async () => {
      // Only supported on native platforms (iOS/Android)
      const isNative = Capacitor.isNativePlatform();
      console.log('[Native Push] Platform:', Capacitor.getPlatform());
      console.log('[Native Push] Is native:', isNative);
      setIsSupported(isNative);
      setIsLoading(false);
    };

    checkSupport();
  }, []);

  const register = useCallback(async () => {
    if (!isSupported) {
      console.log('[Native Push] Not supported on this platform');
      return { success: false, error: 'Not supported on this platform' };
    }

    try {
      setIsLoading(true);
      console.log('[Native Push] Requesting permissions...');

      // Request permission
      let permStatus = await PushNotifications.checkPermissions();
      console.log('[Native Push] Current permission status:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
        console.log('[Native Push] Permission after request:', permStatus.receive);
      }

      if (permStatus.receive !== 'granted') {
        console.log('[Native Push] Permission denied');
        setIsLoading(false);
        return { success: false, error: 'Push notification permission denied' };
      }

      // Register with APNs/FCM
      console.log('[Native Push] Registering with push service...');
      await PushNotifications.register();

      // Set up listeners
      PushNotifications.addListener('registration', async (token: Token) => {
        console.log('[Native Push] Registration successful, token:', token.value);
        setToken(token.value);
        setIsRegistered(true);

        // Save token to Supabase
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const platform = Capacitor.getPlatform();
            const { error } = await supabase.from('push_tokens').upsert({
              user_id: user.id,
              token: token.value,
              platform: platform === 'ios' ? 'apns' : 'fcm',
              device_info: {
                platform,
                native: true
              },
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,token'
            });

            if (error) {
              console.error('[Native Push] Error saving token:', error);
            } else {
              console.log('[Native Push] Token saved to database');
            }
          }
        } catch (err) {
          console.error('[Native Push] Error saving token:', err);
        }
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('[Native Push] Registration error:', error);
        setIsRegistered(false);
        setIsLoading(false);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('[Native Push] Notification received:', notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        console.log('[Native Push] Notification action performed:', notification);
      });

      setIsLoading(false);
      return { success: true };
    } catch (error) {
      console.error('[Native Push] Registration error:', error);
      setIsLoading(false);
      return { success: false, error: String(error) };
    }
  }, [isSupported]);

  const unregister = useCallback(async () => {
    if (!isSupported || !token) {
      return { success: false, error: 'Not registered' };
    }

    try {
      setIsLoading(true);

      // Remove token from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user && token) {
        await supabase.from('push_tokens').delete().match({
          user_id: user.id,
          token: token
        });
      }

      // Remove all listeners
      await PushNotifications.removeAllListeners();
      
      setToken(null);
      setIsRegistered(false);
      setIsLoading(false);

      return { success: true };
    } catch (error) {
      console.error('[Native Push] Unregister error:', error);
      setIsLoading(false);
      return { success: false, error: String(error) };
    }
  }, [isSupported, token]);

  return {
    isSupported,
    isRegistered,
    isLoading,
    token,
    register,
    unregister
  };
};
