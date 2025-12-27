import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SoundType = 'chime' | 'bell' | 'ding';

const soundPatterns: Record<SoundType, { frequencies: number[]; durations: number[]; delays: number[] }> = {
  chime: {
    frequencies: [523.25, 659.25, 783.99], // C5, E5, G5
    durations: [0.15, 0.15, 0.2],
    delays: [0, 0.1, 0.2],
  },
  bell: {
    frequencies: [880, 1108.73, 1318.51], // A5, C#6, E6
    durations: [0.3, 0.25, 0.35],
    delays: [0, 0.05, 0.1],
  },
  ding: {
    frequencies: [1046.5], // C6
    durations: [0.4],
    delays: [0],
  },
};

export const useSoundPreference = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [soundType, setSoundType] = useState<SoundType>('chime');
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
        .select("sound_muted, sound_type")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching sound preference:", error);
        setLoading(false);
        return;
      }

      if (data) {
        setIsMuted(data.sound_muted ?? false);
        setSoundType((data as any).sound_type ?? 'chime');
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const playSound = useCallback((type: SoundType = soundType) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const pattern = soundPatterns[type];
      
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type === 'bell' ? 'triangle' : 'sine';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      const now = audioContext.currentTime;
      pattern.frequencies.forEach((freq, i) => {
        playTone(freq, now + pattern.delays[i], pattern.durations[i]);
      });
      
      setTimeout(() => audioContext.close(), 1000);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }, [soundType]);

  const playNotificationSound = useCallback(() => {
    if (isMuted) return;
    playSound();
  }, [isMuted, playSound]);

  const playTestSound = useCallback((type?: SoundType) => {
    playSound(type ?? soundType);
  }, [playSound, soundType]);

  return { 
    isMuted, 
    soundType,
    loading, 
    playNotificationSound, 
    playTestSound, 
    refetch: fetchSoundPreference 
  };
};
