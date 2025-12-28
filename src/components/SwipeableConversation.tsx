import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, ChevronRight, Check, Trash2 } from "lucide-react";

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
}

interface SwipeableConversationProps {
  conversation: Conversation;
  profile?: Profile;
  onOpen: () => void;
  onMarkAsRead: () => void;
  onDelete: () => void;
  formatTime: (dateString: string) => string;
}

const SwipeableConversation = ({
  conversation,
  profile,
  onOpen,
  onMarkAsRead,
  onDelete,
  formatTime,
}: SwipeableConversationProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const SWIPE_THRESHOLD = 80;
  const MAX_SWIPE = 160;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = translateX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const diff = startXRef.current - e.touches[0].clientX;
    const newTranslate = Math.max(0, Math.min(MAX_SWIPE, currentXRef.current + diff));
    setTranslateX(newTranslate);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    if (translateX > SWIPE_THRESHOLD) {
      setTranslateX(MAX_SWIPE);
    } else {
      setTranslateX(0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    currentXRef.current = translateX;
    setIsDragging(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = startXRef.current - e.clientX;
      const newTranslate = Math.max(0, Math.min(MAX_SWIPE, currentXRef.current + diff));
      setTranslateX(newTranslate);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      if (translateX > SWIPE_THRESHOLD) {
        setTranslateX(MAX_SWIPE);
      } else {
        setTranslateX(0);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleClick = () => {
    if (translateX > 0) {
      setTranslateX(0);
    } else {
      onOpen();
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onMarkAsRead();
    setTranslateX(0);
  };

  const handleDelete = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden"
    >
      {/* Action buttons behind */}
      <div className="absolute inset-y-0 right-0 flex">
        <button
          onClick={handleMarkAsRead}
          className="flex items-center justify-center w-20 bg-primary text-primary-foreground"
        >
          <div className="flex flex-col items-center gap-1">
            <Check className="h-5 w-5" />
            <span className="text-xs">Read</span>
          </div>
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center justify-center w-20 bg-destructive text-destructive-foreground"
        >
          <div className="flex flex-col items-center gap-1">
            <Trash2 className="h-5 w-5" />
            <span className="text-xs">Delete</span>
          </div>
        </button>
      </div>

      {/* Main content */}
      <div
        className="flex items-center gap-3 p-4 bg-background cursor-pointer transition-transform"
        style={{ 
          transform: `translateX(-${translateX}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease-out"
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {/* Avatar */}
        <Avatar className="h-12 w-12 shrink-0">
          {!conversation.isGroup && profile?.photo_urls?.[0] && (
            <AvatarImage 
              src={profile.photo_urls[0]} 
              alt={conversation.name}
              className="object-cover"
            />
          )}
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
    </div>
  );
};

export default SwipeableConversation;