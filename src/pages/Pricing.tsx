import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Crown, Music, Briefcase } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const Pricing = () => {
  const navigate = useNavigate();

  const tiers = [
    {
      name: "Basic Plan",
      price: "$9.99",
      description: "Perfect for getting started with essential features",
      icon: Music,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      features: [
        "Basic gig management",
        "Location sharing",
        "Message inbox",
        "Standard support",
        "Up to 5 band members",
      ],
      priceId: "price_1SLN7wEPiAZgF8MeBiPM6fj1",
    },
    {
      name: "Pro Plan",
      price: "$19.99",
      description: "Advanced features for professional bands",
      icon: Crown,
      color: "text-primary",
      bgColor: "bg-primary/10",
      featured: true,
      features: [
        "Everything in Basic",
        "Unlimited band members",
        "Advanced scheduling",
        "Priority support",
        "Custom setlists",
        "Analytics dashboard",
      ],
      priceId: "price_1SLNaaEPiAZgF8MeGXnGeydt",
    },
    {
      name: "Premium Plan",
      price: "$29.99",
      description: "Complete solution for booking managers",
      icon: Briefcase,
      color: "text-accent",
      bgColor: "bg-accent/10",
      features: [
        "Everything in Pro",
        "Multi-band management",
        "Advanced analytics",
        "API access",
        "White-label options",
        "Dedicated account manager",
        "Custom integrations",
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

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            return (
              <Card
                key={tier.name}
                className={`relative ${
                  tier.featured
                    ? "border-primary shadow-xl scale-105"
                    : "border-border/50"
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-primary to-secondary text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader>
                  <div className={`w-12 h-12 rounded-full ${tier.bgColor} flex items-center justify-center mb-4`}>
                    <Icon className={`h-6 w-6 ${tier.color}`} />
                  </div>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    <span className="text-muted-foreground">/month</span>
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
                    variant={tier.featured ? "default" : "outline"}
                    onClick={() => navigate("/auth")}
                  >
                    Get Started
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
