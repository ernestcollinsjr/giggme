import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Music, CheckCircle, MapPin } from "lucide-react";

interface ArtistInfo {
  name: string;
  photo_url: string | null;
  stage_name: string | null;
  genre: string | null;
}

interface VenueInfo {
  name: string;
  id: string;
}

const RatePerformer = () => {
  const { artistId } = useParams<{ artistId: string }>();
  const [searchParams] = useSearchParams();
  const venueId = searchParams.get("venue");
  const bookingId = searchParams.get("booking");
  
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [artist, setArtist] = useState<ArtistInfo | null>(null);
  const [venueInfo, setVenueInfo] = useState<VenueInfo | null>(null);
  
  const [rating, setRating] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (artistId) {
      fetchArtistInfo();
    }
  }, [artistId]);

  useEffect(() => {
    if (venueId) {
      fetchVenueInfo();
    }
  }, [venueId]);

  const fetchVenueInfo = async () => {
    try {
      const { data: venue } = await supabase
        .from("venues")
        .select("id, name")
        .eq("id", venueId)
        .maybeSingle();

      if (venue) {
        setVenueInfo(venue);
        setVenueName(venue.name);
      }
    } catch (error) {
      console.error("Error fetching venue:", error);
    }
  };

  const fetchArtistInfo = async () => {
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("name, photo_urls")
        .eq("id", artistId)
        .maybeSingle();

      if (profileError) throw profileError;

      // Fetch artist profile
      const { data: artistProfile } = await supabase
        .from("artist_profiles")
        .select("stage_name, genre")
        .eq("user_id", artistId)
        .maybeSingle();

      if (profile) {
        setArtist({
          name: profile.name,
          photo_url: profile.photo_urls?.[0] || null,
          stage_name: artistProfile?.stage_name || null,
          genre: artistProfile?.genre || null,
        });
      }
    } catch (error: any) {
      console.error("Error fetching artist:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Please select a rating",
        description: "Tap on the stars to rate the performer",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("performer_ratings").insert({
        artist_id: artistId,
        rating,
        customer_name: customerName || null,
        venue_name: venueName || null,
        comment: comment || null,
        venue_id: venueId || null,
        booking_id: bookingId || null,
      });

      if (error) throw error;

      // Send push notification to the artist
      const displayName = artist.stage_name || artist.name;
      const ratingText = rating === 5 ? "⭐⭐⭐⭐⭐" : `${rating} star${rating > 1 ? "s" : ""}`;
      const notificationBody = customerName 
        ? `${customerName} rated you ${ratingText}${venueInfo ? ` at ${venueInfo.name}` : ""}!`
        : `You received a ${ratingText} rating${venueInfo ? ` at ${venueInfo.name}` : ""}!`;

      supabase.functions.invoke("send-push-notification", {
        body: {
          user_id: artistId,
          title: "New Rating Received!",
          body: notificationBody,
          url: "/artist-profile",
          data: { type: "rating" },
        },
      }).catch(console.error);

      // Also create an in-app notification
      supabase.from("notifications").insert({
        user_id: artistId,
        title: "New Rating Received!",
        message: notificationBody,
        type: "rating",
      }).then(({ error }) => {
        if (error) console.error("Error creating notification:", error);
      });

      setSubmitted(true);
      toast({
        title: "Thank you!",
        description: "Your rating has been submitted successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit rating",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Performer not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Thank You!</h2>
            <p className="text-muted-foreground">
              Your rating for {artist.stage_name || artist.name} has been recorded.
            </p>
            <p className="text-sm text-muted-foreground">
              We appreciate your feedback!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-4 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={artist.photo_url || ""} alt={artist.name} />
              <AvatarFallback className="text-2xl">
                <Music className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="text-2xl">
            {artist.stage_name || artist.name}
          </CardTitle>
          {artist.genre && (
            <CardDescription className="text-lg">{artist.genre}</CardDescription>
          )}
          {venueInfo && (
            <div className="flex items-center justify-center gap-1 text-muted-foreground mt-2">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">at {venueInfo.name}</span>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="font-medium">How was the performance?</p>
            <div className="flex justify-center">
              <StarRating 
                rating={rating} 
                onChange={setRating} 
                size="lg"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Your Name (optional)</Label>
              <Input
                id="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>

            {!venueInfo && (
              <div>
                <Label htmlFor="venue">Venue Name (optional)</Label>
                <Input
                  id="venue"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="Where did you see this performer?"
                />
              </div>
            )}

            <div>
              <Label htmlFor="comment">Comment (optional)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts about the performance..."
                rows={3}
              />
            </div>
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={submitting || rating === 0}
            className="w-full"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Rating"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RatePerformer;
