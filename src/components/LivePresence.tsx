import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users } from "lucide-react";

interface OnlineUser {
  user_id: string;
  name: string;
  online_at: string;
}

export const LivePresence = () => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      return { user, profile };
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const setupPresence = async () => {
      const userData = await fetchProfile();
      if (!userData || cancelled) return;

      channel = supabase.channel(`online-users-${Math.random().toString(36).slice(2)}`);

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState();
          const users: OnlineUser[] = [];

          Object.keys(state).forEach((key) => {
            const presences = state[key] as any[];
            presences.forEach((presence) => {
              users.push(presence as OnlineUser);
            });
          });

          setOnlineUsers(users);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && channel) {
            await channel.track({
              user_id: userData.user.id,
              name: userData.profile?.name || "Unknown",
              online_at: new Date().toISOString(),
            });
          }
        });
    };

    setupPresence();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (onlineUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      <TooltipProvider>
        <div className="flex -space-x-2">
          {onlineUsers.slice(0, 5).map((user) => (
            <Tooltip key={user.user_id}>
              <TooltipTrigger>
                <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarFallback className="text-xs bg-primary/10">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>{user.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
      {onlineUsers.length > 5 && (
        <Badge variant="secondary" className="text-xs">
          +{onlineUsers.length - 5}
        </Badge>
      )}
    </div>
  );
};
