import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useSoundPreference = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSoundPreference();
  }, []);

  const fetchSoundPreference = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("sound_muted")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching sound preference:", error);
        setLoading(false);
        return;
      }

      if (data) {
        setIsMuted(data.sound_muted ?? false);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const playSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      const now = audioContext.currentTime;
      playTone(523.25, now, 0.15); // C5
      playTone(659.25, now + 0.1, 0.15); // E5
      playTone(783.99, now + 0.2, 0.2); // G5
      
      setTimeout(() => audioContext.close(), 1000);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (isMuted) return;
    playSound();
  }, [isMuted, playSound]);

  // Play sound for testing (ignores mute setting)
  const playTestSound = useCallback(() => {
    playSound();
  }, [playSound]);

  return { isMuted, loading, playNotificationSound, playTestSound, refetch: fetchSoundPreference };
};
