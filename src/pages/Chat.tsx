import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Send, Trash2, ArrowLeft, Users, User } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  photo_urls: string[] | null;
}

interface Conversation {
  participantId: string;
  participant: Profile | null;
  lastMessage: Message;
  unreadCount: number;
}

interface TypingUser {
  oderId: string;
  name: string;
  isTyping: boolean;
}

const Chat = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [targetType, setTargetType] = useState<"group" | "direct">("group");
  const [recipientId, setRecipientId] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      
      setUserRole(roleData?.role || null);

      // Load users (exclude self)
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name, photo_urls");
      
      setProfiles((profs as Profile[] | null)?.filter(p => p.id !== user.id) || []);

      // Load existing messages visible to this user
      const { data: msgs, error: msgErr } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, is_group_message, content, created_at, read_by")
        .order("created_at", { ascending: true });
      if (!msgErr) {
        setMessages((msgs as Message[]) || []);
        
        // Mark all visible messages as read
        const unreadMessages = (msgs as Message[])?.filter(
          m => m.sender_id !== user.id && !m.read_by?.includes(user.id)
        );
        
        for (const msg of unreadMessages || []) {
          await supabase.rpc("mark_message_as_read", {
            message_id: msg.id,
            user_id: user.id,
          });
        }
      }

      // Realtime subscription
      const channel = supabase
        .channel("messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const newMsg = payload.new as Message;
            setMessages((prev) => [...prev, newMsg]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
  }, []);

  // Set up typing indicator channel when conversation is active
  useEffect(() => {
    if (!activeConversation || !userId) {
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      return;
    }

    // Create a unique channel for this conversation pair
    const channelIds = [userId, activeConversation].sort().join('-');
    const channelName = `typing:${channelIds}`;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: userId } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const newTypingUsers = new Map<string, string>();
        
        Object.entries(state).forEach(([key, presences]) => {
          if (key !== userId && Array.isArray(presences)) {
            const presence = presences[0] as any;
            if (presence?.isTyping) {
              newTypingUsers.set(key, presence.name || 'Someone');
            }
          }
        });
        
        setTypingUsers(newTypingUsers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence with initial state
          const myProfile = profiles.find(p => p.id === userId);
          await channel.track({
            oderId: userId,
            name: myProfile?.name || 'User',
            isTyping: false,
          });
        }
      });

    typingChannelRef.current = channel;

    return () => {
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
    };
  }, [activeConversation, userId, profiles]);

  // Handle typing indicator broadcast
  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!typingChannelRef.current || !userId) return;

    const myProfile = profiles.find(p => p.id === userId);
    typingChannelRef.current.track({
      oderId: userId,
      name: myProfile?.name || 'User',
      isTyping,
    });
  }, [userId, profiles]);

  // Handle text change with typing indicator
  const handleTextChange = useCallback((value: string) => {
    setText(value);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (value.trim()) {
      // Broadcast that user is typing
      broadcastTyping(true);

      // Set timeout to stop typing indicator after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        broadcastTyping(false);
      }, 2000);
    } else {
      broadcastTyping(false);
    }
  }, [broadcastTyping]);

  // Clear typing indicator on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeConversation]);

  const profilesById = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach(p => map.set(p.id, p));
    return map;
  }, [profiles]);

  const senderName = (id: string) => (id === userId ? "You" : (profilesById.get(id)?.name || "Unknown"));
  const recipientName = (id: string | null) => (id ? (id === userId ? "You" : (profilesById.get(id)?.name || "Unknown")) : "Everyone");

  // Get direct message conversations grouped by participant
  const conversations = useMemo(() => {
    if (!userId) return [];
    
    const directMessages = messages.filter(m => !m.is_group_message);
    const conversationMap = new Map<string, Conversation>();

    directMessages.forEach(m => {
      // Get the other participant in the conversation
      const otherParticipant = m.sender_id === userId ? m.recipient_id : m.sender_id;
      if (!otherParticipant) return;

      const existing = conversationMap.get(otherParticipant);
      const isUnread = m.sender_id !== userId && !m.read_by?.includes(userId);

      if (!existing || new Date(m.created_at) > new Date(existing.lastMessage.created_at)) {
        conversationMap.set(otherParticipant, {
          participantId: otherParticipant,
          participant: profilesById.get(otherParticipant) || null,
          lastMessage: m,
          unreadCount: (existing?.unreadCount || 0) + (isUnread ? 1 : 0),
        });
      } else if (isUnread) {
        existing.unreadCount++;
      }
    });

    // Sort by most recent message
    return Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [messages, userId, profilesById]);

  // Get messages for active conversation
  const conversationMessages = useMemo(() => {
    if (!activeConversation || !userId) return [];
    return messages.filter(m => 
      !m.is_group_message && 
      ((m.sender_id === userId && m.recipient_id === activeConversation) ||
       (m.sender_id === activeConversation && m.recipient_id === userId))
    );
  }, [messages, activeConversation, userId]);

  // Filter messages based on target type
  const filteredMessages = useMemo(() => {
    if (targetType === "group") {
      return messages.filter(m => m.is_group_message);
    } else {
      return messages.filter(m => !m.is_group_message);
    }
  }, [messages, targetType]);

  const handleSend = async () => {
    if (!userId) return;
    if (!text.trim()) {
      toast({ variant: "destructive", title: "Message is empty", description: "Type something to send." });
      return;
    }
    
    const actualRecipient = activeConversation || recipientId;
    if (targetType === "direct" && !actualRecipient) {
      toast({ variant: "destructive", title: "Choose a recipient", description: "Select who to send to." });
      return;
    }

    setSending(true);
    try {
      const { data: insertedMessage, error } = await supabase.from("messages").insert({
        sender_id: userId,
        recipient_id: targetType === "direct" ? actualRecipient! : null,
        is_group_message: targetType === "group",
        content: text.trim(),
      }).select().single();
      
      if (error) throw error;
      
      // Send push notification for direct messages
      if (targetType === "direct" && actualRecipient && insertedMessage) {
        try {
          await supabase.functions.invoke("notify-new-message", {
            body: {
              message_id: insertedMessage.id,
              sender_id: userId,
              recipient_id: actualRecipient,
              content: text.trim(),
            },
          });
        } catch (notifyError) {
          console.error("Failed to send push notification:", notifyError);
          // Don't fail the message send if notification fails
        }
      }
      
      setText("");
      if (targetType === "direct" && !activeConversation) {
        toast({ title: "Sent", description: `Direct message to ${recipientName(actualRecipient!)} sent.` });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to send", description: e.message || "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      const { error } = await supabase.from("messages").delete().eq("id", messageId);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast({ title: "Deleted", description: "Message deleted successfully." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: e.message || "Unknown error" });
    }
  };

  const openConversation = (participantId: string) => {
    setActiveConversation(participantId);
    setTargetType("direct");
    setRecipientId(participantId);
    
    // Mark messages as read
    const unreadInConversation = messages.filter(
      m => m.sender_id === participantId && !m.read_by?.includes(userId!)
    );
    unreadInConversation.forEach(async (msg) => {
      await supabase.rpc("mark_message_as_read", {
        message_id: msg.id,
        user_id: userId!,
      });
    });
  };

  const startNewConversation = (participantId: string) => {
    setActiveConversation(participantId);
    setTargetType("direct");
    setRecipientId(participantId);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Render conversation thread view
  if (activeConversation) {
    const participant = profilesById.get(activeConversation);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 pb-20">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setActiveConversation(null)}
                  className="h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={participant?.photo_urls?.[0]} />
                  <AvatarFallback>{getInitials(participant?.name || 'U')}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">{participant?.name || 'Unknown'}</CardTitle>
                  <CardDescription className="text-xs">Direct conversation</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[400px] pr-4" ref={scrollRef as any}>
                <div className="space-y-3">
                  {conversationMessages.length === 0 && (
                    <div className="text-center py-12">
                      <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        No messages yet
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Start the conversation by sending a message
                      </p>
                    </div>
                  )}
                  {conversationMessages.map((m) => {
                    const isOwnMessage = m.sender_id === userId;
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex",
                          isOwnMessage ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] p-3 rounded-lg",
                            isOwnMessage
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted rounded-bl-sm"
                          )}
                        >
                          <p className="text-sm">{m.content}</p>
                          <div className={cn(
                            "flex items-center gap-2 mt-1",
                            isOwnMessage ? "justify-end" : "justify-start"
                          )}>
                            <span className={cn(
                              "text-[10px]",
                              isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}>
                              {formatMessageTime(m.created_at)}
                            </span>
                            {isOwnMessage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-primary-foreground/70 hover:text-destructive hover:bg-primary-foreground/10"
                                onClick={() => handleDelete(m.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <div className="flex items-center gap-2 px-1">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {Array.from(typingUsers.values()).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              )}

              {/* Message input */}
              <div className="flex gap-2 pt-2 border-t">
                <Textarea
                  placeholder="Type a message..."
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  rows={2}
                  className="flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      broadcastTyping(false);
                      handleSend();
                    }
                  }}
                />
                <Button onClick={() => { broadcastTyping(false); handleSend(); }} disabled={sending} size="icon" className="h-auto">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 pb-20">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Messages
            </CardTitle>
            <CardDescription>Send a group announcement or a direct message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* View toggle */}
            <div className="flex gap-2">
              <Button
                variant={targetType === "group" ? "default" : "outline"}
                size="sm"
                onClick={() => setTargetType("group")}
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                Group Messages
              </Button>
              <Button
                variant={targetType === "direct" ? "default" : "outline"}
                size="sm"
                onClick={() => setTargetType("direct")}
                className="gap-2"
              >
                <User className="h-4 w-4" />
                Direct Messages
              </Button>
            </div>

            {targetType === "group" ? (
              <>
                {/* Group message compose */}
                <div className="space-y-2">
                  <Label htmlFor="message">Message to {userRole === "booking_manager" ? "All Artists" : "Everyone"}</Label>
                  <Textarea
                    id="message"
                    placeholder="Type your message..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSend} disabled={sending} className="gap-2">
                    <Send className="h-4 w-4" />
                    Send to All
                  </Button>
                </div>

                {/* Group messages list */}
                <div className="space-y-2">
                  <Label>Group Messages</Label>
                  <ScrollArea className="h-[300px] border rounded-md p-3" ref={scrollRef as any}>
                    <div className="space-y-3">
                      {filteredMessages.length === 0 && (
                        <div className="text-center py-12">
                          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            No group messages yet
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Send a message to everyone using the form above
                          </p>
                        </div>
                      )}
                      {filteredMessages.map((m) => (
                        <div key={m.id} className="p-3 rounded-md border bg-background">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>From {senderName(m.sender_id)}</span>
                            <div className="flex items-center gap-2">
                              <span>{formatMessageTime(m.created_at)}</span>
                              {m.sender_id === userId && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDelete(m.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 text-sm">{m.content}</p>
                          {m.sender_id !== userId && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                                onClick={() => startNewConversation(m.sender_id)}
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                Reply to {senderName(m.sender_id)}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            ) : (
              <>
                {/* Conversations list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Conversations</Label>
                    <Select value={recipientId} onValueChange={(id) => startNewConversation(id)}>
                      <SelectTrigger className="w-[180px] h-8">
                        <SelectValue placeholder="New conversation" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <ScrollArea className="h-[380px] border rounded-md">
                    {conversations.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          No conversations yet
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                          Start a new conversation by selecting someone above
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {conversations.map((conv) => (
                          <button
                            key={conv.participantId}
                            onClick={() => openConversation(conv.participantId)}
                            className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={conv.participant?.photo_urls?.[0]} />
                              <AvatarFallback>
                                {getInitials(conv.participant?.name || 'U')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm truncate">
                                  {conv.participant?.name || 'Unknown'}
                                </p>
                                <span className="text-xs text-muted-foreground">
                                  {formatMessageTime(conv.lastMessage.created_at)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <p className="text-xs text-muted-foreground truncate pr-2">
                                  {conv.lastMessage.sender_id === userId ? "You: " : ""}
                                  {conv.lastMessage.content}
                                </p>
                                {conv.unreadCount > 0 && (
                                  <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
                                    {conv.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
};

export default Chat;
