import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  is_group_message: boolean | null;
  content: string;
  created_at: string;
  read_by: string[] | null;
}

interface Profile {
  id: string;
  name: string;
}

interface MessageInboxProps {
  userId: string;
  onUnreadCountChange?: (count: number) => void;
}

export const MessageInbox = ({ userId, onUnreadCountChange }: MessageInboxProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;
    fetchMessages();
    fetchProfiles();

    // Realtime subscription
    const channel = supabase
      .channel("inbox-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    // Calculate unread count and notify parent
    const unreadCount = messages.filter(
      (m) => !m.read_by?.includes(userId)
    ).length;
    onUnreadCountChange?.(unreadCount);
  }, [messages, userId, onUnreadCountChange]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name");
    
    if (data) {
      const profileMap = new Map<string, Profile>();
      data.forEach((p) => profileMap.set(p.id, p));
      setProfiles(profileMap);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setMessages((data as Message[]) || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase.rpc("mark_message_as_read", {
        message_id: messageId,
        user_id: userId,
      });

      if (error) throw error;

      // Update local state
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, read_by: [...(m.read_by || []), userId] }
            : m
        )
      );
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to mark as read",
        description: error.message,
      });
    }
  };

  const getSenderName = (senderId: string) => {
    if (senderId === userId) return "You";
    return profiles.get(senderId)?.name || "Unknown";
  };

  const getRecipientName = (recipientId: string | null) => {
    if (!recipientId) return "Everyone";
    if (recipientId === userId) return "You";
    return profiles.get(recipientId)?.name || "Unknown";
  };

  const isUnread = (message: Message) => {
    return !message.read_by?.includes(userId);
  };

  if (loading) {
    return (
      <Card className="border-border/50 shadow-lg">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading messages...</p>
        </CardContent>
      </Card>
    );
  }

  const unreadMessages = messages.filter(isUnread);
  const readMessages = messages.filter((m) => !isUnread(m));

  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Messages
          {unreadMessages.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadMessages.length} new
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Your direct messages and group announcements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No messages yet
              </p>
            )}

            {/* Unread messages first */}
            {unreadMessages.map((message) => (
              <div
                key={message.id}
                className="p-3 rounded-md border bg-destructive/5 border-destructive/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">
                        From {getSenderName(message.sender_id)}
                      </span>
                      {message.is_group_message ? (
                        <Badge variant="outline" className="text-xs">
                          Group
                        </Badge>
                      ) : (
                        <span>→ {getRecipientName(message.recipient_id)}</span>
                      )}
                      <span className="ml-auto">
                        {new Date(message.created_at).toLocaleDateString()} at{" "}
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAsRead(message.id)}
                    className="shrink-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Read messages */}
            {readMessages.map((message) => (
              <div
                key={message.id}
                className="p-3 rounded-md border bg-background opacity-60"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">
                      From {getSenderName(message.sender_id)}
                    </span>
                    {message.is_group_message ? (
                      <Badge variant="outline" className="text-xs">
                        Group
                      </Badge>
                    ) : (
                      <span>→ {getRecipientName(message.recipient_id)}</span>
                    )}
                    <span className="ml-auto">
                      {new Date(message.created_at).toLocaleDateString()} at{" "}
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
