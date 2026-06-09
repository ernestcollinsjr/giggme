import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Send, Trash2, ArrowLeft, Users, User, Check, CheckCheck, Smile, Forward, Pin, X, Reply, CornerDownRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  reply_to_id: string | null;
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

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

interface PinnedMessage {
  id: string;
  message_id: string;
  conversation_user_id: string;
  pinned_by: string;
  pinned_at: string;
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

const Chat = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Handle URL parameters to open specific conversations
  useEffect(() => {
    if (urlParamsProcessed) return;
    
    const conversationId = searchParams.get("conversation");
    const view = searchParams.get("view");
    
    if (conversationId) {
      setActiveConversation(conversationId);
      setTargetType("direct");
      setRecipientId(conversationId);
      // Clear the URL params after processing
      setSearchParams({});
      setUrlParamsProcessed(true);
    } else if (view === "group") {
      setTargetType("group");
      setSearchParams({});
      setUrlParamsProcessed(true);
    }
  }, [searchParams, setSearchParams, urlParamsProcessed]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
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
        .select("id, sender_id, recipient_id, is_group_message, content, created_at, read_by, reply_to_id")
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

      // Load reactions
      const { data: reactionsData } = await supabase
        .from("message_reactions")
        .select("*");
      if (reactionsData) {
        setReactions(reactionsData as Reaction[]);
      }

      // Load pinned messages
      const { data: pinnedData } = await supabase
        .from("pinned_messages")
        .select("*");
      if (pinnedData) {
        setPinnedMessages(pinnedData as PinnedMessage[]);
      }

      // Realtime subscription for new messages and updates (read receipts)
      const channel = supabase
        .channel(`messages-reactions-pins-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const newMsg = payload.new as Message;
            setMessages((prev) => [...prev, newMsg]);
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          (payload) => {
            const updatedMsg = payload.new as Message;
            setMessages((prev) => 
              prev.map((m) => m.id === updatedMsg.id ? updatedMsg : m)
            );
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "message_reactions" },
          (payload) => {
            const newReaction = payload.new as Reaction;
            setReactions((prev) => [...prev, newReaction]);
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "message_reactions" },
          (payload) => {
            const deletedReaction = payload.old as Reaction;
            setReactions((prev) => prev.filter((r) => r.id !== deletedReaction.id));
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "pinned_messages" },
          (payload) => {
            const newPin = payload.new as PinnedMessage;
            setPinnedMessages((prev) => [...prev, newPin]);
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "pinned_messages" },
          (payload) => {
            const deletedPin = payload.old as PinnedMessage;
            setPinnedMessages((prev) => prev.filter((p) => p.id !== deletedPin.id));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
  }, []);

  // Set up typing indicator channel for conversations
  useEffect(() => {
    if (!userId) {
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      return;
    }

    // Determine channel name based on conversation type
    let channelName: string;
    if (activeConversation) {
      // Direct conversation: unique channel for this conversation pair
      const channelIds = [userId, activeConversation].sort().join('-');
      channelName = `typing:${channelIds}`;
    } else if (targetType === "group") {
      // Group chat: shared channel for all group messages
      channelName = `typing:group`;
    } else {
      // No active conversation and not in group view
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      return;
    }

    const channel = supabase.channel(channelName, {
      config: { presence: { key: userId } }
    });

    const setRemoteTyping = (remoteUserId: string, name: string, isTyping: boolean) => {
      if (!remoteUserId || remoteUserId === userId) return;

      const existingTimeout = remoteTypingTimeoutsRef.current.get(remoteUserId);
      if (existingTimeout) clearTimeout(existingTimeout);

      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (isTyping) {
          next.set(remoteUserId, name || profiles.find(p => p.id === remoteUserId)?.name || 'Someone');
        } else {
          next.delete(remoteUserId);
        }
        return next;
      });

      if (isTyping) {
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(remoteUserId);
            return next;
          });
          remoteTypingTimeoutsRef.current.delete(remoteUserId);
        }, 3500);
        remoteTypingTimeoutsRef.current.set(remoteUserId, timeout);
      } else {
        remoteTypingTimeoutsRef.current.delete(remoteUserId);
      }
    };

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
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        setRemoteTyping(payload?.userId, payload?.name, Boolean(payload?.isTyping));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence with initial state
          const myProfile = profiles.find(p => p.id === userId);
          await channel.track({
            userId,
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
  }, [activeConversation, userId, profiles, targetType]);

  // Handle typing indicator broadcast
  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!typingChannelRef.current || !userId) return;

    const myProfile = profiles.find(p => p.id === userId);
    const payload = {
      userId,
      name: myProfile?.name || 'User',
      isTyping,
    };

    typingChannelRef.current.track(payload);
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload });
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
    
    // Mark incoming messages as read when conversation is open
    if (activeConversation && userId) {
      const unreadFromActiveConversation = messages.filter(
        m => m.sender_id === activeConversation && 
             m.recipient_id === userId && 
             !m.read_by?.includes(userId)
      );
      
      unreadFromActiveConversation.forEach(async (msg) => {
        await supabase.rpc("mark_message_as_read", {
          message_id: msg.id,
          user_id: userId,
        });
        // Update local state
        setMessages((prev) =>
          prev.map((m) => 
            m.id === msg.id ? { ...m, read_by: [...(m.read_by || []), userId] } : m
          )
        );
      });
    }
  }, [messages, activeConversation, userId]);

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
        reply_to_id: replyToMessage?.id || null,
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
      setReplyToMessage(null);
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

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!userId) return;
    
    const existingReaction = reactions.find(
      r => r.message_id === messageId && r.user_id === userId && r.emoji === emoji
    );

    try {
      if (existingReaction) {
        // Remove reaction
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("id", existingReaction.id);
        if (error) throw error;
        setReactions(prev => prev.filter(r => r.id !== existingReaction.id));
      } else {
        // Add reaction
        const { data, error } = await supabase
          .from("message_reactions")
          .insert({ message_id: messageId, user_id: userId, emoji })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setReactions(prev => [...prev, data as Reaction]);
        }
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to react", description: e.message || "Unknown error" });
    }
  };

  const getMessageReactions = (messageId: string) => {
    const messageReactions = reactions.filter(r => r.message_id === messageId);
    const grouped = new Map<string, { count: number; hasUserReacted: boolean }>();
    
    messageReactions.forEach(r => {
      const existing = grouped.get(r.emoji) || { count: 0, hasUserReacted: false };
      existing.count++;
      if (r.user_id === userId) existing.hasUserReacted = true;
      grouped.set(r.emoji, existing);
    });
    
    return grouped;
  };

  const handleForward = async (targetUserId: string) => {
    if (!userId || !forwardMessage) return;
    
    setForwarding(true);
    try {
      const forwardedContent = `↪️ Forwarded message:\n"${forwardMessage.content}"`;
      
      const { error } = await supabase.from("messages").insert({
        sender_id: userId,
        recipient_id: targetUserId,
        is_group_message: false,
        content: forwardedContent,
      });
      
      if (error) throw error;
      
      toast({ title: "Message forwarded", description: `Message sent to ${profilesById.get(targetUserId)?.name || 'user'}` });
      setForwardMessage(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to forward", description: e.message || "Unknown error" });
    } finally {
      setForwarding(false);
    }
  };

  const togglePin = async (message: Message) => {
    if (!userId || !activeConversation) return;
    
    const existingPin = pinnedMessages.find(
      p => p.message_id === message.id && p.pinned_by === userId
    );

    try {
      if (existingPin) {
        // Unpin
        const { error } = await supabase
          .from("pinned_messages")
          .delete()
          .eq("id", existingPin.id);
        if (error) throw error;
        setPinnedMessages(prev => prev.filter(p => p.id !== existingPin.id));
        toast({ title: "Message unpinned" });
      } else {
        // Pin
        const { data, error } = await supabase
          .from("pinned_messages")
          .insert({
            message_id: message.id,
            conversation_user_id: activeConversation,
            pinned_by: userId,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setPinnedMessages(prev => [...prev, data as PinnedMessage]);
        }
        toast({ title: "Message pinned" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to update pin", description: e.message || "Unknown error" });
    }
  };

  const getConversationPinnedMessages = () => {
    if (!activeConversation || !userId) return [];
    return pinnedMessages.filter(
      p => p.pinned_by === userId && p.conversation_user_id === activeConversation
    );
  };

  const openConversation = async (participantId: string) => {
    setActiveConversation(participantId);
    setTargetType("direct");
    setRecipientId(participantId);
    
    // Mark messages as read
    const unreadInConversation = messages.filter(
      m => m.sender_id === participantId && !m.read_by?.includes(userId!)
    );
    
    // Mark all unread messages as read and update local state
    for (const msg of unreadInConversation) {
      await supabase.rpc("mark_message_as_read", {
        message_id: msg.id,
        user_id: userId!,
      });
    }
    
    // Update local state to reflect read status immediately
    if (unreadInConversation.length > 0) {
      setMessages((prev) =>
        prev.map((m) => {
          if (unreadInConversation.some((um) => um.id === m.id)) {
            return { ...m, read_by: [...(m.read_by || []), userId!] };
          }
          return m;
        })
      );
    }
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
              {/* Pinned messages section */}
              {getConversationPinnedMessages().length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Pin className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Pinned Messages</span>
                  </div>
                  <div className="space-y-2">
                    {getConversationPinnedMessages().map((pin) => {
                      const pinnedMsg = messages.find(m => m.id === pin.message_id);
                      if (!pinnedMsg) return null;
                      return (
                        <div key={pin.id} className="flex items-start justify-between gap-2 p-2 bg-background rounded-md">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground mb-0.5">
                              {pinnedMsg.sender_id === userId ? 'You' : profilesById.get(pinnedMsg.sender_id)?.name || 'Unknown'}
                            </p>
                            <p className="text-sm line-clamp-2">{pinnedMsg.content}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => togglePin(pinnedMsg)}
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
                    const isRead = isOwnMessage && m.read_by?.includes(activeConversation);
                    const messageReactions = getMessageReactions(m.id);
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex flex-col",
                          isOwnMessage ? "items-end" : "items-start"
                        )}
                      >
                        <div className="group relative">
                          {/* Reply quote display */}
                          {m.reply_to_id && (() => {
                            const repliedMessage = messages.find(msg => msg.id === m.reply_to_id);
                            if (!repliedMessage) return null;
                            const repliedSender = repliedMessage.sender_id === userId ? 'You' : profilesById.get(repliedMessage.sender_id)?.name || 'Unknown';
                            return (
                              <div className={cn(
                                "mb-1 px-2 py-1.5 rounded-md border-l-2 border-primary/50 bg-muted/30",
                                isOwnMessage ? "ml-auto max-w-[75%]" : "mr-auto max-w-[75%]"
                              )}>
                                <div className="flex items-center gap-1 mb-0.5">
                                  <CornerDownRight className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] font-medium text-primary">{repliedSender}</span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">{repliedMessage.content}</p>
                              </div>
                            );
                          })()}
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
                              "flex items-center gap-1.5 mt-1",
                              isOwnMessage ? "justify-end" : "justify-start"
                            )}>
                              <span className={cn(
                                "text-[10px]",
                                isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                {formatMessageTime(m.created_at)}
                              </span>
                              {isOwnMessage && (
                                <>
                                  {isRead ? (
                                    <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/90" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5 text-primary-foreground/70" />
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-primary-foreground/70 hover:text-destructive hover:bg-primary-foreground/10"
                                    onClick={() => handleDelete(m.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className={cn(
                            "absolute -bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                            isOwnMessage ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
                          )}>
                            {/* Reply button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full bg-background border shadow-sm"
                              onClick={() => setReplyToMessage(m)}
                            >
                              <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            {/* Forward button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full bg-background border shadow-sm"
                              onClick={() => setForwardMessage(m)}
                            >
                              <Forward className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            {/* Pin button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-6 w-6 rounded-full bg-background border shadow-sm",
                                pinnedMessages.some(p => p.message_id === m.id && p.pinned_by === userId) && "text-primary"
                              )}
                              onClick={() => togglePin(m)}
                            >
                              <Pin className="h-3.5 w-3.5" />
                            </Button>
                            {/* Reaction picker button */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-full bg-background border shadow-sm"
                                >
                                  <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2" side={isOwnMessage ? "left" : "right"}>
                                <div className="flex gap-1">
                                  {EMOJI_OPTIONS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => toggleReaction(m.id, emoji)}
                                      className={cn(
                                        "text-lg hover:bg-muted p-1.5 rounded transition-colors",
                                        messageReactions.get(emoji)?.hasUserReacted && "bg-primary/10"
                                      )}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          {/* Reactions display - positioned on top right of bubble */}
                          {messageReactions.size > 0 && (
                            <div className={cn(
                              "absolute -top-2 flex flex-row-reverse",
                              isOwnMessage ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
                            )}>
                              {Array.from(messageReactions.entries()).map(([emoji, data], index) => (
                                <button
                                  key={emoji}
                                  onClick={() => toggleReaction(m.id, emoji)}
                                  style={{ marginLeft: index > 0 ? '-8px' : '0' }}
                                  className={cn(
                                    "flex items-center gap-0.5 px-1 py-0.5 rounded-full text-xs border shadow-sm transition-colors z-10",
                                    data.hasUserReacted 
                                      ? "bg-primary/10 border-primary/30" 
                                      : "bg-background border-border hover:bg-muted"
                                  )}
                                >
                                  <span className="text-sm">{emoji}</span>
                                  {data.count > 1 && <span className="text-[10px] text-muted-foreground">{data.count}</span>}
                                </button>
                              ))}
                            </div>
                          )}
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

              {/* Reply preview */}
              {replyToMessage && (
                <div className="flex items-start justify-between gap-2 p-2 bg-muted/50 rounded-lg border-l-2 border-primary">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Reply className="h-3 w-3 text-primary" />
                      <span className="text-xs font-medium text-primary">
                        Replying to {replyToMessage.sender_id === userId ? 'yourself' : profilesById.get(replyToMessage.sender_id)?.name || 'Unknown'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{replyToMessage.content}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => setReplyToMessage(null)}
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              )}

              {/* Message input */}
              <div className="flex gap-2 pt-2 border-t">
                <Textarea
                  placeholder={replyToMessage ? "Type your reply..." : "Type a message..."}
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
                  <Label htmlFor="message">Message to Everyone</Label>
                  <Textarea
                    id="message"
                    placeholder="Type your message..."
                    value={text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        broadcastTyping(false);
                        handleSend();
                      }
                    }}
                    rows={3}
                  />
                </div>

                {/* Typing indicator for group */}
                {typingUsers.size > 0 && (
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Array.from(typingUsers.values()).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                    </span>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={() => { broadcastTyping(false); handleSend(); }} disabled={sending} className="gap-2">
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

      {/* Forward Message Dialog */}
      <Dialog open={!!forwardMessage} onOpenChange={(open) => !open && setForwardMessage(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Forward Message</DialogTitle>
            <DialogDescription>
              Choose who to forward this message to
            </DialogDescription>
          </DialogHeader>
          {forwardMessage && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground mb-1">Message:</p>
                <p className="text-sm line-clamp-3">{forwardMessage.content}</p>
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {profiles
                    .filter(p => p.id !== forwardMessage.sender_id)
                    .map((profile) => (
                      <button
                        key={profile.id}
                        disabled={forwarding}
                        onClick={() => handleForward(profile.id)}
                        className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left disabled:opacity-50"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={profile.photo_urls?.[0]} />
                          <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{profile.name}</span>
                      </button>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Chat;
