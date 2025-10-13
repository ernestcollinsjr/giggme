import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Music, Briefcase, MapPin, Calendar, Crown, LogOut, ListMusic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";
import RoleSwitcher from "@/components/RoleSwitcher";

interface Profile {
  id: string;
  name: string;
  bio: string;
  instrument: string;
  photo_url: string | null;
  location_lat: number;
  location_lng: number;
}

interface Rehearsal {
  id: string;
  date: string;
  venue: string;
  notes: string | null;
  band_leader_id: string;
}

interface Gig {
  id: string;
  date: string;
  venue: string;
  notes: string | null;
  status: string;
  user_id: string;
}

type UserRole = "band_leader" | "band_member" | "booking_manager";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }
    
    setUser(user);
    
    // Fetch user profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    // Fetch user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    
    if (profileData && roleData) {
      setProfile(profileData);
      setUserRole(roleData.role as UserRole);
      
      // Fetch rehearsals for band members and leaders
      if (roleData.role === "band_member" || roleData.role === "band_leader") {
        const { data: rehearsalData } = await supabase
          .from("rehearsals")
          .select("*")
          .order("date", { ascending: true });
        
        setRehearsals(rehearsalData || []);
        
        // Fetch gigs
        const { data: gigData } = await supabase
          .from("gigs")
          .select("*")
          .order("date", { ascending: true });
        
        setGigs(gigData || []);
      }
      
      // Booking managers see bands (leaders and members)
      if (roleData.role === "booking_manager") {
        const { data: bandLeaders } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["band_leader", "band_member"]);
        
        if (bandLeaders && bandLeaders.length > 0) {
          const userIds = bandLeaders.map(r => r.user_id);
          const { data: bandProfiles } = await supabase
            .from("profiles")
            .select("*")
            .in("id", userIds);
          
          setProfiles(bandProfiles || []);
        }
      }
    }
    
    setLoading(false);
  };

  useEffect(() => {
    checkAuth();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: error.message,
      });
    }
  };

  const handleShareLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Location not supported",
        description: "Your browser doesn't support geolocation.",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { error } = await supabase
            .from("profiles")
            .update({
              location_lat: position.coords.latitude,
              location_lng: position.coords.longitude,
            })
            .eq("id", user?.id);

          if (error) throw error;

          toast({
            title: "Location shared!",
            description: "Your location has been updated successfully.",
          });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Update failed",
            description: error.message,
          });
        }
      },
      (error) => {
        toast({
          variant: "destructive",
          title: "Location error",
          description: "Failed to get your location. Please check permissions.",
        });
      }
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 pb-20">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary">
              <AvatarImage src={profile?.photo_url || undefined} alt={profile?.name} />
              <AvatarFallback className="text-lg font-semibold bg-primary/10">
                {profile?.name?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Welcome, {profile?.name}
              </h1>
              <p className="text-muted-foreground mt-1">
                {userRole === "booking_manager" 
                  ? "Find bands and manage your roster" 
                  : userRole === "band_leader"
                  ? "Lead your band and connect with booking managers"
                  : "Share your location and connect with managers"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/profile-setup")}>
              Edit Profile
            </Button>
            <Button variant="destructive" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <RoleSwitcher currentRole={userRole} onRoleChange={checkAuth} />

        {(userRole === "band_leader" || userRole === "band_member") && (
          <>
            <Card 
              className="border-border/50 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => navigate("/rehearsals")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Rehearsals
                </CardTitle>
                <CardDescription>
                  Schedule and notes for band practice sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rehearsals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No rehearsals scheduled</p>
                ) : (
                  <div className="space-y-3">
                    {rehearsals.slice(0, 3).map((rehearsal) => (
                      <div key={rehearsal.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(rehearsal.date).toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                            <h4 className="font-semibold">{rehearsal.venue}</h4>
                            {rehearsal.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{rehearsal.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" className="w-full mt-4">
                  View All Rehearsals
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="border-border/50 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => navigate("/bookings")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-primary" />
                  Upcoming Gigs
                </CardTitle>
                <CardDescription>
                  Performance dates, venues, and details
                </CardDescription>
              </CardHeader>
              <CardContent>
                {gigs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No gigs scheduled</p>
                ) : (
                  <div className="space-y-3">
                    {gigs.slice(0, 3).map((gig) => (
                      <div key={gig.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={gig.status === 'confirmed' ? 'default' : 'secondary'}>
                                {gig.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(gig.date).toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                            <h4 className="font-semibold">{gig.venue}</h4>
                            {gig.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{gig.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" className="w-full mt-4">
                  View All Gigs
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListMusic className="h-5 w-5 text-primary" />
                  Setlists
                </CardTitle>
                <CardDescription>
                  View your band's setlists and play songs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate("/setlist")} className="w-full">
                  View Setlists
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Location Sharing
                </CardTitle>
                <CardDescription>
                  Let managers know where you are for on-time arrivals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleShareLocation} className="w-full">
                  Share My Location
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {userRole === "booking_manager" && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Available Bands
              </CardTitle>
              <CardDescription>
                Browse bands and start building your roster
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {profiles.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No bands available yet
                  </p>
                ) : (
                  profiles.map((p) => (
                    <Card key={p.id} className="border-border/50">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{p.name}</h3>
                            {p.instrument && (
                              <Badge variant="secondary" className="mt-2">
                                {p.instrument}
                              </Badge>
                            )}
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {p.bio}
                            </p>
                            {p.location_lat && p.location_lng && (
                              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>Location shared</span>
                              </div>
                            )}
                          </div>
                          <Button size="sm" className="ml-4">
                            Contact
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50 shadow-lg bg-gradient-to-br from-primary/5 to-secondary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Crown className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Upgrade to Premium</h3>
                <p className="text-sm text-muted-foreground">
                  Get unlimited bookings, priority support, and more
                </p>
              </div>
              <Button variant="outline">
                Subscribe
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
