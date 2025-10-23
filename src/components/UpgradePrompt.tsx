import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
}

export const UpgradePrompt = ({ open, onOpenChange, feature }: UpgradePromptProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Upgrade to Pro
          </DialogTitle>
          <DialogDescription>
            {feature} is a premium feature available in the Pro plan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Unlock all premium features including:
          </p>
          <ul className="text-sm space-y-2">
            <li className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              Real-time location sharing
            </li>
            <li className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              SMS/Push notifications
            </li>
            <li className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              AI band assistant
            </li>
            <li className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              Unlimited band members
            </li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button onClick={() => navigate("/pricing")}>
            View Plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
