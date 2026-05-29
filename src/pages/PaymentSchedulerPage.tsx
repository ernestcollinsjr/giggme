import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TopNav } from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import { PaymentScheduler } from "@/components/PaymentScheduler";

type UserRole = "super_admin" | "booking_manager" | "admin" | "entertainer" | "member" | null;

const PaymentSchedulerPage = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<UserRole>(null);

  useEffect(() => {
    (async () => {
      const { waitForUser } = await import("@/lib/requireAuth");
      const user = await waitForUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = data?.map((r) => r.role) || [];
      const primary =
        (roles.includes("super_admin") && "super_admin") ||
        (roles.includes("booking_manager") && "booking_manager") ||
        (roles.includes("booking_manager") && "booking_manager") ||
        (roles[0] as UserRole) ||
        null;
      setUserRole(primary as UserRole);
    })();
  }, [navigate]);

  const mode =
    userRole === "booking_manager" ? "booking_manager" : "booking_manager";

  return (
    <AppShell userRole={userRole}>
      <TopNav userRole={userRole} />
      <div className="min-h-screen bg-background pb-24 lg:pb-8">
        <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Payment Scheduler</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Schedule and track payments for your bookings.
            </p>
          </div>
          <PaymentScheduler mode={mode as any} />
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
};

export default PaymentSchedulerPage;
