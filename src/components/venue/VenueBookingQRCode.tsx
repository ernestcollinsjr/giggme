import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, QrCode } from "lucide-react";
import { useRef } from "react";
import { format } from "date-fns";

interface VenueBookingQRCodeProps {
  bookingId: string;
  entertainerId: string;
  entertainerName: string;
  venueName: string;
  venueId: string;
  bookingDate: string;
}

export const VenueBookingQRCode = ({ 
  bookingId, 
  entertainerId, 
  entertainerName, 
  venueName,
  venueId,
  bookingDate 
}: VenueBookingQRCodeProps) => {
  const qrRef = useRef<HTMLDivElement>(null);
  
  const ratingUrl = `${window.location.origin}/rate/${entertainerId}?venue=${venueId}&booking=${bookingId}`;

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 520;
      
      if (ctx) {
        // White background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw QR code
        ctx.drawImage(img, 50, 40, 300, 300);
        
        // Add text
        ctx.fillStyle = "black";
        ctx.font = "bold 22px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Rate Your Experience!", canvas.width / 2, 380);
        
        ctx.font = "18px system-ui";
        ctx.fillText(entertainerName, canvas.width / 2, 415);
        
        ctx.font = "14px system-ui";
        ctx.fillStyle = "#666";
        ctx.fillText(`at ${venueName}`, canvas.width / 2, 445);
        ctx.fillText(format(new Date(bookingDate), "MMM d, yyyy"), canvas.width / 2, 470);
      }

      const link = document.createElement("a");
      link.download = `qr-rate-${entertainerName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(bookingDate), "yyyy-MM-dd")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <QrCode className="h-5 w-5" />
          Customer Rating QR
        </CardTitle>
        <CardDescription>
          Print and display for customers to rate {entertainerName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div 
          ref={qrRef}
          className="flex justify-center p-4 bg-white rounded-lg border"
        >
          <QRCodeSVG 
            value={ratingUrl} 
            size={150}
            level="H"
            includeMargin
          />
        </div>
        
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">{entertainerName}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(bookingDate), "EEEE, MMMM d")}
          </p>
        </div>

        <Button onClick={handleDownload} className="w-full" variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download QR Code
        </Button>
      </CardContent>
    </Card>
  );
};
