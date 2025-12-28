import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, MailCheck, MailOpen, MousePointerClick, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface EmailTracking {
  id: string;
  member_id: string;
  email: string;
  status: string;
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
}

interface EmailTrackingStatusProps {
  gigId: string;
  memberProfiles?: { id: string; name: string }[];
}

export function EmailTrackingStatus({ gigId, memberProfiles = [] }: EmailTrackingStatusProps) {
  const [tracking, setTracking] = useState<EmailTracking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTracking = async () => {
      const { data, error } = await supabase
        .from('email_tracking')
        .select('*')
        .eq('gig_id', gigId);

      if (!error && data) {
        setTracking(data as EmailTracking[]);
      }
      setLoading(false);
    };

    fetchTracking();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`email_tracking_${gigId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_tracking',
          filter: `gig_id=eq.${gigId}`,
        },
        () => {
          fetchTracking();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gigId]);

  if (loading || tracking.length === 0) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'clicked':
        return <MousePointerClick className="h-3 w-3" />;
      case 'opened':
        return <MailOpen className="h-3 w-3" />;
      case 'delivered':
        return <MailCheck className="h-3 w-3" />;
      case 'bounced':
      case 'complained':
        return <AlertCircle className="h-3 w-3" />;
      default:
        return <Mail className="h-3 w-3" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'clicked':
        return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'opened':
        return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'delivered':
        return 'bg-cyan-500/20 text-cyan-700 border-cyan-500/30';
      case 'bounced':
      case 'complained':
        return 'bg-red-500/20 text-red-700 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getMemberName = (memberId: string) => {
    const member = memberProfiles.find(m => m.id === memberId);
    return member?.name || 'Unknown';
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return null;
    return format(new Date(timestamp), 'MMM d, h:mm a');
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {tracking.map((t) => (
          <Tooltip key={t.id}>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className={`flex items-center gap-1 text-xs cursor-pointer ${getStatusColor(t.status)}`}
              >
                {getStatusIcon(t.status)}
                <span className="max-w-[80px] truncate">{getMemberName(t.member_id)}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="space-y-1 text-xs">
                <p className="font-medium">{getMemberName(t.member_id)}</p>
                <p className="text-muted-foreground">{t.email}</p>
                <div className="pt-1 border-t space-y-0.5">
                  <p>Sent: {formatTimestamp(t.sent_at)}</p>
                  {t.delivered_at && <p>Delivered: {formatTimestamp(t.delivered_at)}</p>}
                  {t.opened_at && <p className="text-blue-600">Opened: {formatTimestamp(t.opened_at)}</p>}
                  {t.clicked_at && <p className="text-green-600">Clicked: {formatTimestamp(t.clicked_at)}</p>}
                  {(t.status === 'bounced' || t.status === 'complained') && (
                    <p className="text-red-600">Status: {t.status}</p>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}