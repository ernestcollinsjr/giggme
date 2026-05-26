import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Plus, Users, User, Send, Trash2, ArrowLeft, Check, CheckCheck, Smile, Forward, Pin, X, Reply, Search, MoreVertical, ArrowDown, Flag, Ban, Loader2, Copy, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RealtimeChannel } from "@supabase/supabase-js";

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "spam", label: "Spam or scam" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  is_group_message: boolean | null;
  content: string;
  created_at: string;
  read_by: string[] | null;
  delivered_to: string[] | null;
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

interface ReadReceipt {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

interface MessagesChatProps {
  className?: string;
  showHeader?: boolean;
  defaultTab?: "direct" | "groups";
  filterToManagedArtists?: string[]; // Optional: only show conversations with these user IDs
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

const BUBBLE_COLORS = [
  { name: 'Default', value: 'default', class: 'bg-primary' },
  { name: 'Green', value: 'green', class: 'bg-green-500' },
  { name: 'Blue', value: 'blue', class: 'bg-blue-500' },
  { name: 'Purple', value: 'purple', class: 'bg-purple-500' },
  { name: 'Pink', value: 'pink', class: 'bg-pink-500' },
  { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
];

const getBubbleColorClass = (colorValue: string) => {
  const color = BUBBLE_COLORS.find(c => c.value === colorValue);
  return color?.class || 'bg-primary';
};

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
        <Avatar className="h-10 w-10">
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

export const MessagesChat = ({ 
  className, 
  showHeader = true, 
  defaultTab = "direct",
  filterToManagedArtists 
}: MessagesChatProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<"direct" | "groups">(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>([]);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [conversationColors, setConversationColors] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('conversationBubbleColors');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [showColorPicker, setShowColorPicker] = useState(false);

  const [selectedConversationForAction, setSelectedConversationForAction] = useState<Conversation | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const getConversationColorKey = (conv: Conversation | null) => {
    if (!conv) return '';
    return conv.isGroup ? 'group' : conv.participantId || conv.id;
  };

  const getCurrentBubbleColor = () => {
    const key = getConversationColorKey(activeConversation);
    return conversationColors[key] || 'default';
  };

  const handleColorChange = (color: string) => {
    const key = getConversationColorKey(activeConversation);
    if (!key) return;
    const newColors = { ...conversationColors, [key]: color };
    setConversationColors(newColors);
    localStorage.setItem('conversationBubbleColors', JSON.stringify(newColors));
    setShowColorPicker(false);
  };

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
      if (scrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    };
    doScroll();
    setTimeout(doScroll, 100);
    setTimeout(doScroll, 300);
  }, []);

  useEffect(() => {
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, activeConversation]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
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
    fetchReactionsAndPins();

    const channel = supabase
      .channel("messages-chat-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAllMessages((prev) => [...prev, payload.new as Message]);
            setTimeout(scrollToBottom, 200);
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "read_receipts" },
        () => fetchReactionsAndPins()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, scrollToBottom]);

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
    const [reactionsRes, pinsRes, receiptsRes] = await Promise.all([
      supabase.from("message_reactions").select("*"),
      supabase.from("pinned_messages").select("*"),
      supabase.from("read_receipts").select("*")
    ]);
    if (reactionsRes.data) setReactions(reactionsRes.data as Reaction[]);
    if (pinsRes.data) setPinnedMessages(pinsRes.data as PinnedMessage[]);
    if (receiptsRes.data) setReadReceipts(receiptsRes.data as ReadReceipt[]);
  };

  const groupedConversations = useMemo(() => {
    if (!userId) return { direct: [], group: null as Conversation | null };
    
    const conversationMap = new Map<string, Conversation>();
    
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

    const directMessages = allMessages.filter((m) => !m.is_group_message);
    directMessages.forEach((message) => {
      const otherParticipantId = message.sender_id === userId 
        ? message.recipient_id 
        : message.sender_id;
      
      if (!otherParticipantId) return;
      
      // Filter to managed artists if specified
      if (filterToManagedArtists && !filterToManagedArtists.includes(otherParticipantId)) {
        return;
      }
      
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
  }, [allMessages, userId, profiles, filterToManagedArtists]);

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
    const freshProfile = conversation.participantId 
      ? profiles[conversation.participantId] 
      : null;
    
    const updatedConversation = freshProfile ? {
      ...conversation,
      name: freshProfile.name || conversation.name,
      photo: freshProfile.photo_urls?.[0] || conversation.photo
    } : conversation;
    
    setActiveConversation(updatedConversation);
    
    if (userId) {
      const messagesToProcess = allMessages.filter(m => {
        if (conversation.isGroup) {
          return m.is_group_message && m.sender_id !== userId;
        }
        return !m.is_group_message && m.sender_id === conversation.participantId;
      });

      for (const msg of messagesToProcess) {
        if (!msg.delivered_to?.includes(userId)) {
          await supabase.rpc("mark_message_as_delivered", { message_id: msg.id, user_id: userId });
        }
        if (!msg.read_by?.includes(userId)) {
          await supabase.rpc("mark_message_as_read", { message_id: msg.id, user_id: userId });
        }
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

  const getReadTime = (messageId: string, readerId: string) => {
    const receipt = readReceipts.find(r => r.message_id === messageId && r.user_id === readerId);
    return receipt?.read_at || null;
  };

  const formatReadTime = (readAt: string) => {
    const date = new Date(readAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };
  
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

  const handleReportUser = async () => {
    if (!selectedConversationForAction?.participantId || !userId || !reportReason) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("user_reports")
        .insert({
          reporter_id: userId,
          reported_user_id: selectedConversationForAction.participantId,
          reason: reportReason,
          description: reportDescription || null,
        });
      if (error) throw error;
      toast({ title: "Report submitted", description: `${selectedConversationForAction.name} has been reported.` });
      setShowReportDialog(false);
      setReportReason("");
      setReportDescription("");
      setSelectedConversationForAction(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedConversationForAction?.participantId || !userId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("blocked_users")
        .insert({
          blocker_id: userId,
          blocked_id: selectedConversationForAction.participantId,
          reason: blockReason || null,
        });
      if (error) throw error;
      toast({ title: "User blocked", description: `${selectedConversationForAction.name} has been blocked.` });
      setShowBlockDialog(false);
      setBlockReason("");
      setSelectedConversationForAction(null);
      if (activeConversation?.participantId === selectedConversationForAction.participantId) {
        setActiveConversation(null);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter profiles for new conversation based on managed artists
  const availableProfiles = useMemo(() => {
    if (!filterToManagedArtists) return profilesList;
    return profilesList.filter(p => filterToManagedArtists.includes(p.id));
  }, [profilesList, filterToManagedArtists]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center h-96", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-[500px] border border-border rounded-lg overflow-hidden bg-background", className)}>
      {/* Sidebar - Conversation List */}
      <div className={cn(
        "w-full md:w-72 lg:w-80 border-r border-border flex flex-col",
        activeConversation && "hidden md:flex"
      )}>
        {/* Header */}
        {showHeader && (
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Messages</h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-2">
              <Button
                variant={activeTab === "direct" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("direct")}
                className="flex-1 gap-1 h-8"
              >
                <User className="h-3.5 w-3.5" />
                Direct
              </Button>
              <Button
                variant={activeTab === "groups" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("groups")}
                className="flex-1 gap-1 h-8"
              >
                <Users className="h-3.5 w-3.5" />
                Groups
              </Button>
            </div>

            <Button 
              className="w-full gap-1 h-8 text-xs" 
              size="sm"
              onClick={() => setNewConversationOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New Conversation
            </Button>

            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
        )}

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <MessageCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-center text-sm">
                {activeTab === "groups" ? "No group messages yet" : "No conversations yet"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConversations.map((conversation) => {
                const freshProfile = !conversation.isGroup && conversation.participantId 
                  ? profiles[conversation.participantId] 
                  : null;
                const displayName = freshProfile?.name || conversation.name;
                const displayPhoto = freshProfile?.photo_urls?.[0] || conversation.photo;
                
                return (
                  <div
                    key={conversation.id}
                    className={cn(
                      "w-full p-2.5 flex items-center gap-2.5 hover:bg-muted/50 transition-colors text-left relative group cursor-pointer",
                      activeConversation?.id === conversation.id && "bg-muted"
                    )}
                    onClick={() => openConversation(conversation)}
                  >
                    <Avatar className="h-10 w-10">
                      {conversation.isGroup ? (
                        <AvatarFallback className="bg-primary/10">
                          <Users className="h-4 w-4 text-primary" />
                        </AvatarFallback>
                      ) : (
                        <>
                          <AvatarImage src={displayPhoto || undefined} />
                          <AvatarFallback>{getInitials(displayName || "?")}</AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{displayName}</p>
                        <span className="text-[10px] text-muted-foreground">{formatTime(conversation.lastMessageTime)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-muted-foreground truncate pr-2">{conversation.lastMessage}</p>
                        {conversation.unreadCount > 0 && (
                          <Badge variant="default" className="h-4 min-w-4 px-1 text-[10px]">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {!conversation.isGroup && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedConversationForAction(conversation);
                              setShowReportDialog(true);
                            }}
                          >
                            <Flag className="h-3.5 w-3.5 mr-2" />
                            Report
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedConversationForAction(conversation);
                              setShowBlockDialog(true);
                            }}
                          >
                            <Ban className="h-3.5 w-3.5 mr-2" />
                            Block
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
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
            {/* Chat Header */}
            <div className="flex-shrink-0 p-3 border-b border-border bg-background flex items-center gap-2.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveConversation(null)}
                className="md:hidden h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <ChatHeader 
                activeConversation={activeConversation}
                profiles={profiles}
                profilesLoaded={profilesLoaded}
                getInitials={getInitials}
              />
              <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto">
                    <Palette className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <div className="flex gap-1">
                    {BUBBLE_COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => handleColorChange(color.value)}
                        className={cn(
                          "w-6 h-6 rounded-full transition-transform hover:scale-110",
                          color.class,
                          getCurrentBubbleColor() === color.value && "ring-2 ring-offset-2 ring-primary"
                        )}
                        title={color.name}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full p-3" ref={scrollRef as any}>
                <TooltipProvider delayDuration={0}>
                  <div className="max-w-2xl mx-auto py-2">
                    {conversationMessages.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground text-sm">No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      conversationMessages.map((m) => {
                        const isOwn = m.sender_id === userId;
                        const senderProfile = profiles[m.sender_id];
                        const isRead = isOwn && !activeConversation.isGroup && m.read_by?.includes(activeConversation.participantId!);
                        const isDelivered = isOwn && !activeConversation.isGroup && m.delivered_to?.includes(activeConversation.participantId!);
                        const msgReactions = getMessageReactions(m.id);
                        
                        return (
                          <div 
                            key={m.id} 
                            className={cn(
                              "flex items-start gap-2 mb-3",
                              isOwn ? "justify-end" : "justify-start"
                            )}
                          >
                            {!isOwn && (
                              <Avatar className="h-7 w-7">
                                {senderProfile?.photo_urls?.[0] && <AvatarImage src={senderProfile.photo_urls[0]} />}
                                <AvatarFallback className="text-[10px] bg-muted border border-border">
                                  {getInitials(senderProfile?.name || "U")}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            
                            <div className="max-w-[70%] group relative">
                              {m.reply_to_id && (() => {
                                const repliedMsg = allMessages.find(msg => msg.id === m.reply_to_id);
                                if (!repliedMsg) return null;
                                const repliedSender = repliedMsg.sender_id === userId ? 'You' : profiles[repliedMsg.sender_id]?.name || 'Unknown';
                                return (
                                  <div className={cn(
                                    "mb-1 px-2 py-1.5 rounded-lg border-l-2 border-primary/50 text-xs",
                                    isOwn ? "bg-primary/20" : "bg-muted/50"
                                  )}>
                                    <span className="font-medium text-primary">{repliedSender}</span>
                                    <p className="text-muted-foreground line-clamp-1">{repliedMsg.content}</p>
                                  </div>
                                );
                              })()}
                              
                              <div className="relative">
                                <div className={cn(
                                  "relative px-3 py-2 rounded-2xl text-white",
                                  isOwn 
                                    ? `${getBubbleColorClass(getCurrentBubbleColor())} rounded-br-none` 
                                    : "bg-muted text-foreground rounded-bl-none"
                                )}>
                                  {activeConversation.isGroup && !isOwn && (
                                    <p className="text-xs font-semibold mb-0.5 opacity-80">{senderProfile?.name}</p>
                                  )}
                                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                                </div>
                                
                                {msgReactions.size > 0 && (
                                  <div className="absolute -top-2 right-2 flex gap-0.5">
                                    {Array.from(msgReactions.entries()).map(([emoji, data]) => (
                                      <button
                                        key={emoji}
                                        onClick={() => toggleReaction(m.id, emoji)}
                                        className={cn(
                                          "flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] shadow-sm",
                                          data.hasUserReacted 
                                            ? "bg-primary/20 border border-primary/40" 
                                            : "bg-background border border-border"
                                        )}
                                      >
                                        {emoji} {data.count > 1 && <span>{data.count}</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              <div className={cn(
                                "flex items-center gap-1 px-1",
                                msgReactions.size > 0 ? "mt-2" : "mt-0.5",
                                isOwn ? "justify-end" : "justify-start"
                              )}>
                                {isOwn && activeConversation.isGroup && m.read_by && m.read_by.length > 0 && (() => {
                                  const readers = m.read_by.filter(id => id !== userId);
                                  if (readers.length === 0) return null;
                                  
                                  return (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button className="flex items-center -space-x-1 hover:opacity-80">
                                          {readers.slice(0, 3).map((readerId) => {
                                            const reader = profiles[readerId];
                                            return (
                                              <Avatar key={readerId} className="h-3.5 w-3.5 border border-background">
                                                {reader?.photo_urls?.[0] && <AvatarImage src={reader.photo_urls[0]} />}
                                                <AvatarFallback className="text-[6px] bg-muted">
                                                  {getInitials(reader?.name || "?")}
                                                </AvatarFallback>
                                              </Avatar>
                                            );
                                          })}
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-40 p-2" side="top">
                                        <p className="text-[10px] font-medium mb-1.5 text-muted-foreground">Read by</p>
                                        <div className="space-y-1">
                                          {readers.map((readerId) => {
                                            const reader = profiles[readerId];
                                            const readTime = getReadTime(m.id, readerId);
                                            return (
                                              <div key={readerId} className="flex items-center gap-1.5">
                                                <Avatar className="h-4 w-4">
                                                  {reader?.photo_urls?.[0] && <AvatarImage src={reader.photo_urls[0]} />}
                                                  <AvatarFallback className="text-[8px]">
                                                    {getInitials(reader?.name || "?")}
                                                  </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                  <span className="text-[10px]">{reader?.name || "Unknown"}</span>
                                                  {readTime && (
                                                    <span className="text-[8px] text-muted-foreground">
                                                      Read {formatReadTime(readTime)}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  );
                                })()}
                                {isOwn && !activeConversation.isGroup && (() => {
                                  const readTime = activeConversation.participantId 
                                    ? getReadTime(m.id, activeConversation.participantId) 
                                    : null;
                                  
                                  if (isRead) {
                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-0.5 cursor-help">
                                            <CheckCheck className="h-3 w-3 text-primary" />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs">
                                          {readTime ? `Read ${formatReadTime(readTime)}` : "Read"}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  }
                                  
                                  if (isDelivered) {
                                    return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
                                  }
                                  
                                  return <Check className="h-3 w-3 text-muted-foreground" />;
                                })()}
                                <span className="text-[9px] text-muted-foreground">
                                  {formatMessageTime(m.created_at)}
                                </span>
                              </div>

                              {/* Actions */}
                              <div className={cn(
                                "absolute -top-2.5 flex gap-0.5 opacity-0 transition-opacity bg-background/95 backdrop-blur-sm rounded-full shadow-md border border-border px-0.5 py-0.5",
                                "hidden md:flex md:group-hover:opacity-100",
                                isOwn ? "right-2" : "left-2"
                              )}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                      setReplyToMessage(m);
                                      setTimeout(() => textareaRef.current?.focus(), 100);
                                    }}>
                                      <Reply className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Reply</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setForwardMessage(m)}>
                                      <Forward className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Forward</TooltipContent>
                                </Tooltip>
                                {!activeConversation.isGroup && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className={cn("h-6 w-6", pinnedMessages.some(p => p.message_id === m.id) && "text-primary")}
                                        onClick={() => togglePin(m)}
                                      >
                                        <Pin className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">{pinnedMessages.some(p => p.message_id === m.id) ? "Unpin" : "Pin"}</TooltipContent>
                                  </Tooltip>
                                )}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                      <Smile className="h-3 w-3" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-1.5">
                                    <div className="flex gap-0.5">
                                      {EMOJI_OPTIONS.map((emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={() => toggleReaction(m.id, emoji)}
                                          className="text-sm hover:bg-muted p-1 rounded"
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
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(m.id)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Delete</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                            
                            {isOwn && (
                              <Avatar className="h-7 w-7">
                                {profiles[userId!]?.photo_urls?.[0] && <AvatarImage src={profiles[userId!].photo_urls[0]} />}
                                <AvatarFallback className="text-[10px] bg-primary/30 border border-primary/50">
                                  {getInitials(profiles[userId!]?.name || "U")}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </TooltipProvider>
              </ScrollArea>
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t border-border bg-background p-3">
              {typingUsers.size > 0 && (
                <div className="px-2 py-1.5 flex items-center gap-2 border-b border-border/50 mb-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {Array.from(typingUsers.values()).join(', ')} typing...
                  </span>
                </div>
              )}

              {replyToMessage && (
                <div className="mb-2 p-2 bg-muted rounded-lg border-l-2 border-primary flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-xs text-primary font-medium">
                      <Reply className="h-3 w-3" />
                      Replying to {replyToMessage.sender_id === userId ? 'yourself' : profiles[replyToMessage.sender_id]?.name}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{replyToMessage.content}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setReplyToMessage(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {!isAtBottom && (
                <div className="flex justify-center py-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={scrollToBottom}
                    className="rounded-full shadow-lg gap-1 h-7 text-xs"
                  >
                    <ArrowDown className="h-3 w-3" />
                    New messages
                  </Button>
                </div>
              )}

              <div className="flex gap-2 max-w-2xl mx-auto items-end">
                <Textarea
                  ref={textareaRef}
                  placeholder="Type a message..."
                  value={text}
                  onFocus={scrollToBottom}
                  onChange={(e) => {
                    handleTextChange(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
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
                  className="flex-1 resize-none min-h-[40px] max-h-24 overflow-y-auto text-sm"
                />
                <Button 
                  onClick={handleSend} 
                  disabled={sending || !text.trim()} 
                  size="icon" 
                  className="h-10 w-10 rounded-full shrink-0"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>Select someone to start a conversation</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-64">
            <div className="space-y-1">
              {availableProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => startNewConversation(profile.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    {profile.photo_urls?.[0] && <AvatarImage src={profile.photo_urls[0]} />}
                    <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">{profile.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Forward Dialog */}
      <Dialog open={!!forwardMessage} onOpenChange={(open) => !open && setForwardMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward Message</DialogTitle>
            <DialogDescription>Select a recipient</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-64">
            <div className="space-y-1">
              {availableProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleForward(profile.id)}
                  disabled={forwarding}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Avatar className="h-9 w-9">
                    {profile.photo_urls?.[0] && <AvatarImage src={profile.photo_urls[0]} />}
                    <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">{profile.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {selectedConversationForAction?.name}</DialogTitle>
            <DialogDescription>Please select a reason for reporting</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Additional details (optional)</Label>
              <Textarea
                placeholder="Provide more details..."
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowReportDialog(false)}>Cancel</Button>
              <Button onClick={handleReportUser} disabled={!reportReason || actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block {selectedConversationForAction?.name}?</DialogTitle>
            <DialogDescription>
              You will no longer receive messages from this user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="Why are you blocking this user?"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowBlockDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleBlockUser} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Block User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagesChat;
