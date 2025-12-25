import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
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
import BookingManager from "./pages/BookingManager";
import NotFound from "./pages/NotFound";
import OpenExternal from "./pages/OpenExternal";
import Tours from "./pages/Tours";
import TourDetail from "./pages/TourDetail";
import TourInvite from "./pages/TourInvite";
import BandInvite from "./pages/BandInvite";
import VenueDashboard from "./pages/VenueDashboard";
import EntertainerMarketplace from "./pages/EntertainerMarketplace";
import EntertainerDashboard from "./pages/EntertainerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Notifications from "./pages/Notifications";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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
            <Route path="/tours" element={<Tours />} />
            <Route path="/tours/:tourId" element={<TourDetail />} />
            <Route path="/tour-invite/:token" element={<TourInvite />} />
            <Route path="/band-invite/:token" element={<BandInvite />} />
            <Route path="/booking-manager" element={<BookingManager />} />
            <Route path="/venue-dashboard" element={<VenueDashboard />} />
            <Route path="/entertainers" element={<EntertainerMarketplace />} />
            <Route path="/entertainer-dashboard" element={<EntertainerDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/open" element={<OpenExternal />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
