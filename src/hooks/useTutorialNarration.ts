import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Module-level audio reference to ensure we can always stop it
let globalAudio: HTMLAudioElement | null = null;

export const useTutorialNarration = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const requestIdRef = useRef<number>(0);

  const stopAudio = useCallback(() => {
    if (globalAudio) {
      globalAudio.pause();
      globalAudio.currentTime = 0;
      globalAudio.src = "";
      globalAudio = null;
    }
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  const speak = useCallback(async (text: string, voice: string = "nova") => {
    if (!text || isMuted) return;

    // Increment request ID to track the latest request
    const currentRequestId = ++requestIdRef.current;

    // Stop any existing audio immediately
    stopAudio();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("text-to-speech", {
        body: { text, voice },
      });

      // Check if this is still the latest request
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (error) {
        console.error("TTS error:", error);
        setIsLoading(false);
        return;
      }

      if (data?.audioContent) {
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        const audio = new Audio(audioUrl);
        globalAudio = audio;
        
        let hasEnded = false;
        
        const markEnded = () => {
          if (hasEnded) return;
          hasEnded = true;
          if (currentRequestId === requestIdRef.current) {
            setIsSpeaking(false);
          }
          if (globalAudio === audio) {
            globalAudio = null;
          }
        };
        
        audio.onended = markEnded;
        audio.onerror = () => {
          console.error("Audio playback error");
          if (currentRequestId === requestIdRef.current) {
            setIsLoading(false);
            setIsSpeaking(false);
          }
          if (globalAudio === audio) {
            globalAudio = null;
          }
        };
        
        setIsLoading(false);
        setIsSpeaking(true);
        
        try {
          await audio.play();
        } catch (playError) {
          console.error("Audio play failed:", playError);
          if (currentRequestId === requestIdRef.current) {
            setIsSpeaking(false);
          }
          if (globalAudio === audio) {
            globalAudio = null;
          }
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
  }, [isMuted, stopAudio]);

  const stop = useCallback(() => {
    requestIdRef.current++;
    stopAudio();
  }, [stopAudio]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      if (!prev) {
        requestIdRef.current++;
        stopAudio();
      }
      return !prev;
    });
  }, [stopAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      requestIdRef.current++;
      stopAudio();
    };
  }, [stopAudio]);

  return {
    speak,
    stop,
    isNarrating: isSpeaking,
    isLoading,
    isMuted,
    toggleMute,
  };
};
