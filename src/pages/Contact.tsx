import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
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
import {
  ArrowLeft,
  Mail,
  CheckCircle2,
  Headphones,
  Zap,
  Heart,
  Phone,
  MapPin,
  Calendar,
  ShieldCheck,
  Send,
  ArrowRight,
  ChevronRight,
  DollarSign,
  X,
  Video,
  HelpCircle,
  Users,
  ShieldCheck as ShieldIcon,
  Rocket,
  Smartphone,
  RefreshCw,
  Bell,
  CreditCard,
  Star,
} from "lucide-react";
import logo from "@/assets/giggme-logo.png";
import heroBand from "@/assets/hero-band.jpg";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  category: z.enum(["sales", "tech_support", "other"]),
  message: z.string().trim().min(5, "Message is too short").max(2000),
});

const faqs = [
  {
    icon: Rocket,
    color: "text-violet-400",
    bg: "bg-violet-500/15",
    q: "How do I get started?",
    a: "Sign up free, choose whether you're a performer or booking manager, complete your profile, and you're live. Performers can be discovered immediately; managers can start adding their roster and creating gigs right away.",
  },
  {
    icon: DollarSign,
    color: "text-pink-400",
    bg: "bg-pink-500/15",
    q: "How much does GiggMe cost?",
    a: "Performers: Free Plan (basic profile, one photo, one demo video, basic contact info). Performer Pro: $7.99/month (unlimited videos, featured profile, priority search, calendar, gig notifications, booking history).\nBooking Managers: Starter $29/month (up to 20 performers), Professional $79/month (up to 100 performers + payment tracking + reporting), Agency $199/month (unlimited performers, multiple booking managers, Stripe integration, white-label). All Booking Manager plans include a 14-day free trial. Members invited by a manager are always free.",
  },
  {
    icon: CreditCard,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    q: "How does billing work?",
    a: "Subscriptions renew monthly via Stripe. You'll get an email receipt for every payment, and you can update your card or view invoices anytime from your account settings.",
  },
  {
    icon: X,
    color: "text-orange-400",
    bg: "bg-orange-500/15",
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your account in one click — no contracts, no hidden fees. Your account stays active through the end of the current billing period.",
  },
  {
    icon: RefreshCw,
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    q: "What's your refund policy?",
    a: "If you're not satisfied within the first 14 days of a paid subscription, email management@giggme.com and we'll issue a full refund — no questions asked.",
  },
  {
    icon: Users,
    color: "text-violet-400",
    bg: "bg-violet-500/15",
    q: "How does booking work?",
    a: "Managers send booking requests directly through GiggMe. You'll get a push notification, email, and in-app alert. Accept or decline with one tap — confirmed gigs land on your calendar automatically.",
  },
  {
    icon: Video,
    color: "text-pink-400",
    bg: "bg-pink-500/15",
    q: "Can I upload videos and performance clips?",
    a: "Absolutely. Add unlimited photos, videos, audio samples, and YouTube links to your profile so managers can see and hear exactly what you bring to the stage.",
  },
  {
    icon: Bell,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    q: "Will I get notified about gigs and messages?",
    a: "Yes — choose any mix of push, email, and SMS notifications. GiggMe also sends automated gig reminders, arrival tracking, and response deadlines so nothing slips through the cracks.",
  },
  {
    icon: Smartphone,
    color: "text-orange-400",
    bg: "bg-orange-500/15",
    q: "Is there a mobile app?",
    a: "GiggMe works as an installable web app on iPhone and Android — open the site in your browser and tap \"Add to Home Screen\" for a native-feel experience with push notifications.",
  },
  {
    icon: ShieldIcon,
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    q: "Is my information secure?",
    a: "We take security seriously. Your data is encrypted in transit and at rest, payments are processed by Stripe, and we never sell or share your information with third parties.",
  },
  {
    icon: Star,
    color: "text-violet-400",
    bg: "bg-violet-500/15",
    q: "What's Performer Pro?",
    a: "Performer Pro gets you unlimited videos, a featured profile, priority placement in search results, calendar availability, gig notifications, and booking history — for $7.99/month.",
  },
  {
    icon: HelpCircle,
    color: "text-pink-400",
    bg: "bg-pink-500/15",
    q: "Need more help?",
    a: "Email management@giggme.com or use the form above — we typically respond within 4 hours and always within 1 business day.",
  },
];

const Contact = () => {
  const navigate = useNavigate();
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "dark") setTheme("dark");
  }, [resolvedTheme, setTheme]);

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
      {/* Top nav */}
      <header className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={logo} alt="GiggMe" className="h-8 w-auto object-contain" />
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 70% 30%, hsl(var(--primary) / 0.4), transparent 60%), radial-gradient(ellipse at 20% 80%, hsl(25 95% 53% / 0.25), transparent 60%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-10 grid md:grid-cols-2 gap-8 items-center relative">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-6">
              <Headphones className="h-3.5 w-3.5" /> WE'RE HERE TO HELP
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
              How Can We{" "}
              <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                Help?
              </span>
            </h1>
            <p className="text-white/60 text-lg max-w-lg mb-8">
              Whether you're an entertainer, manager, booking agent, or event planner, our team is here to help you succeed on GiggMe.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Stat icon={Zap} iconBg="bg-violet-500/15" iconColor="text-violet-400" label="Average response time" value="Under 4 hours" valueColor="text-violet-300" />
              <Stat icon={CheckCircle2} iconBg="bg-emerald-500/15" iconColor="text-emerald-400" label="We typically respond" value="within 24 hours" valueColor="text-emerald-300" />
              <Stat icon={Heart} iconBg="bg-pink-500/15" iconColor="text-pink-400" label="100% real people" value="ready to help" valueColor="text-pink-300" />
            </div>
          </div>
          <div className="relative hidden md:block">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
              <img src={heroBand} alt="Live performance" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Form + side cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          {sent ? (
            <div className="text-center py-10">
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Message sent</h2>
              <p className="text-white/60 mb-6">
                Thanks, {name}! We've sent a copy to your inbox and our team will get back to you shortly.
              </p>
              <Button onClick={() => navigate("/")}>Back to home</Button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Send Us a Message</h2>
              <p className="text-white/60 mb-6">Fill out the form below and we'll get back to you as soon as possible.</p>
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <Label htmlFor="category">What's this about?</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                    <SelectTrigger id="category" className="mt-1.5 h-11 bg-background/40 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="tech_support">Tech Support</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="name">Your name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" className="mt-1.5 h-11 bg-background/40 border-white/10" maxLength={100} required />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address" className="mt-1.5 h-11 bg-background/40 border-white/10" maxLength={255} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help you?" className="mt-1.5 min-h-[160px] bg-background/40 border-white/10" maxLength={2000} required />
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 text-base bg-gradient-to-r from-violet-500 via-pink-500 to-orange-500 hover:opacity-95 border-0"
                >
                  {submitting ? "Sending..." : (<><span>Get Support</span><Send className="ml-2 h-4 w-4" /></>)}
                </Button>
                <div className="flex items-center justify-center gap-2 text-xs text-white/50">
                  <ShieldCheck className="h-3.5 w-3.5" /> Your information is safe and secure.
                </div>
              </form>
            </>
          )}
        </div>

        {/* Side */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-xl font-bold mb-5">Other Ways to Reach Us</h3>
            <div className="space-y-5">
              <ContactRow icon={Mail} bg="bg-violet-500/15" color="text-violet-400" title="Email Support" lines={["management@giggme.com", "We reply within 24 hours"]} />
              <ContactRow icon={MapPin} bg="bg-emerald-500/15" color="text-emerald-400" title="Headquarters" lines={["Tampa, Florida", "United States"]} />
            </div>
          </div>

          <div className="relative rounded-3xl p-6 border border-orange-500/30 bg-gradient-to-br from-violet-500/10 via-pink-500/10 to-orange-500/10">
            <div className="flex flex-col items-center text-center">
              <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                <Calendar className="h-5 w-5 text-pink-300" />
              </div>
              <p className="text-white/70 text-sm">Want to see GiggMe in action?</p>
              <h4 className="text-xl font-bold mt-1 mb-2">
                Book a{" "}
                <span className="bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">Live Demo</span>
              </h4>
              <p className="text-white/60 text-sm mb-5">
                See how GiggMe can help you manage your crew, automate tasks, and get more gigs.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate("/schedule-demo")}
                className="border-orange-500/40 hover:bg-orange-500/10 text-white"
              >
                Schedule a Demo <ArrowRight className="ml-2 h-4 w-4 text-orange-400" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex gap-4 items-start hover:bg-white/[0.04] transition">
                <div className={`h-10 w-10 rounded-full ${f.bg} flex items-center justify-center shrink-0`}>
                  <f.icon className={`h-5 w-5 ${f.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold mb-1">{f.q}</div>
                  <div className="text-sm text-white/60 whitespace-pre-line">{f.a}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 mt-1" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 mt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-white/40">
          © {new Date().getFullYear()} GiggMe. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

const Stat = ({
  icon: Icon, iconBg, iconColor, label, value, valueColor,
}: { icon: any; iconBg: string; iconColor: string; label: string; value: string; valueColor: string }) => (
  <div className="flex items-center gap-3">
    <div className={`h-9 w-9 rounded-full ${iconBg} flex items-center justify-center`}>
      <Icon className={`h-4 w-4 ${iconColor}`} />
    </div>
    <div className="text-sm leading-tight">
      <div className="text-white/60">{label}</div>
      <div className={`font-semibold ${valueColor}`}>{value}</div>
    </div>
  </div>
);

const ContactRow = ({
  icon: Icon, bg, color, title, lines,
}: { icon: any; bg: string; color: string; title: string; lines: string[] }) => (
  <div className="flex gap-4 items-start">
    <div className={`h-11 w-11 rounded-full ${bg} flex items-center justify-center shrink-0`}>
      <Icon className={`h-5 w-5 ${color}`} />
    </div>
    <div className="text-sm">
      <div className="font-semibold">{title}</div>
      {lines.map((l, i) => (
        <div key={i} className="text-white/60">{l}</div>
      ))}
    </div>
  </div>
);

export default Contact;
