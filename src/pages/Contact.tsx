import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import logo from "@/assets/giggme-logo.png";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  category: z.enum(["sales", "tech_support", "other"]),
  message: z.string().trim().min(5, "Message is too short").max(2000),
});

const Contact = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<"sales" | "tech_support" | "other">("sales");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, email, category, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-contact-message", {
        body: parsed.data,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Could not send your message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-white/70 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <img src={logo} alt="GiggMe" className="h-8 w-auto object-contain" />
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-4">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Contact Us</h1>
          <p className="text-white/60">
            Questions, feedback, or need help? Pick a category and we'll route your message to the right team.
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-3" />
            <h2 className="text-xl font-semibold mb-2">Message sent</h2>
            <p className="text-white/60 mb-6">
              Thanks, {name}! We've sent a copy to your inbox and our team will get back to you shortly.
            </p>
            <Button onClick={() => navigate("/")}>Back to home</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div>
              <Label htmlFor="category">What's this about?</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                <SelectTrigger id="category" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="tech_support">Tech Support</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" maxLength={100} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" maxLength={255} required />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1.5 min-h-[140px]" maxLength={2000} required />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Sending..." : "Send message"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
};

export default Contact;
