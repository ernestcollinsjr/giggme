import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Users, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import BottomNav from "@/components/BottomNav";

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

interface Conversation {
  id: string;
  name: string;
  isGroup: boolean;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  participantId?: string;
}

const Messages = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    fetchProfiles();
    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel("messages-page")
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

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, name");
    if (data) {
      const profileMap = new Map<string, Profile>();
      data.forEach((p) => profileMap.set(p.id, p));
      setProfiles(profileMap);
    }
  };

  const fetchMessages = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const messages = (data as Message[]) || [];
      
      // Group messages into conversations
      const conversationMap = new Map<string, Conversation>();
      
      // Add group chat conversation
      const groupMessages = messages.filter((m) => m.is_group_message);
      if (groupMessages.length > 0) {
        const unreadGroupCount = groupMessages.filter(
          (m) => !m.read_by?.includes(userId)
        ).length;
        
        conversationMap.set("group", {
          id: "group",
          name: "Group Chat",
          isGroup: true,
          lastMessage: groupMessages[0].content,
          lastMessageTime: groupMessages[0].created_at,
          unreadCount: unreadGroupCount,
        });
      }

      // Add direct message conversations
      const directMessages = messages.filter((m) => !m.is_group_message);
      directMessages.forEach((message) => {
        const otherParticipantId = message.sender_id === userId 
          ? message.recipient_id 
          : message.sender_id;
        
        if (!otherParticipantId) return;
        
        if (!conversationMap.has(otherParticipantId)) {
          const unreadCount = directMessages.filter(
            (m) => 
              (m.sender_id === otherParticipantId || m.recipient_id === otherParticipantId) &&
              !m.read_by?.includes(userId)
          ).length;
          
          conversationMap.set(otherParticipantId, {
            id: otherParticipantId,
            name: profiles.get(otherParticipantId)?.name || "Unknown",
            isGroup: false,
            lastMessage: message.content,
            lastMessageTime: message.created_at,
            unreadCount,
            participantId: otherParticipantId,
          });
        }
      });

      // Sort by last message time
      const sortedConversations = Array.from(conversationMap.values()).sort(
        (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );

      setConversations(sortedConversations);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  // Update conversation names when profiles load
  useEffect(() => {
    if (profiles.size > 0 && conversations.length > 0) {
      setConversations((prev) =>
        prev.map((conv) => {
          if (!conv.isGroup && conv.participantId) {
            return {
              ...conv,
              name: profiles.get(conv.participantId)?.name || "Unknown",
            };
          }
          return conv;
        })
      );
    }
  }, [profiles]);

  const openConversation = (conversation: Conversation) => {
    if (conversation.isGroup) {
      navigate("/chat?view=group");
    } else if (conversation.participantId) {
      navigate(`/chat?conversation=${conversation.participantId}`);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Messages</h1>
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Messages</h1>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate("/chat")}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="divide-y divide-border">
          {conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No messages yet. Start a conversation!
              </p>
              <Button
                className="mt-4"
                onClick={() => navigate("/chat")}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Message
              </Button>
            </div>
          )}

          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => openConversation(conversation)}
            >
              {/* Avatar */}
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarFallback className={conversation.isGroup ? "bg-primary text-primary-foreground" : "bg-muted"}>
                  {conversation.isGroup ? (
                    <Users className="h-5 w-5" />
                  ) : (
                    getInitials(conversation.name)
                  )}
                </AvatarFallback>
              </Avatar>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-medium truncate ${conversation.unreadCount > 0 ? "text-foreground" : "text-foreground/80"}`}>
                    {conversation.name}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTime(conversation.lastMessageTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={`text-sm truncate ${conversation.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {conversation.lastMessage}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1.5 shrink-0">
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>

              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      </ScrollArea>

      <BottomNav />
    </div>
  );
};

export default Messages;