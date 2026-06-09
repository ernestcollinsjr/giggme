import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface CrewProfileDialogProps {
  userId: string | null;
  userName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ProfileForm = {
  stage_name: string;
  phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  bio: string;
  photo_url: string;
  instruments: string;
  vocal_range: string;
  gear_list: string;
  certifications: string;
  years_experience: string;
  console_experience: string;
  lighting_rig_experience: string;
  passport_number: string;
  passport_expiry: string;
  tsa_precheck: string;
  dietary_needs: string;
  shirt_size: string;
  resume_url: string;
  demo_video_urls: string;
  photo_gallery: string;
};

const empty: ProfileForm = {
  stage_name: "",
  phone: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  bio: "",
  photo_url: "",
  instruments: "",
  vocal_range: "",
  gear_list: "",
  certifications: "",
  years_experience: "",
  console_experience: "",
  lighting_rig_experience: "",
  passport_number: "",
  passport_expiry: "",
  tsa_precheck: "",
  dietary_needs: "",
  shirt_size: "",
  resume_url: "",
  demo_video_urls: "",
  photo_gallery: "",
};

const toCsv = (arr: string[] | null | undefined) => (arr || []).join(", ");
const fromCsv = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean);

export default function CrewProfileDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: CrewProfileDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<ProfileForm>(empty);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    supabase
      .from("crew_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            stage_name: data.stage_name || "",
            phone: data.phone || "",
            emergency_contact_name: data.emergency_contact_name || "",
            emergency_contact_phone: data.emergency_contact_phone || "",
            bio: data.bio || "",
            photo_url: data.photo_url || "",
            instruments: toCsv(data.instruments),
            vocal_range: data.vocal_range || "",
            gear_list: data.gear_list || "",
            certifications: toCsv(data.certifications),
            years_experience: data.years_experience?.toString() || "",
            console_experience: data.console_experience || "",
            lighting_rig_experience: data.lighting_rig_experience || "",
            passport_number: data.passport_number || "",
            passport_expiry: data.passport_expiry || "",
            tsa_precheck: data.tsa_precheck || "",
            dietary_needs: data.dietary_needs || "",
            shirt_size: data.shirt_size || "",
            resume_url: data.resume_url || "",
            demo_video_urls: toCsv(data.demo_video_urls),
            photo_gallery: toCsv(data.photo_gallery),
          });
        } else {
          setForm(empty);
        }
      })
      .then(undefined, (e) => console.error(e))
      .finally(() => setLoading(false));
  }, [open, userId]);

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        stage_name: form.stage_name.trim() || null,
        phone: form.phone.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone.trim() || null,
        bio: form.bio.trim() || null,
        photo_url: form.photo_url.trim() || null,
        instruments: fromCsv(form.instruments),
        vocal_range: form.vocal_range.trim() || null,
        gear_list: form.gear_list.trim() || null,
        certifications: fromCsv(form.certifications),
        years_experience: form.years_experience
          ? parseInt(form.years_experience, 10)
          : null,
        console_experience: form.console_experience.trim() || null,
        lighting_rig_experience: form.lighting_rig_experience.trim() || null,
        passport_number: form.passport_number.trim() || null,
        passport_expiry: form.passport_expiry || null,
        tsa_precheck: form.tsa_precheck.trim() || null,
        dietary_needs: form.dietary_needs.trim() || null,
        shirt_size: form.shirt_size.trim() || null,
        resume_url: form.resume_url.trim() || null,
        demo_video_urls: fromCsv(form.demo_video_urls),
        photo_gallery: fromCsv(form.photo_gallery),
      };

      const { error } = await supabase
        .from("crew_profiles")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      toast({ title: "Profile saved", description: "Crew profile updated." });
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error",
        description: e?.message || "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crew Profile{userName ? ` — ${userName}` : ""}</DialogTitle>
          <DialogDescription>
            Personal information shared with your tour manager and tour roster.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="travel">Travel</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Stage Name</Label>
                  <Input value={form.stage_name} onChange={(e) => set("stage_name", e.target.value)} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div>
                  <Label>Emergency Contact Name</Label>
                  <Input
                    value={form.emergency_contact_name}
                    onChange={(e) => set("emergency_contact_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Emergency Contact Phone</Label>
                  <Input
                    value={form.emergency_contact_phone}
                    onChange={(e) => set("emergency_contact_phone", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Photo URL</Label>
                <Input value={form.photo_url} onChange={(e) => set("photo_url", e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <Label>Bio</Label>
                <Textarea rows={4} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="skills" className="space-y-4">
              <div>
                <Label>Instruments (comma-separated)</Label>
                <Input
                  value={form.instruments}
                  onChange={(e) => set("instruments", e.target.value)}
                  placeholder="Guitar, Bass, Keys"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vocal Range</Label>
                  <Input value={form.vocal_range} onChange={(e) => set("vocal_range", e.target.value)} placeholder="Tenor, Soprano…" />
                </div>
                <div>
                  <Label>Years of Experience</Label>
                  <Input
                    type="number"
                    value={form.years_experience}
                    onChange={(e) => set("years_experience", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Gear List</Label>
                <Textarea rows={3} value={form.gear_list} onChange={(e) => set("gear_list", e.target.value)} />
              </div>
              <div>
                <Label>Certifications (comma-separated)</Label>
                <Input
                  value={form.certifications}
                  onChange={(e) => set("certifications", e.target.value)}
                  placeholder="ETCP Rigging, OSHA-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Console Experience</Label>
                  <Input
                    value={form.console_experience}
                    onChange={(e) => set("console_experience", e.target.value)}
                    placeholder="DiGiCo SD12, Avid S6L…"
                  />
                </div>
                <div>
                  <Label>Lighting Rig Experience</Label>
                  <Input
                    value={form.lighting_rig_experience}
                    onChange={(e) => set("lighting_rig_experience", e.target.value)}
                    placeholder="grandMA3, Hog 4…"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="travel" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Passport Number</Label>
                  <Input value={form.passport_number} onChange={(e) => set("passport_number", e.target.value)} />
                </div>
                <div>
                  <Label>Passport Expiry</Label>
                  <Input
                    type="date"
                    value={form.passport_expiry}
                    onChange={(e) => set("passport_expiry", e.target.value)}
                  />
                </div>
                <div>
                  <Label>TSA PreCheck / Global Entry</Label>
                  <Input value={form.tsa_precheck} onChange={(e) => set("tsa_precheck", e.target.value)} />
                </div>
                <div>
                  <Label>Shirt Size</Label>
                  <Input value={form.shirt_size} onChange={(e) => set("shirt_size", e.target.value)} placeholder="S/M/L/XL" />
                </div>
              </div>
              <div>
                <Label>Dietary Needs</Label>
                <Textarea rows={2} value={form.dietary_needs} onChange={(e) => set("dietary_needs", e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="media" className="space-y-4">
              <div>
                <Label>Resume / CV URL</Label>
                <Input value={form.resume_url} onChange={(e) => set("resume_url", e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <Label>Demo Video URLs (comma-separated)</Label>
                <Textarea
                  rows={2}
                  value={form.demo_video_urls}
                  onChange={(e) => set("demo_video_urls", e.target.value)}
                />
              </div>
              <div>
                <Label>Photo Gallery URLs (comma-separated)</Label>
                <Textarea
                  rows={2}
                  value={form.photo_gallery}
                  onChange={(e) => set("photo_gallery", e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading || !userId}>
            {saving ? "Saving…" : "Save Profile"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
