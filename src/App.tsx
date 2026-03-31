import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import OrdersOverview from "./pages/OrdersOverview";
import Partners from "./pages/Partners";
import EmailTemplates from "./pages/EmailTemplates";
import PartnerBrief from "./pages/PartnerBrief";
import PartnerContract from "./pages/PartnerContract";
import PartnerTypes from "./pages/PartnerTypes";
import Todos from "./pages/Todos";
import CalendarPage from "./pages/CalendarPage";
import StockPlanning from "./pages/StockPlanning";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Navigate to="/orders" replace />} />
            <Route path="/orders" element={<AppLayout><OrdersOverview /></AppLayout>} />
            <Route path="/inventory-tracking" element={<Navigate to="/orders" replace />} />
            <Route path="/partners" element={<AppLayout><Partners /></AppLayout>} />
            <Route path="/email-templates" element={<AppLayout><EmailTemplates /></AppLayout>} />
            <Route path="/partner-brief" element={<AppLayout><PartnerBrief /></AppLayout>} />
            <Route path="/partner-contract" element={<AppLayout><PartnerContract /></AppLayout>} />
            <Route path="/partner-types" element={<AppLayout><PartnerTypes /></AppLayout>} />
            <Route path="/todos" element={<AppLayout><Todos /></AppLayout>} />
            <Route path="/calendar" element={<AppLayout><CalendarPage /></AppLayout>} />
            <Route path="/lager" element={<AppLayout><StockPlanning /></AppLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
