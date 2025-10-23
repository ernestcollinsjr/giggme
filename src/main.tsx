import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BandProvider } from "./contexts/BandContext.tsx";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        <BandProvider>
          <App />
        </BandProvider>
      </SubscriptionProvider>
    </QueryClientProvider>
  </StrictMode>
);
