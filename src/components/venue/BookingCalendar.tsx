import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, Music } from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isToday
} from "date-fns";

interface Booking {
  id: string;
  date: string;
  start_time: string;
  status: string;
  entertainer?: {
    name: string;
  };
}

interface BookingCalendarProps {
  bookings: Booking[];
  venueId: string;
}

export const BookingCalendar = ({ bookings, venueId }: BookingCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad the start to align with weekday
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(days);

  const getBookingsForDay = (date: Date) => {
    return bookings.filter(b => isSameDay(parseISO(b.date), date));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "callout":
        return "bg-orange-500";
      default:
        return "bg-muted";
    }
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {paddedDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dayBookings = getBookingsForDay(day);
            const hasBookings = dayBookings.length > 0;

            return (
              <div
                key={day.toISOString()}
                className={`aspect-square p-1 rounded-lg border transition-colors ${
                  isToday(day) 
                    ? "border-primary bg-primary/5" 
                    : "border-transparent hover:border-border"
                } ${hasBookings ? "cursor-pointer" : ""}`}
              >
                <div className="h-full flex flex-col">
                  <span className={`text-xs font-medium ${
                    isToday(day) ? "text-primary" : "text-foreground"
                  }`}>
                    {format(day, "d")}
                  </span>
                  {hasBookings && (
                    <div className="flex-1 flex flex-col gap-0.5 mt-1 overflow-hidden">
                      {dayBookings.slice(0, 2).map((booking) => (
                        <div
                          key={booking.id}
                          className={`text-[10px] px-1 py-0.5 rounded truncate text-white ${getStatusColor(booking.status)}`}
                        >
                          {booking.start_time?.slice(0, 5)}
                        </div>
                      ))}
                      {dayBookings.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{dayBookings.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">Confirmed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-xs text-muted-foreground">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-xs text-muted-foreground">Callout</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
