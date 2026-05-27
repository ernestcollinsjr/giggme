import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Play } from "lucide-react";
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

interface YouTubePlayerProps {
  videoId: string;
  title: string;
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
}

export const YouTubePlayer = ({ videoId, title, isOpen = false, onClose, inline = false }: YouTubePlayerProps) => {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const isNative = Capacitor.isNativePlatform();
  
  const embedUrl = isNative
    ? `https://emuzsic.com/embed.html?v=${videoId}`
    : `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1&autoplay=1&modestbranding=1`;

  const handleOpenYouTube = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: youtubeUrl });
      } else {
        window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const VideoPlayer = () => (
    <div className="space-y-3">
      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
        <iframe
          width="100%"
          height="100%"
          src={embedUrl}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full" 
        onClick={handleOpenYouTube}
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Open in YouTube
      </Button>
    </div>
  );

  if (inline) {
    return <VideoPlayer />;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6">
          <VideoPlayer />
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Helper to extract video ID from YouTube URL
export const getYoutubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
};
