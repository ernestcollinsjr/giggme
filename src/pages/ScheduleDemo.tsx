import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Users,
  Calendar as CalendarIcon,
  Sparkles,
  Music,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Audience = "manager" | "entertainer" | null;

const ROLES_MANAGER = [
  "Entertainment Manager",
  "Booking Agent",
  "Band Leader",
  "Venue Owner",
  "Event Planner",
  "Other",
];

const ROLES_ENTERTAINER = ["Solo Performer", "Band Member", "DJ", "Other"];

const TEAM_SIZES = ["Just Me", "2–10", "11–25", "26–50", "50+"];

const CHALLENGES_MANAGER = [
  "Finding performers",
  "Managing schedules",
  "Gig confirmations",
  "Late arrivals",
  "Team communication",
  "Tracking payments",
  "Booking more gigs",
];

const CHALLENGES_ENTERTAINER = [
  "Getting discovered",
  "Booking more gigs",
  "Managing my calendar",
  "Getting paid on time",
  "Communicating with venues",
  "Standing out from other performers",
];

const TIME_SLOTS = [
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
];

export default function ScheduleDemo() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0 = audience picker, 1..5 = flow, 6 = confirmation
  const [audience, setAudience] = useState<Audience>(null);
  const [role, setRole] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [challenges, setChallenges] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isManager = audience === "manager";

  const pickAudience = (a: Audience) => {
    setAudience(a);
    setRole("");
    setChallenges([]);
    setStep(1);
  };

  const toggleChallenge = (c: string) =>
    setChallenges((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const canAdvance = () => {
    if (step === 1) return !!role;
    if (step === 2) return isManager ? !!teamSize : true;
    if (step === 3) return challenges.length > 0;
    if (step === 4) return name.trim() && /\S+@\S+\.\S+/.test(email) && phone.trim();
    if (step === 5) return !!date && !!time;
    return true;
  };

  const next = () => {
    // entertainers skip team size
    if (step === 1 && !isManager) return setStep(3);
    setStep((s) => s + 1);
  };
  const back = () => {
    if (step === 3 && !isManager) return setStep(1);
    setStep((s) => Math.max(0, s - 1));
  };

  const submit = async () => {
    setSubmitting(true);
    const scheduledFor = date ? `${format(date, "yyyy-MM-dd")} ${time}` : null;
    try {
      // Best-effort save; ignore failures so UX still completes
      await supabase.from("demo_requests" as any).insert({
        audience,
        role,
        team_size: isManager ? teamSize : null,
        challenges,
        name,
        email,
        phone,
        scheduled_for: scheduledFor,
      } as any);
    } catch {
      // noop
    }
    try {
      await supabase.functions.invoke("send-demo-request", {
        body: {
          audience,
          role,
          teamSize: isManager ? teamSize : null,
          challenges,
          name,
          email,
          phone,
          scheduledFor,
        },
      });
    } catch (e) {
      console.error("Demo email failed", e);
    } finally {
      setSubmitting(false);
      setStep(6);
    }
  };

  const stepNumber = step === 0 || step === 6 ? null : isManager ? step : step >= 3 ? step - 1 : step;
  const totalSteps = isManager ? 5 : 4;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0b14] via-[#0b0b14] to-black text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-white/60 hover:text-white inline-flex items-center gap-2 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </button>

        {stepNumber !== null && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-white/50 mb-2">
              <span>
                Step {stepNumber} of {totalSteps}
              </span>
              <span>{audience === "manager" ? "Entertainment Manager" : "Entertainer"}</span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-violet-600 transition-all"
                style={{ width: `${(stepNumber / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 sm:p-10">
          {/* Step 0: Audience */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl sm:text-4xl font-bold">See GiggMe in Action</h1>
                <p className="text-white/60">First — who are you? We'll tailor the demo to you.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => pickAudience("manager")}
                  className="group text-left rounded-xl border border-white/10 hover:border-violet-400/60 hover:bg-violet-500/5 p-6 transition"
                >
                  <Briefcase className="h-8 w-8 text-violet-400 mb-3" />
                  <div className="text-lg font-semibold">I Manage Entertainers</div>
                  <p className="text-sm text-white/60 mt-1">
                    The operating system for running professional, stress-free events.
                  </p>
                </button>
                <button
                  onClick={() => pickAudience("entertainer")}
                  className="group text-left rounded-xl border border-white/10 hover:border-amber-400/60 hover:bg-amber-500/5 p-6 transition"
                >
                  <Music className="h-8 w-8 text-amber-400 mb-3" />
                  <div className="text-lg font-semibold">I'm an Entertainer Looking For Gigs</div>
                  <p className="text-sm text-white/60 mt-1">Get discovered. Get hired. Get paid.</p>
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Role */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Tell us about yourself</h2>
                <p className="text-white/60 text-sm mt-1">I am a…</p>
              </div>
              <RadioGroup value={role} onValueChange={setRole} className="grid sm:grid-cols-2 gap-3">
                {(isManager ? ROLES_MANAGER : ROLES_ENTERTAINER).map((r) => (
                  <Label
                    key={r}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition",
                      role === r ? "border-violet-400 bg-violet-500/10" : "border-white/10 hover:border-white/30",
                    )}
                  >
                    <RadioGroupItem value={r} />
                    <span className="text-sm">{r}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Step 2: Team size (managers only) */}
          {step === 2 && isManager && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Team size</h2>
                <p className="text-white/60 text-sm mt-1">How many performers do you manage?</p>
              </div>
              <RadioGroup value={teamSize} onValueChange={setTeamSize} className="grid sm:grid-cols-2 gap-3">
                {TEAM_SIZES.map((s) => (
                  <Label
                    key={s}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition",
                      teamSize === s ? "border-violet-400 bg-violet-500/10" : "border-white/10 hover:border-white/30",
                    )}
                  >
                    <RadioGroupItem value={s} />
                    <Users className="h-4 w-4 text-white/50" />
                    <span className="text-sm">{s}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Step 3: Biggest challenge */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Biggest challenge</h2>
                <p className="text-white/60 text-sm mt-1">
                  What's your biggest headache? (Pick all that apply)
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {(isManager ? CHALLENGES_MANAGER : CHALLENGES_ENTERTAINER).map((c) => (
                  <Label
                    key={c}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition",
                      challenges.includes(c)
                        ? "border-violet-400 bg-violet-500/10"
                        : "border-white/10 hover:border-white/30",
                    )}
                  >
                    <Checkbox
                      checked={challenges.includes(c)}
                      onCheckedChange={() => toggleChallenge(c)}
                    />
                    <span className="text-sm">{c}</span>
                  </Label>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Contact */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Your contact info</h2>
                <p className="text-white/60 text-sm mt-1">We'll send your confirmation here.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 555-5555"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Date & time */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Pick a date & time</h2>
                <p className="text-white/60 text-sm mt-1">15–30 minute discovery session.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-lg border border-white/10 p-2 bg-black/20">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </div>
                <div>
                  <div className="text-sm text-white/60 mb-3">
                    {date ? format(date, "EEEE, MMMM d") : "Select a date to see available times"}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {TIME_SLOTS.map((t) => (
                      <button
                        key={t}
                        disabled={!date}
                        onClick={() => setTime(t)}
                        className={cn(
                          "rounded-lg border p-2.5 text-sm transition",
                          time === t
                            ? "border-violet-400 bg-violet-500/15 text-white"
                            : "border-white/10 text-white/80 hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Confirmation */}
          {step === 6 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">
                  You're One Step Away From{" "}
                  {isManager ? "Stress-Free Gig Management" : "Getting Discovered"}
                </h2>
                <p className="text-white/60 mt-2">
                  Confirmation sent to <span className="text-white">{email}</span>
                  {date && time && (
                    <>
                      {" "}
                      for <span className="text-white">{format(date, "EEE, MMM d")} at {time}</span>
                    </>
                  )}
                  .
                </p>
              </div>
              <div className="text-left max-w-md mx-auto rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
                <div className="text-sm font-semibold">During your demo you'll see:</div>
                {(isManager
                  ? [
                      "How to manage your roster",
                      "How to automate reminders",
                      "How arrival tracking works",
                      "How performers get booked",
                      "How to eliminate group text chaos",
                    ]
                  : [
                      "How to build a standout profile",
                      "How managers discover you",
                      "How to accept gigs in one tap",
                      "How payments are tracked",
                      "How to grow your following",
                    ]
                ).map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-white/80">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button
                  onClick={() => navigate("/get-started")}
                  className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500"
                >
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => navigate("/")}>
                  Back to home
                </Button>
              </div>
            </div>
          )}

          {/* Navigation */}
          {step > 0 && step < 6 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
              <Button variant="ghost" onClick={back}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {step < 5 ? (
                <Button
                  onClick={next}
                  disabled={!canAdvance()}
                  className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={submit}
                  disabled={!canAdvance() || submitting}
                  className="bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500"
                >
                  <CalendarIcon className="h-4 w-4" />
                  {submitting ? "Booking…" : "Confirm Demo"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
