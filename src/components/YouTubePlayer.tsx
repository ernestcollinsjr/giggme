import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";

function toYouTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    let id = "";

    if (host.includes("youtu.be")) {
      id = u.pathname.replace(/^\//, "");
    } else if (host.includes("youtube.com")) {
      if (u.pathname === "/watch") {
        id = u.searchParams.get("v") || "";
      } else if (u.pathname.startsWith("/shorts/")) {
        id = u.pathname.split("/")[2] || "";
      } else if (u.pathname.startsWith("/embed/")) {
        id = u.pathname.split("/")[2] || "";
      }
    }
    if (!id) return null;

    const params = new URLSearchParams();
    const start = u.searchParams.get("t") || u.searchParams.get("start");
    if (start) params.set("start", start.replace(/[^0-9]/g, ""));
    params.set("rel", "0");

    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
  } catch {
    return null;
  }
}

interface YouTubePlayerProps {
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ url, open, onOpenChange }) => {
  const embed = toYouTubeEmbed(url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        {embed ? (
          <AspectRatio ratio={16 / 9}>
            <iframe
              src={embed}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              className="w-full h-full rounded-md"
            />
          </AspectRatio>
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Could not load this YouTube link.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default YouTubePlayer;
