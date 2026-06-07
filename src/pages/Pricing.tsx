import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Crown, Music, Briefcase, Mic } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string, planName: string) => {
    try {
      setLoading(priceId);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const tiers = [
    {
      name: "Free Plan",
      price: "Free",
      description: "Build your inventory quickly at no cost",
      icon: Mic,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      features: [
        "Basic profile",
        "One photo",
        "One demo video",
        "Basic contact information",
      ],
      priceId: "",
    },
    {
      name: "Performer Pro",
      price: "$7.99",
      description: "Stand out and get booked faster",
      icon: Crown,
      color: "text-primary",
      bgColor: "bg-primary/10",
      features: [
        "Unlimited videos",
        "Featured profile",
        "Priority in search results",
        "Calendar availability",
        "Gig notifications",
        "Booking history",
      ],
      priceId: "price_1TcATsEPiAZgF8MeuJY76UlD",
    },
    {
      name: "Booking Manager",
      price: "$49.99",
      description: "Everything you need to book talent",
      icon: Briefcase,
      color: "text-accent",
      bgColor: "bg-accent/10",
      features: [
        "Multi-group management",
        "Artist discovery",
        "Location tracking",
        "Direct messaging",
        "Standard support",
        "Booking calendar",
      ],
      priceId: "price_1SLNgmEPiAZgF8MeOXGfKYvX",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-purple-500 to-secondary bg-clip-text text-transparent">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your needs. All plans include a 14-day free trial.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            return (
              <Card
                key={tier.name}
                className="relative border-border/50"
              >
                <CardHeader>
                  <div className={`w-12 h-12 rounded-full ${tier.bgColor} flex items-center justify-center mb-4`}>
                    <Icon className={`h-6 w-6 ${tier.color}`} />
                  </div>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    {tier.price !== "Free" && (
                      <span className="text-muted-foreground">/month</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => tier.price === "Free" ? navigate("/auth") : handleCheckout(tier.priceId, tier.name)}
                    disabled={loading === tier.priceId}
                  >
                    {loading === tier.priceId ? "Loading..." : tier.price === "Free" ? "Get Started Free" : "Subscribe Now"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          <Button variant="ghost" onClick={() => navigate("/")}>
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
