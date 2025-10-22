import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock } from "lucide-react";

interface GigMemberUpdate {
  id: string;
  gig_id: string;
  member_id: string;
  status: string;
}

export const RealtimeGigUpdates = ({ gigId }: { gigId: string }) => {
  const { toast } = useToast();
  const [responses, setResponses] = useState<Record<string, string>>({});

  useEffect(() => {
    // Fetch initial responses
    const fetchResponses = async () => {
      const { data } = await supabase
        .from("gig_members")
        .select("member_id, status")
        .eq("gig_id", gigId);
      
      if (data) {
        const responseMap: Record<string, string> = {};
        data.forEach((r) => {
          responseMap[r.member_id] = r.status;
        });
        setResponses(responseMap);
      }
    };

    fetchResponses();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`gig-${gigId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gig_members",
          filter: `gig_id=eq.${gigId}`,
        },
        async (payload) => {
          console.log("Gig member update:", payload);
          
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const update = payload.new as GigMemberUpdate;
            
            // Fetch member name
            const { data: profile } = await supabase
              .from("profiles")
              .select("name")
              .eq("id", update.member_id)
              .single();

            const memberName = profile?.name || "A member";
            const statusIcon = 
              update.status === "accepted" ? "✅" :
              update.status === "declined" ? "❌" : "⏳";

            toast({
              title: "Gig RSVP Update",
              description: `${statusIcon} ${memberName} has ${update.status} the gig`,
            });

            setResponses(prev => ({
              ...prev,
              [update.member_id]: update.status
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gigId, toast]);

  const acceptedCount = Object.values(responses).filter(s => s === "accepted").length;
  const declinedCount = Object.values(responses).filter(s => s === "declined").length;
  const pendingCount = Object.values(responses).filter(s => s === "pending").length;

  if (Object.keys(responses).length === 0) return null;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span>{acceptedCount}</span>
      </div>
      <div className="flex items-center gap-1">
        <XCircle className="h-4 w-4 text-red-500" />
        <span>{declinedCount}</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="h-4 w-4 text-yellow-500" />
        <span>{pendingCount}</span>
      </div>
    </div>
  );
};
