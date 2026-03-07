import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import ContactList from "@/pages/ContactList";
import ContactDetail from "@/pages/ContactDetail";
import Billing from "@/pages/Billing";
import Collection from "@/pages/Collection";
import Settings from "@/pages/Settings";
import AuthPage from "@/pages/Auth";
import NotFound from "./pages/NotFound";
import { useState } from "react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();
  const [skipAuth, setSkipAuth] = useState(false);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user && !skipAuth) {
    return <AuthPage onSkip={() => setSkipAuth(true)} />;
  }

  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<ContactList />} />
            <Route path="/customers/:id" element={<ContactDetail />} />
            <Route path="/vendors" element={<ContactList />} />
            <Route path="/vendors/:id" element={<ContactDetail />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/collection" element={<Collection />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
