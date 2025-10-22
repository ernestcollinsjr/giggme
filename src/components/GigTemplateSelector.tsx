import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save } from "lucide-react";

interface GigTemplate {
  id: string;
  name: string;
  venue: string;
  venue_name: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  default_start_time: string | null;
  default_end_time: string | null;
  default_loading_time: string | null;
  default_sound_check_time: string | null;
  attire: string | null;
  food_provided: string | null;
  venue_contact_person: string | null;
  sound_man_info: string | null;
  notes: string | null;
}

interface GigTemplateValues {
  venueName: string;
  venue: string;
  venueLat: number | null;
  venueLng: number | null;
  showTime: string;
  endTime: string;
  loadingTime: string;
  soundCheckTime: string;
  attire: string;
  foodProvided: string;
  venueContactPerson: string;
  soundManInfo: string;
  notes: string;
}

interface Props {
  onSelectTemplate: (values: GigTemplateValues) => void;
  currentValues: GigTemplateValues;
}

export const GigTemplateSelector = ({ onSelectTemplate, currentValues }: Props) => {
  const [templates, setTemplates] = useState<GigTemplate[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("gig_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    setTemplates(data || []);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        variant: "destructive",
        title: "Name required",
        description: "Please enter a template name",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("gig_templates").insert({
      user_id: user.id,
      name: templateName,
      venue: currentValues.venue,
      venue_name: currentValues.venueName || null,
      venue_lat: currentValues.venueLat,
      venue_lng: currentValues.venueLng,
      default_start_time: currentValues.showTime || null,
      default_end_time: currentValues.endTime || null,
      default_loading_time: currentValues.loadingTime || null,
      default_sound_check_time: currentValues.soundCheckTime || null,
      attire: currentValues.attire || null,
      food_provided: currentValues.foodProvided || null,
      venue_contact_person: currentValues.venueContactPerson || null,
      sound_man_info: currentValues.soundManInfo || null,
      notes: currentValues.notes || null,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save template",
      });
      return;
    }

    toast({
      title: "Template saved",
      description: `"${templateName}" has been saved for quick access`,
    });

    setTemplateName("");
    setDialogOpen(false);
    fetchTemplates();
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    onSelectTemplate({
      venueName: template.venue_name || "",
      venue: template.venue,
      venueLat: template.venue_lat,
      venueLng: template.venue_lng,
      showTime: template.default_start_time || "19:00",
      endTime: template.default_end_time || "23:00",
      loadingTime: template.default_loading_time || "",
      soundCheckTime: template.default_sound_check_time || "",
      attire: template.attire || "",
      foodProvided: template.food_provided || "",
      venueContactPerson: template.venue_contact_person || "",
      soundManInfo: template.sound_man_info || "",
      notes: template.notes || "",
    });

    toast({
      title: "Template applied",
      description: `Loaded settings from "${template.name}"`,
    });
  };

  return (
    <div className="flex gap-2">
      <Select onValueChange={handleSelectTemplate}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Load from template..." />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name} - {template.venue_name || template.venue}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" title="Save as template">
            <Save className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Gig Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Blue Note Regular Gig"
              />
            </div>
            <Button onClick={handleSaveTemplate} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Save Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
