import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, Sparkles, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";


interface SubStatus {
  subscribed: boolean;
  status: string | null;
  is_trial: boolean;
  trial_end: string | null;
  subscription_end: string | null;
  product_id: string | null;
  price_id: string | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  cancel_at_period_end: boolean;
}

const PLAN_NAMES: Record<string, string> = {
  price_1TcATOEPiAZgF8Me2TkOBbG0: "Entertainer",
  price_1TcATsEPiAZgF8MeuJY76UlD: "Featured Entertainer",
  price_1SLNgmEPiAZgF8MeOXGfKYvX: "Booking Manager",
  price_1SLNn8EPiAZgF8MeCFVMdvWR: "Entertainer",
  price_1Sfl1yEPiAZgF8MerV2S8Hcf: "Band Manager",
  price_1Sfl29EPiAZgF8Me7Z7r8ty8: "Booking Agent",
  price_1Sj4nrEPiAZgF8MeCOUpkIfg: "Venue Owner",
};


export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [data, setData] = useState<SubStatus | null>(null);

  const openCustomerPortal = async () => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (e: any) {
      toast({
        title: "Couldn't open billing portal",
        description: e?.message ?? "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };



  const fetchStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    const { data, error } = await supabase.functions.invoke("check-subscription", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!error) setData(data as SubStatus);
    setLoading(false);
  };

  useEffect(() => {
    // Stripe needs a moment to provision the subscription
    const timer = setTimeout(fetchStatus, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "—";

  const daysUntil = (iso: string | null) => {
    if (!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {loading ? (
            <>
              <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
              <CardTitle className="mt-4">Confirming your subscription…</CardTitle>
              <CardDescription>Hang tight, this only takes a moment.</CardDescription>
            </>
          ) : data?.is_trial ? (
            <>
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="mt-4">You're on a free trial</CardTitle>
              <CardDescription>
                Enjoy full access. No charge until your trial ends.
              </CardDescription>
            </>
          ) : data?.subscribed ? (
            <>
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="mt-4">Subscription active</CardTitle>
              <CardDescription>Welcome aboard — you're all set.</CardDescription>
            </>
          ) : (
            <>
              <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-muted-foreground" />
              </div>
              <CardTitle className="mt-4">Almost there</CardTitle>
              <CardDescription>
                We can't see your subscription yet. It may take a moment to sync.
              </CardDescription>
            </>
          )}
        </CardHeader>

        {!loading && data && (
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/60 divide-y divide-border/60">
              <Row label="Plan">
                <span className="text-sm font-medium">
                  {(data.price_id && PLAN_NAMES[data.price_id]) || "Subscription"}
                </span>
              </Row>
              {data.amount != null && data.currency && (
                <Row label="Price">
                  <span className="text-sm">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: data.currency.toUpperCase(),
                    }).format(data.amount / 100)}
                    {data.interval && (
                      <span className="text-muted-foreground">/{data.interval}</span>
                    )}
                  </span>
                </Row>
              )}
              <Row label="Status">
                <Badge variant={data.is_trial ? "secondary" : "default"} className="capitalize">
                  {data.status?.replace("_", " ") ?? "unknown"}
                </Badge>
              </Row>
              {data.is_trial && data.trial_end && (
                <Row label="Trial ends">
                  <span className="text-sm">
                    {formatDate(data.trial_end)}
                    <span className="text-muted-foreground"> · {daysUntil(data.trial_end)} days left</span>
                  </span>
                </Row>
              )}
              {data.subscription_end && (
                <Row label={
                  data.cancel_at_period_end
                    ? "Ends"
                    : data.is_trial
                    ? "First charge"
                    : "Renews"
                }>
                  <span className="text-sm">{formatDate(data.subscription_end)}</span>
                </Row>
              )}
            </div>


            {data.is_trial && (
              <p className="text-xs text-muted-foreground text-center">
                You can cancel anytime before {formatDate(data.trial_end)} and you won't be charged.
              </p>
            )}
          </CardContent>
        )}

        <CardContent className="pt-0 space-y-2">
          <Button className="w-full" onClick={() => navigate("/dashboard")}>
            Go to dashboard
          </Button>
          {!loading && !data?.subscribed && (
            <Button variant="ghost" className="w-full" onClick={() => { setLoading(true); fetchStatus(); }}>
              Refresh status
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
