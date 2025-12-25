import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GigResponseCountdownProps {
  deadline: string | null;
  onExpired?: () => void;
  className?: string;
  showLabel?: boolean;
}

export const GigResponseCountdown = ({ 
  deadline, 
  onExpired, 
  className,
  showLabel = true 
}: GigResponseCountdownProps) => {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    if (!deadline) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const deadlineTime = new Date(deadline).getTime();
      const difference = deadlineTime - now;

      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: true });
        onExpired?.();
        return true; // expired
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, expired: false });
      return false;
    };

    // Initial calculation
    const expired = calculateTimeLeft();
    if (expired) return;

    // Update every second
    const interval = setInterval(() => {
      const expired = calculateTimeLeft();
      if (expired) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, onExpired]);

  if (!deadline) return null;

  const totalMinutesLeft = timeLeft.hours * 60 + timeLeft.minutes;
  const isUrgent = totalMinutesLeft < 30 && !timeLeft.expired;
  const isCritical = totalMinutesLeft < 10 && !timeLeft.expired;

  const formatNumber = (n: number) => n.toString().padStart(2, '0');

  if (timeLeft.expired) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium",
        className
      )}>
        <AlertTriangle className="h-3 w-3" />
        <span>Response time expired</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
      isCritical 
        ? "bg-destructive/10 text-destructive animate-pulse" 
        : isUrgent 
          ? "bg-yellow-500/10 text-yellow-600" 
          : "bg-primary/10 text-primary",
      className
    )}>
      <Clock className="h-3 w-3" />
      {showLabel && <span>Respond in:</span>}
      <span className="font-mono tabular-nums">
        {timeLeft.hours > 0 && `${formatNumber(timeLeft.hours)}:`}
        {formatNumber(timeLeft.minutes)}:{formatNumber(timeLeft.seconds)}
      </span>
    </div>
  );
};
