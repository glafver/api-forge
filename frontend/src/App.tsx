import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ChangePassword from "@/pages/ChangePassword";
import Projects from "@/pages/Projects";
import ApiForge from "@/pages/ApiForge";
import Profile from "@/pages/Profile";
import NotFound from "./pages/NotFound";

function AppRoutes() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (profile?.must_change_password) {
    return <ChangePassword />;
  }

  if (profile?.is_blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">
            Account Blocked
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your account has been blocked. Contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route
          path="/projects"
          element={<Navigate to="/projects/owned" replace />}
        />
        <Route path="/projects/owned" element={<Projects view="owned" />} />
        <Route path="/projects/member" element={<Projects view="member" />} />
        <Route path="/profile" element={<Profile />} />
        <Route
          path="/api-forge"
          element={<Navigate to="/projects/owned" replace />}
        />
        <Route path="/api-forge/:projectId" element={<ApiForge />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <TooltipProvider>
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
