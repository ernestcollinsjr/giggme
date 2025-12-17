import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useTutorialNarration = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIdRef = useRef<number>(0);

  const speak = useCallback(async (text: string, voice: string = "nova") => {
    if (!text || isMuted) return;

    // Increment request ID to track the latest request
    const currentRequestId = ++requestIdRef.current;

    // Stop any existing audio immediately
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    setIsSpeaking(false);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("text-to-speech", {
        body: { text, voice },
      });

      // Check if this is still the latest request
      if (currentRequestId !== requestIdRef.current) {
        return; // A newer request was made, ignore this one
      }

      if (error) {
        console.error("TTS error:", error);
        setIsLoading(false);
        return;
      }

      if (data?.audioContent) {
        // Double-check we're still the current request
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // Use data URI - browser natively decodes base64 audio without corruption
        const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        let hasEnded = false;
        
        const markEnded = () => {
          if (hasEnded) return;
          hasEnded = true;
          if (currentRequestId === requestIdRef.current) {
            setIsSpeaking(false);
          }
          cleanup();
        };
        
        const handleEnded = () => {
          console.log("Audio ended event fired");
          markEnded();
        };
        
        const handleError = (e: Event) => {
          console.error("Audio playback error:", e);
          if (currentRequestId === requestIdRef.current) {
            setIsLoading(false);
            setIsSpeaking(false);
          }
          cleanup();
        };
        
        // Fallback: check if audio has finished via timeupdate
        const handleTimeUpdate = () => {
          if (audio.duration && audio.currentTime >= audio.duration - 0.1) {
            console.log("Audio finished via timeupdate");
            markEnded();
          }
        };
        
        const cleanup = () => {
          audio.removeEventListener('ended', handleEnded);
          audio.removeEventListener('error', handleError);
          audio.removeEventListener('timeupdate', handleTimeUpdate);
        };
        
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        
        setIsLoading(false);
        setIsSpeaking(true);
        
        try {
          await audio.play();
        } catch (playError) {
          console.error("Audio play failed:", playError);
          if (currentRequestId === requestIdRef.current) {
            setIsSpeaking(false);
          }
          cleanup();
        }
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("TTS error:", error);
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
        setIsSpeaking(false);
      }
    }
  }, [isMuted]);

  const stop = useCallback(() => {
    requestIdRef.current++; // Invalidate any pending requests
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      if (!prev) {
        // About to mute, stop current audio
        requestIdRef.current++;
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        setIsSpeaking(false);
        setIsLoading(false);
      }
      return !prev;
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      requestIdRef.current++;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    speak,
    stop,
    isNarrating: isSpeaking,
    isLoading,
    isMuted,
    toggleMute,
  };
};
