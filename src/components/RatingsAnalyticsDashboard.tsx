import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Cell, Area, AreaChart } from "recharts";
import { TrendingUp, Star, MapPin, Calendar, Users } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from "date-fns";

interface Rating {
  id: string;
  rating: number;
  comment: string | null;
  customer_name: string | null;
  venue_name: string | null;
  created_at: string;
}

interface RatingsAnalyticsDashboardProps {
  artistId: string;
}

export const RatingsAnalyticsDashboard = ({ artistId }: RatingsAnalyticsDashboardProps) => {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRatings();
  }, [artistId]);

  const fetchRatings = async () => {
    try {
      const { data, error } = await supabase
        .from("performer_ratings")
        .select("*")
        .eq("artist_id", artistId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setRatings(data || []);
    } catch (error) {
      console.error("Error fetching ratings:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || ratings.length === 0) {
    return null;
  }

  // Calculate statistics
  const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  const totalRatings = ratings.length;
  const fiveStarCount = ratings.filter(r => r.rating === 5).length;
  const fiveStarPercentage = ((fiveStarCount / totalRatings) * 100).toFixed(0);

  // Get unique venues
  const uniqueVenues = new Set(ratings.filter(r => r.venue_name).map(r => r.venue_name)).size;

  // Rating distribution data
  const ratingDistribution = [1, 2, 3, 4, 5].map(star => ({
    stars: `${star}★`,
    count: ratings.filter(r => r.rating === star).length,
    star,
  }));

  // Monthly trend data (last 6 months)
  const sixMonthsAgo = subMonths(new Date(), 5);
  const months = eachMonthOfInterval({
    start: startOfMonth(sixMonthsAgo),
    end: endOfMonth(new Date()),
  });

  const monthlyTrend = months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthRatings = ratings.filter(r => {
      const ratingDate = parseISO(r.created_at);
      return ratingDate >= monthStart && ratingDate <= monthEnd;
    });

    const avgRating = monthRatings.length > 0
      ? monthRatings.reduce((sum, r) => sum + r.rating, 0) / monthRatings.length
      : null;

    return {
      month: format(month, "MMM"),
      fullMonth: format(month, "MMMM yyyy"),
      avgRating: avgRating ? Number(avgRating.toFixed(2)) : null,
      count: monthRatings.length,
    };
  });

  // Venue performance data
  const venuePerformance = ratings
    .filter(r => r.venue_name)
    .reduce((acc, r) => {
      const venue = r.venue_name!;
      if (!acc[venue]) {
        acc[venue] = { total: 0, count: 0 };
      }
      acc[venue].total += r.rating;
      acc[venue].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

  const venueData = Object.entries(venuePerformance)
    .map(([venue, data]) => ({
      venue: venue.length > 15 ? venue.substring(0, 15) + "..." : venue,
      fullVenue: venue,
      avgRating: Number((data.total / data.count).toFixed(2)),
      count: data.count,
    }))
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 5);

  const chartConfig = {
    avgRating: {
      label: "Avg Rating",
      color: "hsl(var(--primary))",
    },
    count: {
      label: "Ratings",
      color: "hsl(var(--secondary))",
    },
  };

  const getBarColor = (star: number) => {
    if (star >= 4) return "hsl(var(--primary))";
    if (star === 3) return "hsl(var(--muted-foreground))";
    return "hsl(var(--destructive))";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Ratings Analytics
        </CardTitle>
        <CardDescription>
          Track your performance trends and customer feedback
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-primary/10 rounded-lg text-center">
            <Star className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold text-primary">{averageRating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </div>
          <div className="p-4 bg-secondary/10 rounded-lg text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-secondary-foreground" />
            <p className="text-2xl font-bold">{totalRatings}</p>
            <p className="text-xs text-muted-foreground">Total Reviews</p>
          </div>
          <div className="p-4 bg-accent/10 rounded-lg text-center">
            <Star className="h-5 w-5 mx-auto mb-1 fill-current text-yellow-500" />
            <p className="text-2xl font-bold">{fiveStarPercentage}%</p>
            <p className="text-xs text-muted-foreground">5-Star Rate</p>
          </div>
          <div className="p-4 bg-muted rounded-lg text-center">
            <MapPin className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{uniqueVenues}</p>
            <p className="text-xs text-muted-foreground">Venues</p>
          </div>
        </div>

        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trend">Trend</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="venues">By Venue</TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="pt-4">
            <div className="h-[200px]">
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend}>
                    <defs>
                      <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      domain={[0, 5]} 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      ticks={[1, 2, 3, 4, 5]}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value, name) => {
                        if (name === 'avgRating') return [`${value} ⭐`, 'Avg Rating'];
                        return [value, name];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgRating"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#colorRating)"
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Average rating over the last 6 months
            </p>
          </TabsContent>

          <TabsContent value="distribution" className="pt-4">
            <div className="h-[200px]">
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ratingDistribution} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="stars" 
                      type="category" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value) => [`${value} ratings`, 'Count']}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {ratingDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColor(entry.star)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Distribution of ratings by star count
            </p>
          </TabsContent>

          <TabsContent value="venues" className="pt-4">
            {venueData.length > 0 ? (
              <>
                <div className="h-[200px]">
                  <ChartContainer config={chartConfig}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={venueData} layout="vertical">
                        <XAxis type="number" domain={[0, 5]} hide />
                        <YAxis 
                          dataKey="venue" 
                          type="category" 
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={100}
                        />
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                          formatter={(value, name, props) => {
                            if (name === 'avgRating') {
                              return [`${value} ⭐ (${props.payload.count} ratings)`, props.payload.fullVenue];
                            }
                            return [value, name];
                          }}
                        />
                        <Bar 
                          dataKey="avgRating" 
                          fill="hsl(var(--primary))" 
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Top 5 venues by average rating
                </p>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No venue-specific ratings yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
