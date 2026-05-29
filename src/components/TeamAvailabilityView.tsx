import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Users, CalendarDays, Check, X, HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth } from "date-fns";

interface BandMember {
  id: string;
  name: string;
  photo_urls: string[];
  instrument: string | null;
}

interface Availability {
  user_id: string;
  date: string;
  status: 'available' | 'unavailable' | 'tentative';
}

interface TeamAvailabilityViewProps {
  bandId: string | null;
}

export function TeamAvailabilityView({ bandId }: TeamAvailabilityViewProps) {
  const [members, setMembers] = useState<BandMember[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (bandId) {
      fetchMembersAndAvailability();
    }
  }, [bandId, currentMonth]);

  const fetchMembersAndAvailability = async () => {
    if (!bandId) return;
    setLoading(true);

    try {
      // Get band members from band_members table
      const { data: bandMembers, error: membersError } = await supabase
        .from("band_members")
        .select("member_id")
        .eq("band_id", bandId);

      if (membersError) throw membersError;

      // Also get members from gig invites for this band
      const { data: gigMembers, error: gigError } = await supabase
        .from("gig_members")
        .select(`
          member_id,
          gigs!inner (band_id)
        `)
        .eq("gigs.band_id", bandId);

      if (gigError) throw gigError;

      // Combine unique member IDs
      const memberIds = new Set<string>();
      bandMembers?.forEach((m: any) => memberIds.add(m.member_id));
      gigMembers?.forEach((m: any) => memberIds.add(m.member_id));

      if (memberIds.size === 0) {
        setMembers([]);
        setAvailability([]);
        setLoading(false);
        return;
      }

      const uniqueIds = Array.from(memberIds);

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, photo_urls, instrument")
        .in("id", uniqueIds);

      if (profilesError) throw profilesError;
      setMembers(profiles || []);

      // Fetch availability for the current month
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const { data: availData, error: availError } = await supabase
        .from("member_availability")
        .select("user_id, date, status")
        .in("user_id", uniqueIds)
        .gte("date", monthStart)
        .lte("date", monthEnd);

      if (availError) throw availError;
      setAvailability(availData as Availability[] || []);
    } catch (error) {
      console.error("Error fetching team availability:", error);
    } finally {
      setLoading(false);
    }
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getStatusForMemberDate = (memberId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availability.find(a => a.user_id === memberId && a.date === dateStr)?.status;
  };

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'available':
        return <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center"><Check className="h-3 w-3 text-white" /></div>;
      case 'unavailable':
        return <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center"><X className="h-3 w-3 text-white" /></div>;
      case 'tentative':
        return <div className="h-6 w-6 rounded-full bg-yellow-500 flex items-center justify-center"><HelpCircle className="h-3 w-3 text-white" /></div>;
      default:
        return <div className="h-6 w-6 rounded-full bg-muted" />;
    }
  };

  if (!bandId) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Availability
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[140px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No group members found</p>
            <p className="text-sm">Invite members to your group to see their availability</p>
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 justify-center text-sm pb-2 border-b">
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Unavailable</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">Tentative</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 rounded-full bg-muted" />
                <span className="text-muted-foreground">Not Set</span>
              </div>
            </div>

            {/* Scrollable table */}
            <ScrollArea className="w-full">
              <div className="min-w-max">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-background z-10 p-2 text-left border-b min-w-[150px]">
                        Member
                      </th>
                      {daysInMonth.map((day) => (
                        <th 
                          key={day.toISOString()} 
                          className={`p-1 text-center border-b min-w-[40px] ${
                            day.getDay() === 0 || day.getDay() === 6 ? 'bg-muted/30' : ''
                          }`}
                        >
                          <div className="text-xs text-muted-foreground">
                            {format(day, 'EEE')}
                          </div>
                          <div className="text-sm font-medium">
                            {format(day, 'd')}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="hover:bg-muted/30">
                        <td className="sticky left-0 bg-background z-10 p-2 border-b">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.photo_urls?.[0]} alt={member.name} />
                              <AvatarFallback className="text-xs">
                                {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{member.name}</p>
                              {member.instrument && (
                                <p className="text-xs text-muted-foreground truncate">{member.instrument}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        {daysInMonth.map((day) => {
                          const status = getStatusForMemberDate(member.id, day);
                          return (
                            <td 
                              key={day.toISOString()} 
                              className={`p-1 text-center border-b ${
                                day.getDay() === 0 || day.getDay() === 6 ? 'bg-muted/30' : ''
                              }`}
                            >
                              <div className="flex justify-center">
                                {getStatusIcon(status)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
