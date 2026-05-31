import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import GetStarted from "./pages/GetStarted";
import ProfileSetup from "./pages/ProfileSetup";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Bookings from "./pages/Bookings";
import Rehearsals from "./pages/Rehearsals";
import Setlist from "./pages/Setlist";
import SongLyrics from "./pages/SongLyrics";
import Pricing from "./pages/Pricing";
import PerformerProfileView from "./pages/PerformerProfileView";
import ArtistsDiscovery from "./pages/ArtistsDiscovery";

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
import BookingManagerAdmin from "./pages/BookingManagerAdmin";
import Notifications from "./pages/Notifications";
import ScheduleReminder from "./pages/ScheduleReminder";
import SharedSetlist from "./pages/SharedSetlist";
import RatePerformer from "./pages/RatePerformer";
import Messages from "./pages/Messages";
import BookingRequestResponse from "./pages/BookingRequestResponse";
import BookingResponse from "./pages/BookingResponse";
import FindEntertainers from "./pages/FindEntertainers";
import PaymentSchedulerPage from "./pages/PaymentSchedulerPage";
import BookingRequestsPage from "./pages/BookingRequestsPage";
import ScheduleDemo from "./pages/ScheduleDemo";
import Contact from "./pages/Contact";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import AppLayout from "./components/AppLayout";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<Auth />} />
            <Route path="/get-started" element={<GetStarted />} />
            <Route element={<AppLayout />}>
              <Route path="/profile-setup" element={<ProfileSetup />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/rehearsals" element={<Rehearsals />} />
              <Route path="/setlist" element={<Setlist />} />
              <Route path="/setlist/lyrics/:songId" element={<SongLyrics />} />
              <Route path="/artist-profile" element={<ProfileSetup />} />
              <Route path="/artist-profile/:userId" element={<PerformerProfileView />} />
              <Route path="/artists" element={<ArtistsDiscovery />} />
              <Route path="/tours" element={<Tours />} />
              <Route path="/tours/:tourId" element={<TourDetail />} />
              <Route path="/booking-manager" element={<BookingManagerAdmin />} />
              <Route path="/venue-dashboard" element={<VenueDashboard />} />
              <Route path="/entertainers" element={<EntertainerMarketplace />} />
              <Route path="/entertainer-dashboard" element={<EntertainerDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/booking-admin" element={<BookingManagerAdmin />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/schedule-reminder" element={<ScheduleReminder />} />
              <Route path="/find-entertainers" element={<FindEntertainers />} />
              <Route path="/payment-scheduler" element={<PaymentSchedulerPage />} />
              <Route path="/booking-requests" element={<BookingRequestsPage />} />
              <Route path="/subscription-success" element={<SubscriptionSuccess />} />
            </Route>

            <Route path="/pricing" element={<Pricing />} />
            <Route path="/tour-invite/:token" element={<TourInvite />} />
            <Route path="/band-invite/:token" element={<BandInvite />} />
            <Route path="/shared-setlist/:token" element={<SharedSetlist />} />
            <Route path="/rate/:artistId" element={<RatePerformer />} />
            <Route path="/open" element={<OpenExternal />} />
            <Route path="/booking-request/:id" element={<BookingRequestResponse />} />
            <Route path="/booking-response" element={<BookingResponse />} />
            <Route path="/schedule-demo" element={<ScheduleDemo />} />
            <Route path="/contact" element={<Contact />} />


            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
