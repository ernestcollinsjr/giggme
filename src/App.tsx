import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProfileSetup from "./pages/ProfileSetup";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Bookings from "./pages/Bookings";
import Rehearsals from "./pages/Rehearsals";
import Setlist from "./pages/Setlist";
import SongLyrics from "./pages/SongLyrics";
import Pricing from "./pages/Pricing";
import ArtistProfile from "./pages/ArtistProfile";
import ArtistsDiscovery from "./pages/ArtistsDiscovery";
import NotFound from "./pages/NotFound";
import OpenExternal from "./pages/OpenExternal";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/rehearsals" element={<Rehearsals />} />
          <Route path="/setlist" element={<Setlist />} />
          <Route path="/setlist/lyrics/:songId" element={<SongLyrics />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/artist-profile" element={<ArtistProfile />} />
          <Route path="/artists" element={<ArtistsDiscovery />} />
          <Route path="/open" element={<OpenExternal />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
