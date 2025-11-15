import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
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
  photo_urls: string[] | null;
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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const profilesById = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach(p => map.set(p.id, p));
    return map;
  }, [profiles]);

  const senderName = (id: string) => (id === userId ? "You" : (profilesById.get(id)?.name || "Unknown"));
  const recipientName = (id: string | null) => (id ? (id === userId ? "You" : (profilesById.get(id)?.name || "Unknown")) : "Everyone");

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
    if (targetType === "direct" && !recipientId) {
      toast({ variant: "destructive", title: "Choose a recipient", description: "Select who to send to." });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: userId,
        recipient_id: targetType === "direct" ? recipientId! : null,
        is_group_message: targetType === "group",
        content: text.trim(),
      });
      if (error) throw error;
      setText("");
      if (targetType === "direct") {
        toast({ title: "Sent", description: `Direct message to ${recipientName(recipientId!)} sent.` });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to send", description: e.message || "Unknown error" });
    } finally {
      setSending(false);
    }
  };

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
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-2">
                <Label>Audience</Label>
                <RadioGroup
                  value={targetType}
                  onValueChange={(v) => setTargetType(v as "group" | "direct")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem id="audience-group" value="group" />
                    <Label htmlFor="audience-group">
                      {userRole === "booking_manager" ? "All Artists" : "Everyone"}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem id="audience-direct" value="direct" />
                    <Label htmlFor="audience-direct">Direct Message</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient</Label>
                <Select
                  value={recipientId}
                  onValueChange={setRecipientId}
                  disabled={targetType !== "direct"}
                >
                  <SelectTrigger id="recipient">
                    <SelectValue placeholder={targetType === "direct" ? "Choose a person" : "Disabled for Everyone"} />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
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
                Send
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Recent Messages</Label>
              <ScrollArea className="h-[380px] border rounded-md p-3" ref={scrollRef as any}>
                <div className="space-y-3">
                  {filteredMessages.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {targetType === "group" 
                        ? "No group messages yet" 
                        : "No direct messages yet"}
                    </p>
                  )}
                  {filteredMessages.map((m) => (
                    <div key={m.id} className="p-3 rounded-md border bg-background">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          From {senderName(m.sender_id)} {m.is_group_message ? "to Everyone" : m.recipient_id ? `→ ${recipientName(m.recipient_id)}` : ""}
                        </span>
                        <span>{new Date(m.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-sm">{m.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
};

export default Chat;
