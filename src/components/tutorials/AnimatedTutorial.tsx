import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTutorialNarration } from "@/hooks/useTutorialNarration";

export interface TutorialStep {
  title: string;
  description: string;
  visual: React.ReactNode;
  narration?: string;
}

interface AnimatedTutorialProps {
  id: string;
  steps: TutorialStep[];
  onComplete?: (id: string) => void;
}

export const AnimatedTutorial = ({ id, steps, onComplete }: AnimatedTutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const { speak, stop, isMuted, toggleMute, isNarrating } = useTutorialNarration();

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex < 0 || stepIndex >= steps.length || isAnimating) return;
    
    setIsAnimating(true);
    stop();
    
    setTimeout(() => {
      setCurrentStep(stepIndex);
      setIsAnimating(false);
      
      const step = steps[stepIndex];
      if (step.narration && !isMuted) {
        speak(step.narration);
      }
    }, 300);
  }, [steps, isAnimating, stop, speak, isMuted]);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      goToStep(currentStep + 1);
    } else {
      setIsPlaying(false);
      onComplete?.(id);
    }
  }, [currentStep, steps.length, goToStep, onComplete, id]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying || isAnimating) return;
    
    const interval = setInterval(() => {
      nextStep();
    }, 6000);

    return () => clearInterval(interval);
  }, [isPlaying, nextStep, isAnimating]);

  // Narrate on initial load
  useEffect(() => {
    const step = steps[0];
    if (step?.narration && !isMuted) {
      setTimeout(() => speak(step.narration!), 500);
    }
  }, []);

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden">
        {/* Visual Area */}
        <div className="relative min-h-[300px] md:min-h-[400px] flex items-center justify-center p-8">
          <div
            className={`w-full transition-all duration-300 ${
              isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
            }`}
          >
            {step.visual}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-8 border-t border-border/50">
          <div
            className={`transition-all duration-300 ${
              isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
            }`}
          >
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">
              {step.title}
            </h3>
            <p className="text-muted-foreground text-sm md:text-base">
              {step.description}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={prevStep}
                disabled={currentStep === 0 || isAnimating}
                className="h-10 w-10"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-10 w-10"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={nextStep}
                disabled={currentStep === steps.length - 1 || isAnimating}
                className="h-10 w-10"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className={`h-10 w-10 ${isNarrating ? "text-primary" : ""}`}
              >
                {isMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </Button>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center gap-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToStep(index)}
                  disabled={isAnimating}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? "bg-primary w-6"
                      : index < currentStep
                      ? "bg-primary/50"
                      : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Progress Bar */}
          <Progress value={progress} className="mt-4 h-1" />
        </div>
      </div>
    </div>
  );
};
