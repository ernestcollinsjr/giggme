import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/components/StarRating";
import { Star, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface Rating {
  id: string;
  rating: number;
  comment: string | null;
  customer_name: string | null;
  venue_name: string | null;
  created_at: string;
}

interface PerformerRatingsDisplayProps {
  artistId: string;
}

export const PerformerRatingsDisplay = ({ artistId }: PerformerRatingsDisplayProps) => {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);

  useEffect(() => {
    fetchRatings();
  }, [artistId]);

  const fetchRatings = async () => {
    try {
      const { data, error } = await supabase
        .from("performer_ratings")
        .select("*")
        .eq("artist_id", artistId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRatings(data || []);
      
      if (data && data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(avg);
      }
    } catch (error) {
      console.error("Error fetching ratings:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Customer Ratings
        </CardTitle>
        <CardDescription>
          {ratings.length > 0
            ? `Based on ${ratings.length} rating${ratings.length > 1 ? "s" : ""}`
            : "No ratings yet"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ratings.length > 0 ? (
          <>
            {/* Average Rating */}
            <div className="flex items-center gap-4 p-4 bg-primary/10 rounded-lg">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{averageRating.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">out of 5</p>
              </div>
              <div>
                <StarRating rating={Math.round(averageRating)} readonly size="md" />
                <p className="text-sm text-muted-foreground mt-1">
                  {ratings.length} review{ratings.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Individual Reviews */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {ratings.map((r) => (
                <div key={r.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <StarRating rating={r.rating} readonly size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-muted-foreground flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {r.comment}
                    </p>
                  )}
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {r.customer_name && <span>— {r.customer_name}</span>}
                    {r.venue_name && <span>at {r.venue_name}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <StarRating rating={0} readonly size="lg" />
            <p className="text-muted-foreground mt-4">
              No ratings yet. Share your QR code to collect ratings!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
