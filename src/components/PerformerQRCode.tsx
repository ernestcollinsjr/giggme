import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, QrCode } from "lucide-react";
import { useRef } from "react";

interface PerformerQRCodeProps {
  artistId: string;
  artistName: string;
}

export const PerformerQRCode = ({ artistId, artistName }: PerformerQRCodeProps) => {
  const qrRef = useRef<HTMLDivElement>(null);
  
  const ratingUrl = `${window.location.origin}/rate/${artistId}`;

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 480;
      
      if (ctx) {
        // White background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw QR code
        ctx.drawImage(img, 50, 50, 300, 300);
        
        // Add text
        ctx.fillStyle = "black";
        ctx.font = "bold 24px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Rate My Performance!", canvas.width / 2, 400);
        
        ctx.font = "16px system-ui";
        ctx.fillStyle = "#666";
        ctx.fillText(artistName, canvas.width / 2, 440);
      }

      const link = document.createElement("a");
      link.download = `qr-rate-${artistName.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Customer Rating QR Code
        </CardTitle>
        <CardDescription>
          Display this QR code at your performances so customers can rate you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div 
          ref={qrRef}
          className="flex justify-center p-6 bg-white rounded-lg border"
        >
          <QRCodeSVG 
            value={ratingUrl} 
            size={200}
            level="H"
            includeMargin
          />
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-sm font-medium">Scan to Rate My Performance!</p>
          <p className="text-xs text-muted-foreground break-all">{ratingUrl}</p>
        </div>

        <Button onClick={handleDownload} className="w-full" variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download QR Code
        </Button>
      </CardContent>
    </Card>
  );
};
