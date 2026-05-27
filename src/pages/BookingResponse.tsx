import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

const BookingResponse = () => {
  const [params] = useSearchParams();
  const status = params.get("status") || "unknown";
  const venue = params.get("venue") || "";
  const date = params.get("date") || "";

  const cfg = {
    accepted: {
      icon: <CheckCircle2 className="h-16 w-16 text-green-600" />,
      title: "Request Accepted",
      message: `Thanks! You've accepted the booking${venue ? ` at ${venue}` : ""}${date ? ` on ${date}` : ""}. The booker has been notified.`,
      accent: "bg-green-50 border-green-200",
    },
    declined: {
      icon: <XCircle className="h-16 w-16 text-red-600" />,
      title: "Request Declined",
      message: `You've declined the booking${venue ? ` at ${venue}` : ""}. The booker has been notified.`,
      accent: "bg-red-50 border-red-200",
    },
    already: {
      icon: <AlertCircle className="h-16 w-16 text-gray-500" />,
      title: "Already Responded",
      message: "This booking request has already been responded to.",
      accent: "bg-gray-50 border-gray-200",
    },
    expired: {
      icon: <AlertCircle className="h-16 w-16 text-amber-600" />,
      title: "Request Expired",
      message: "This booking request has expired. Please ask the booker to send a new one.",
      accent: "bg-amber-50 border-amber-200",
    },
    invalid: {
      icon: <XCircle className="h-16 w-16 text-red-600" />,
      title: "Invalid Link",
      message: "This link is missing required information or is no longer valid.",
      accent: "bg-red-50 border-red-200",
    },
    error: {
      icon: <XCircle className="h-16 w-16 text-red-600" />,
      title: "Something Went Wrong",
      message: params.get("message") || "An unexpected error occurred. Please try again.",
      accent: "bg-red-50 border-red-200",
    },
  } as const;

  const view = (cfg as any)[status] || cfg.invalid;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className={`max-w-md w-full bg-card rounded-xl border p-8 text-center shadow-sm`}>
        <div className="flex justify-center mb-4">{view.icon}</div>
        <h1 className="text-2xl font-bold mb-3">{view.title}</h1>
        <p className="text-muted-foreground mb-6">{view.message}</p>
        <Link
          to="/"
          className="inline-block px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition"
        >
          Open GigGme
        </Link>
      </div>
    </div>
  );
};

export default BookingResponse;
