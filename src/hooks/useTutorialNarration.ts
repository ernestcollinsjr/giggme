import { useState, useCallback, useRef } from "react";

interface NarrationStep {
  text: string;
  duration?: number;
}

export const useTutorialNarration = () => {
  const [isNarrating, setIsNarrating] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (isMuted || !('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    utterance.onstart = () => setIsNarrating(true);
    utterance.onend = () => setIsNarrating(false);
    utterance.onerror = () => setIsNarrating(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsNarrating(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (!isMuted) {
      stop();
    }
    setIsMuted(!isMuted);
  }, [isMuted, stop]);

  return {
    speak,
    stop,
    isNarrating,
    isMuted,
    toggleMute,
  };
};
