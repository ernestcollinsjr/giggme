import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Plus, Users, User, Send, Trash2, ArrowLeft, Check, CheckCheck, Smile, Forward, Pin, X, Reply, CornerDownRight, Search, RefreshCw, MoreVertical, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
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
  id: string;
  name: string;
  isGroup: boolean;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  participantId?: string;
  photo?: string | null;
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

// Separate component to ensure fresh profile data is used
const ChatHeader = ({ 
  activeConversation, 
  profiles,
  profilesLoaded,
  getInitials 
}: { 
  activeConversation: Conversation; 
  profiles: Record<string, Profile>;
  profilesLoaded: boolean;
  getInitials: (name: string) => string;
}) => {
  // ALWAYS get fresh profile data directly from profiles object
  const partnerProfile = activeConversation.participantId 
    ? profiles[activeConversation.participantId] 
    : null;
  
  const isLoading = !profilesLoaded && !activeConversation.isGroup;
  const displayName = activeConversation.isGroup 
    ? "Group Chat" 
    : (partnerProfile?.name || activeConversation.name || (isLoading ? "" : "Unknown"));
  const displayPhoto = activeConversation.isGroup 
    ? null 
    : (partnerProfile?.photo_urls?.[0] || activeConversation.photo || null);
  
  return (
    <>
      {isLoading ? (
        <Skeleton className="h-10 w-10 rounded-full" />
      ) : (
        <Avatar className="h-10 w-10" key={`header-avatar-${activeConversation.participantId}-${displayPhoto || 'none'}`}>
          {activeConversation.isGroup ? (
            <AvatarFallback className="bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </AvatarFallback>
          ) : (
            <>
              {displayPhoto && <AvatarImage src={displayPhoto} />}
              <AvatarFallback>{getInitials(displayName || "?")}</AvatarFallback>
            </>
          )}
        </Avatar>
      )}
      <div className="flex-1">
        {isLoading ? (
          <>
            <Skeleton className="h-5 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </>
        ) : (
          <>
            <h2 className="font-semibold">{displayName}</h2>
            <p className="text-xs text-muted-foreground">
              {activeConversation.isGroup ? "Group Message" : "Direct Message"}
            </p>
          </>
        )}
      </div>
    </>
  );
};


const Messages = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<"direct" | "groups">("direct");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Scroll detection
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const atBottom = scrollHeight - scrollTop - clientHeight < 50;
        setIsAtBottom(atBottom);
      }
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    const doScroll = () => {
      // Method 1: Use scrollRef
      if (scrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
      // Method 2: Find any scroll viewport in the chat area
      const allViewports = document.querySelectorAll('[data-radix-scroll-area-viewport]');
      allViewports.forEach(viewport => {
        viewport.scrollTop = viewport.scrollHeight;
      });
    };
    
    // Scroll multiple times to handle mobile keyboard animation
    // This mimics native phone messaging behavior
    doScroll();
    setTimeout(doScroll, 100);
    setTimeout(doScroll, 300);
    setTimeout(doScroll, 500);
  }, []);

  // Attach scroll listener
  useEffect(() => {
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, activeConversation]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Handle URL parameters
  useEffect(() => {
    const conversationId = searchParams.get("conversation");
    const view = searchParams.get("view");
    
    if (conversationId && Object.keys(profiles).length > 0) {
      const profile = profiles[conversationId];
      setActiveConversation({
        id: conversationId,
        name: profile?.name || "Unknown",
        isGroup: false,
        lastMessage: "",
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
        participantId: conversationId,
        photo: profile?.photo_urls?.[0] || null
      });
      setActiveTab("direct");
      setSearchParams({});
    } else if (view === "group") {
      const groupConv = conversations.find(c => c.isGroup);
      if (groupConv) {
        setActiveConversation(groupConv);
      }
      setActiveTab("groups");
      setSearchParams({});
    }
  }, [searchParams, profiles, conversations]);

  // Update active conversation when profiles load to ensure fresh data
  useEffect(() => {
    if (!profilesLoaded || !activeConversation || activeConversation.isGroup) return;
    
    const participantId = activeConversation.participantId;
    if (!participantId) return;
    
    const freshProfile = profiles[participantId];
    if (freshProfile && (activeConversation.name === "Unknown" || !activeConversation.photo)) {
      setActiveConversation(prev => prev ? {
        ...prev,
        name: freshProfile.name || prev.name,
        photo: freshProfile.photo_urls?.[0] || prev.photo
      } : null);
    }
  }, [profilesLoaded, profiles, activeConversation?.participantId]);

  useEffect(() => {
    if (!userId) return;
    fetchProfiles();
    fetchMessages();
    fetchReactionsAndPins();

    // Realtime subscription
    const channel = supabase
      .channel("messages-page-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAllMessages((prev) => [...prev, payload.new as Message]);
            // Auto-scroll to bottom when new message arrives
            setTimeout(() => {
              const allViewports = document.querySelectorAll('[data-radix-scroll-area-viewport]');
              allViewports.forEach(viewport => {
                viewport.scrollTop = viewport.scrollHeight;
              });
            }, 200);
          } else if (payload.eventType === "UPDATE") {
            setAllMessages((prev) =>
              prev.map((m) => (m.id === (payload.new as Message).id ? (payload.new as Message) : m))
            );
          } else if (payload.eventType === "DELETE") {
            setAllMessages((prev) => prev.filter((m) => m.id !== (payload.old as Message).id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => fetchReactionsAndPins()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pinned_messages" },
        () => fetchReactionsAndPins()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Set up typing indicator channel
  useEffect(() => {
    if (!userId || !activeConversation) {
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      return;
    }

    let channelName: string;
    if (activeConversation.isGroup) {
      channelName = `typing:group`;
    } else if (activeConversation.participantId) {
      const channelIds = [userId, activeConversation.participantId].sort().join('-');
      channelName = `typing:${channelIds}`;
    } else {
      return;
    }

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
          const myProfile = profiles[userId];
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

  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!typingChannelRef.current || !userId) return;
    const myProfile = profiles[userId];
    typingChannelRef.current.track({
      oderId: userId,
      name: myProfile?.name || 'User',
      isTyping,
    });
  }, [userId, profiles]);

  const handleTextChange = useCallback((value: string) => {
    console.log("handleTextChange called with:", value);
    setText(value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (value.trim()) {
      broadcastTyping(true);
      typingTimeoutRef.current = setTimeout(() => broadcastTyping(false), 2000);
    } else {
      broadcastTyping(false);
    }
  }, [broadcastTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, name, photo_urls");
    if (data) {
      const profileObj: Record<string, Profile> = {};
      data.forEach((p) => { profileObj[p.id] = p as Profile; });
      setProfiles(profileObj);
      setProfilesList(data.filter((p) => p.id !== userId) as Profile[]);
    }
    setProfilesLoaded(true);
  };

  const fetchMessages = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setAllMessages((data as Message[]) || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReactionsAndPins = async () => {
    const [reactionsRes, pinsRes] = await Promise.all([
      supabase.from("message_reactions").select("*"),
      supabase.from("pinned_messages").select("*")
    ]);
    if (reactionsRes.data) setReactions(reactionsRes.data as Reaction[]);
    if (pinsRes.data) setPinnedMessages(pinsRes.data as PinnedMessage[]);
  };

  // Build conversations from messages
  const groupedConversations = useMemo(() => {
    if (!userId) return { direct: [], group: null as Conversation | null };
    
    const conversationMap = new Map<string, Conversation>();
    
    // Group chat
    const groupMessages = allMessages.filter((m) => m.is_group_message);
    let groupConv: Conversation | null = null;
    if (groupMessages.length > 0) {
      const sortedGroup = [...groupMessages].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const unreadGroupCount = groupMessages.filter(
        (m) => m.sender_id !== userId && !m.read_by?.includes(userId)
      ).length;
      
      groupConv = {
        id: "group",
        name: "Group Chat",
        isGroup: true,
        lastMessage: sortedGroup[0].content,
        lastMessageTime: sortedGroup[0].created_at,
        unreadCount: unreadGroupCount,
      };
    }

    // Direct conversations
    const directMessages = allMessages.filter((m) => !m.is_group_message);
    directMessages.forEach((message) => {
      const otherParticipantId = message.sender_id === userId 
        ? message.recipient_id 
        : message.sender_id;
      
      if (!otherParticipantId) return;
      
      const existing = conversationMap.get(otherParticipantId);
      const isNewer = !existing || new Date(message.created_at) > new Date(existing.lastMessageTime);
      
      if (isNewer) {
        const profile = profiles[otherParticipantId];
        const isUnread = message.sender_id !== userId && !message.read_by?.includes(userId);
        
        conversationMap.set(otherParticipantId, {
          id: otherParticipantId,
          name: profile?.name || "Unknown",
          isGroup: false,
          lastMessage: message.content,
          lastMessageTime: message.created_at,
          unreadCount: (existing?.unreadCount || 0) + (isUnread ? 1 : 0),
          participantId: otherParticipantId,
          photo: profile?.photo_urls?.[0] || null
        });
      } else if (message.sender_id !== userId && !message.read_by?.includes(userId)) {
        existing!.unreadCount++;
      }
    });

    const directConvs = Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    return { direct: directConvs, group: groupConv };
  }, [allMessages, userId, profiles]);

  // Get messages for active conversation
  const conversationMessages = useMemo(() => {
    if (!activeConversation || !userId) return [];
    
    if (activeConversation.isGroup) {
      return allMessages.filter(m => m.is_group_message).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    
    return allMessages.filter(m => 
      !m.is_group_message && 
      ((m.sender_id === userId && m.recipient_id === activeConversation.participantId) ||
       (m.sender_id === activeConversation.participantId && m.recipient_id === userId))
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [allMessages, activeConversation, userId]);

  // Auto-scroll and mark as read
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    
    if (activeConversation && userId && !activeConversation.isGroup) {
      const unread = conversationMessages.filter(
        m => m.sender_id === activeConversation.participantId && !m.read_by?.includes(userId)
      );
      unread.forEach(async (msg) => {
        await supabase.rpc("mark_message_as_read", { message_id: msg.id, user_id: userId });
      });
    }
  }, [conversationMessages, activeConversation, userId]);

  const filteredConversations = useMemo(() => {
    const list = activeTab === "groups" 
      ? (groupedConversations.group ? [groupedConversations.group] : [])
      : groupedConversations.direct;
    
    if (!searchQuery.trim()) return list;
    return list.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [groupedConversations, activeTab, searchQuery]);

  const openConversation = async (conversation: Conversation) => {
    // Get fresh profile data if available
    const freshProfile = conversation.participantId 
      ? profiles[conversation.participantId] 
      : null;
    
    // Update conversation with fresh profile data
    const updatedConversation = freshProfile ? {
      ...conversation,
      name: freshProfile.name || conversation.name,
      photo: freshProfile.photo_urls?.[0] || conversation.photo
    } : conversation;
    
    setActiveConversation(updatedConversation);
    
    if (!conversation.isGroup && userId) {
      const unread = allMessages.filter(
        m => !m.is_group_message && 
             m.sender_id === conversation.participantId && 
             !m.read_by?.includes(userId)
      );
      for (const msg of unread) {
        await supabase.rpc("mark_message_as_read", { message_id: msg.id, user_id: userId });
      }
    }
  };

  const handleSend = async () => {
    if (!userId || !text.trim() || !activeConversation) return;
    
    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: userId,
        recipient_id: activeConversation.isGroup ? null : activeConversation.participantId,
        is_group_message: activeConversation.isGroup,
        content: text.trim(),
        reply_to_id: replyToMessage?.id || null,
      });
      
      if (error) throw error;
      setText("");
      setReplyToMessage(null);
      broadcastTyping(false);
      
      // Scroll to bottom after sending
      scrollToBottom();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to send", description: e.message });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await supabase.from("messages").delete().eq("id", messageId);
      toast({ title: "Deleted", description: "Message deleted." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!userId) return;
    const existing = reactions.find(r => r.message_id === messageId && r.user_id === userId && r.emoji === emoji);
    
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
    }
  };

  const togglePin = async (message: Message) => {
    if (!userId || !activeConversation || activeConversation.isGroup) return;
    
    const existingPin = pinnedMessages.find(
      p => p.message_id === message.id && p.pinned_by === userId
    );
    
    if (existingPin) {
      await supabase.from("pinned_messages").delete().eq("id", existingPin.id);
      toast({ title: "Unpinned" });
    } else {
      await supabase.from("pinned_messages").insert({
        message_id: message.id,
        pinned_by: userId,
        conversation_user_id: activeConversation.participantId!,
      });
      toast({ title: "Pinned" });
    }
  };

  const handleForward = async (recipientId: string) => {
    if (!forwardMessage || !userId) return;
    setForwarding(true);
    try {
      await supabase.from("messages").insert({
        sender_id: userId,
        recipient_id: recipientId,
        is_group_message: false,
        content: `[Forwarded] ${forwardMessage.content}`,
      });
      toast({ title: "Message forwarded" });
      setForwardMessage(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e.message });
    } finally {
      setForwarding(false);
    }
  };

  const startNewConversation = (participantId: string) => {
    const profile = profiles[participantId];
    setActiveConversation({
      id: participantId,
      name: profile?.name || "Unknown",
      isGroup: false,
      lastMessage: "",
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      participantId,
      photo: profile?.photo_urls?.[0] || null
    });
    setNewConversationOpen(false);
    setActiveTab("direct");
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString([], { 
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit' 
    });
  };

  const getMessageReactions = (messageId: string) => {
    const msgReactions = reactions.filter(r => r.message_id === messageId);
    const grouped = new Map<string, { count: number; hasUserReacted: boolean }>();
    msgReactions.forEach(r => {
      const existing = grouped.get(r.emoji);
      if (existing) {
        existing.count++;
        if (r.user_id === userId) existing.hasUserReacted = true;
      } else {
        grouped.set(r.emoji, { count: 1, hasUserReacted: r.user_id === userId });
      }
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - Conversation List */}
        <div className={cn(
          "w-full md:w-80 lg:w-96 border-r border-border flex flex-col bg-background",
          activeConversation && "hidden md:flex"
        )}>
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="md:hidden">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-xl font-semibold flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    Messages
                  </h1>
                  <p className="text-xs text-muted-foreground">Direct & group messages</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-3">
              <Button
                variant={activeTab === "direct" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("direct")}
                className="flex-1 gap-2"
              >
                <User className="h-4 w-4" />
                Direct
              </Button>
              <Button
                variant={activeTab === "groups" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("groups")}
                className="flex-1 gap-2"
              >
                <Users className="h-4 w-4" />
                Groups
              </Button>
            </div>

            {/* New Conversation Button */}
            <Button 
              className="w-full gap-2 mb-3" 
              onClick={() => setNewConversationOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New Conversation
            </Button>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-center text-sm">
                  {activeTab === "groups" ? "No group messages yet" : "No conversations yet"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredConversations.map((conversation) => {
                  // Get fresh profile data for display
                  const freshProfile = !conversation.isGroup && conversation.participantId 
                    ? profiles[conversation.participantId] 
                    : null;
                  const isProfileLoading = !profilesLoaded && !conversation.isGroup;
                  const displayName = isProfileLoading ? "" : (freshProfile?.name || conversation.name);
                  const displayPhoto = freshProfile?.photo_urls?.[0] || conversation.photo;
                  
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => openConversation(conversation)}
                      className={cn(
                        "w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left",
                        activeConversation?.id === conversation.id && "bg-muted"
                      )}
                    >
                      {isProfileLoading ? (
                        <Skeleton className="h-12 w-12 rounded-full" />
                      ) : (
                        <Avatar className="h-12 w-12">
                          {conversation.isGroup ? (
                            <AvatarFallback className="bg-primary/10">
                              <Users className="h-5 w-5 text-primary" />
                            </AvatarFallback>
                          ) : (
                            <>
                              <AvatarImage src={displayPhoto || undefined} />
                              <AvatarFallback>{getInitials(displayName || "?")}</AvatarFallback>
                            </>
                          )}
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          {isProfileLoading ? (
                            <Skeleton className="h-4 w-24" />
                          ) : (
                            <p className="font-medium text-sm truncate">{displayName}</p>
                          )}
                          <span className="text-xs text-muted-foreground">{formatTime(conversation.lastMessageTime)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-muted-foreground truncate pr-2">{conversation.lastMessage}</p>
                          {conversation.unreadCount > 0 && (
                            <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className={cn(
          "flex-1 flex flex-col bg-muted/30 min-w-0 overflow-hidden",
          !activeConversation && "hidden md:flex"
        )}>
          {activeConversation ? (
            <>
              {/* Chat Header - use key to force re-render when profiles change */}
              <div key={`header-${activeConversation.participantId}-${Object.keys(profiles).length}`} className="flex-shrink-0 p-4 border-b border-border bg-background flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setActiveConversation(null)}
                  className="md:hidden"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <ChatHeader 
                  activeConversation={activeConversation}
                  profiles={profiles}
                  profilesLoaded={profilesLoaded}
                  getInitials={getInitials}
                />
              </div>

              {/* Messages - scrollable area */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full p-4 bg-muted/30" ref={scrollRef as any}>
                <TooltipProvider delayDuration={300}>
                <div className="max-w-3xl mx-auto py-4 px-2">
                  {conversationMessages.length === 0 ? (
                    <div className="text-center py-16">
                      <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    conversationMessages.map((m) => {
                      const isOwn = m.sender_id === userId;
                      const senderProfile = profiles[m.sender_id];
                      const isRead = isOwn && !activeConversation.isGroup && m.read_by?.includes(activeConversation.participantId!);
                      const msgReactions = getMessageReactions(m.id);
                      
                      return (
                        <div 
                          key={m.id} 
                          className={cn(
                            "flex items-start gap-2 mb-4",
                            isOwn ? "justify-end" : "justify-start"
                          )}
                        >
                          {/* Avatar - Left side for received messages */}
                          {!isOwn && (
                            <div className="flex-shrink-0">
                              {!profilesLoaded ? (
                                <Skeleton className="h-8 w-8 rounded-full" />
                              ) : (
                                <Avatar className="h-8 w-8" key={`avatar-${m.sender_id}-${senderProfile?.photo_urls?.[0] || 'none'}`}>
                                  {senderProfile?.photo_urls?.[0] ? (
                                    <AvatarImage src={senderProfile.photo_urls[0]} />
                                  ) : null}
                                  <AvatarFallback className="text-xs bg-muted border border-border">
                                    {getInitials(senderProfile?.name || "U")}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          )}
                          
                          {/* Message bubble */}
                          <div className="max-w-[70%] sm:max-w-[60%] group relative">
                            {/* Reply quote */}
                            {m.reply_to_id && (() => {
                              const repliedMsg = allMessages.find(msg => msg.id === m.reply_to_id);
                              if (!repliedMsg) return null;
                              const repliedSender = repliedMsg.sender_id === userId ? 'You' : profiles[repliedMsg.sender_id]?.name || 'Unknown';
                              return (
                                <div className={cn(
                                  "mb-1 px-3 py-2 rounded-lg border-l-2 border-primary/50 text-xs",
                                  isOwn ? "bg-primary/20" : "bg-muted/50"
                                )}>
                                  <span className="font-medium text-primary">{repliedSender}</span>
                                  <p className="text-muted-foreground line-clamp-1">{repliedMsg.content}</p>
                                </div>
                              );
                            })()}
                            
                            <div className={cn(
                              "px-4 py-2.5 rounded-2xl",
                              isOwn 
                                ? "bg-primary text-primary-foreground rounded-br-sm" 
                                : "bg-card border border-border rounded-bl-sm"
                            )}>
                              {activeConversation.isGroup && !isOwn && (
                                <p className="text-xs font-semibold mb-1 opacity-80">{senderProfile?.name}</p>
                              )}
                              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                            </div>
                            
                            {/* Timestamp below bubble */}
                            <div className={cn(
                              "flex items-center gap-1 mt-1 px-1",
                              isOwn ? "justify-end" : "justify-start"
                            )}>
                              {isOwn && !activeConversation.isGroup && (
                                isRead ? <CheckCheck className="h-3 w-3 text-muted-foreground" /> : <Check className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {formatMessageTime(m.created_at)}
                              </span>
                            </div>

                            {/* Reactions */}
                            {msgReactions.size > 0 && (
                              <div className={cn("flex gap-1 mt-1", isOwn ? "justify-end" : "justify-start")}>
                                {Array.from(msgReactions.entries()).map(([emoji, data]) => (
                                  <button
                                    key={emoji}
                                    onClick={() => toggleReaction(m.id, emoji)}
                                    className={cn(
                                      "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border",
                                      data.hasUserReacted ? "bg-primary/10 border-primary/30" : "bg-background border-border"
                                    )}
                                  >
                                    {emoji} {data.count > 1 && data.count}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Actions */}
                            <div className={cn(
                              "absolute top-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                              isOwn ? "right-0 translate-x-full pl-2" : "left-0 -translate-x-full pr-2"
                            )}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                    setReplyToMessage(m);
                                    setTimeout(() => textareaRef.current?.focus(), 100);
                                  }}>
                                    <Reply className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Reply</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForwardMessage(m)}>
                                    <Forward className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Forward</TooltipContent>
                              </Tooltip>
                              {!activeConversation.isGroup && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className={cn("h-7 w-7", pinnedMessages.some(p => p.message_id === m.id) && "text-primary")}
                                      onClick={() => togglePin(m)}
                                    >
                                      <Pin className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{pinnedMessages.some(p => p.message_id === m.id) ? "Unpin" : "Pin"}</TooltipContent>
                                </Tooltip>
                              )}
                              <Popover>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7">
                                        <Smile className="h-3.5 w-3.5" />
                                      </Button>
                                    </PopoverTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>React</TooltipContent>
                                </Tooltip>
                                <PopoverContent className="w-auto p-2">
                                  <div className="flex gap-1">
                                    {EMOJI_OPTIONS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        onClick={() => toggleReaction(m.id, emoji)}
                                        className="text-lg hover:bg-muted p-1 rounded"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              {isOwn && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(m.id)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                          
                          {/* Avatar - Right side for sent */}
                          {isOwn && (
                            <div className="flex-shrink-0">
                              {!profilesLoaded ? (
                                <Skeleton className="h-8 w-8 rounded-full" />
                              ) : (
                                <Avatar className="h-8 w-8" key={`avatar-own-${profiles[userId!]?.photo_urls?.[0] || 'none'}`}>
                                  {profiles[userId!]?.photo_urls?.[0] ? (
                                    <AvatarImage src={profiles[userId!].photo_urls[0]} />
                                  ) : null}
                                  <AvatarFallback className="text-xs bg-primary/30 border border-primary/50">
                                    {getInitials(profiles[userId!]?.name || "U")}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                </TooltipProvider>
                </ScrollArea>
              </div>

              {/* Bottom input area container - fixed to bottom with space for nav bar */}
              <div className="flex-shrink-0 border-t border-border bg-background p-4">
                {/* Typing indicator */}
                {typingUsers.size > 0 && (
                  <div className="px-4 py-2 flex items-center gap-2 border-b border-border/50">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {Array.from(typingUsers.values()).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                    </span>
                  </div>
                )}

                {/* Reply preview */}
                {replyToMessage && (
                  <div className="mx-4 mt-2 p-2 bg-muted rounded-lg border-l-2 border-primary flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-primary font-medium">
                        <Reply className="h-3 w-3" />
                        Replying to {replyToMessage.sender_id === userId ? 'yourself' : profiles[replyToMessage.sender_id]?.name}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{replyToMessage.content}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyToMessage(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Scroll to bottom button */}
                {!isAtBottom && (
                  <div className="flex justify-center py-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={scrollToBottom}
                      className="rounded-full shadow-lg gap-1"
                    >
                      <ArrowDown className="h-4 w-4" />
                      New messages
                    </Button>
                  </div>
                )}

                {/* Message Input */}
                <div className="flex gap-2 max-w-3xl mx-auto items-end">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Type a message..."
                    value={text}
                    onFocus={scrollToBottom}
                    onChange={(e) => {
                      handleTextChange(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                        if (textareaRef.current) {
                          textareaRef.current.style.height = 'auto';
                        }
                      }
                    }}
                    rows={1}
                    className="flex-1 resize-none min-h-[44px] max-h-32 overflow-y-auto"
                  />
                  <Button 
                    onClick={handleSend} 
                    disabled={sending || !text.trim()} 
                    size="icon" 
                    className="h-11 w-11 rounded-full shrink-0 bg-primary hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Spacer block to push content above bottom navigation bar on mobile */}
              <div className="flex-shrink-0 h-20 bg-background md:hidden" />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h2 className="text-xl font-semibold text-muted-foreground mb-2">Select a conversation</h2>
                <p className="text-sm text-muted-foreground">Choose from your existing conversations or start a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* New Conversation Dialog */}
      <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>Select someone to message</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[300px]">
            <div className="space-y-1">
              {profilesList.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => startNewConversation(profile.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile.photo_urls?.[0]} />
                    <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{profile.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Forward Message Dialog */}
      <Dialog open={!!forwardMessage} onOpenChange={(open) => !open && setForwardMessage(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Forward Message</DialogTitle>
            <DialogDescription>Choose who to forward to</DialogDescription>
          </DialogHeader>
          {forwardMessage && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm line-clamp-3">{forwardMessage.content}</p>
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {profilesList.filter(p => p.id !== forwardMessage.sender_id).map((profile) => (
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

      <BottomNav />
    </div>
  );
};

export default Messages;