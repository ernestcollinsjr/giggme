import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";

function toYouTubeEmbed(url: string): string | null {
  if (!url) return null;
  
  try {
    // Clean the URL
    const cleanUrl = url.trim();
    const u = new URL(cleanUrl);
    const host = u.hostname.toLowerCase().replace('www.', '');
    let id = "";

    // Extract video ID from various YouTube URL formats
    if (host === "youtu.be") {
      // Short format: https://youtu.be/VIDEO_ID
      id = u.pathname.substring(1).split('?')[0];
    } else if (host.includes("youtube.com")) {
      if (u.pathname === "/watch") {
        // Standard format: https://www.youtube.com/watch?v=VIDEO_ID
        id = u.searchParams.get("v") || "";
      } else if (u.pathname.startsWith("/shorts/")) {
        // Shorts format: https://www.youtube.com/shorts/VIDEO_ID
        id = u.pathname.split("/")[2] || "";
      } else if (u.pathname.startsWith("/embed/")) {
        // Already embed format: https://www.youtube.com/embed/VIDEO_ID
        id = u.pathname.split("/")[2] || "";
      } else if (u.pathname.startsWith("/v/")) {
        // Legacy format: https://www.youtube.com/v/VIDEO_ID
        id = u.pathname.split("/")[2] || "";
      }
    }
    
    // Remove any trailing parameters from the ID
    id = id.split('&')[0].split('?')[0];
    
    if (!id || id.length < 10) {
      console.error('[YouTubePlayer] Could not extract valid video ID from:', url);
      return null;
    }

    console.log('[YouTubePlayer] Extracted video ID:', id, 'from URL:', url);

    // Build embed URL with parameters
    const params = new URLSearchParams();
    const start = u.searchParams.get("t") || u.searchParams.get("start");
    if (start) params.set("start", start.replace(/[^0-9]/g, ""));
    params.set("rel", "0");
    params.set("modestbranding", "1");

    return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
  } catch (error) {
    console.error('[YouTubePlayer] Error parsing URL:', url, error);
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

  console.log('[YouTubePlayer] Dialog state:', { open, url, embed });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background z-[1000]">
        {embed ? (
          <div className="w-full">
            <AspectRatio ratio={16 / 9}>
              <iframe
                src={embed}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </AspectRatio>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Could not load this YouTube video
            </p>
            <p className="text-xs text-muted-foreground break-all mb-3">
              URL: {url}
            </p>
            {url && (
              <div className="space-y-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors"
                >
                  Open in YouTube
                </a>
                <p className="text-xs text-muted-foreground">
                  This link will open YouTube in a new tab
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default YouTubePlayer;
