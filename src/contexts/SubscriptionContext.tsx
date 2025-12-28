import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionContextType {
  isSubscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
  checkSubscription: () => Promise<void>;
  isPro: boolean;
  isSuperAdmin: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isSubscribed: false,
  productId: null,
  subscriptionEnd: null,
  loading: true,
  checkSubscription: async () => {},
  isPro: false,
  isSuperAdmin: false,
});

export const useSubscription = () => useContext(SubscriptionContext);

const PRO_PRODUCT_ID = "prod_THxVSHm8u6lzNH"; // Pro Plan product ID

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const { toast } = useToast();

  const checkSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsSubscribed(false);
        setProductId(null);
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      // Check if user is super_admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (roleData) {
        setIsSuperAdmin(true);
      } else {
        setIsSuperAdmin(false);
      }

      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setIsSubscribed(data.subscribed || false);
      setProductId(data.product_id || null);
      setSubscriptionEnd(data.subscription_end || null);
    } catch (error: any) {
      console.error("Error checking subscription:", error);
      setIsSubscribed(false);
      setProductId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSubscription();

    // Check subscription every minute
    const interval = setInterval(checkSubscription, 60000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkSubscription();
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  // Super admins get Pro access regardless of subscription
  const isPro = isSuperAdmin || (isSubscribed && productId === PRO_PRODUCT_ID);

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        productId,
        subscriptionEnd,
        loading,
        checkSubscription,
        isPro,
        isSuperAdmin,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
