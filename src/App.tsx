import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/ui/Toaster";
import { Dashboard } from "./pages/Dashboard";
import { CodeReview } from "./pages/CodeReview";
import { Intelligence } from "./pages/Intelligence";
import { Phishing } from "./pages/Phishing";
import { About } from "./pages/About";
import { Repositories } from "./pages/Repositories";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Reports } from "./pages/Reports";
import { ReportDetail } from "./pages/ReportDetail";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { isAuthenticated } from "./lib/auth";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

function RequireAuth() {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ScrollToTop />
        <Routes>
          <Route path="login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
          <Route path="reset-password" element={<PublicOnly><ResetPassword /></PublicOnly>} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="scan" element={<CodeReview />} />
              <Route path="intelligence" element={<Intelligence />} />
              <Route path="phishing" element={<Phishing />} />
              <Route path="about" element={<About />} />
              <Route path="repositories" element={<Repositories />} />
              <Route path="projects/:projectId" element={<ProjectDetail />} />
              <Route path="projects/:projectId" element={<ProjectDetail />} />
              <Route path="reports" element={<Reports />} />
              <Route path="reports/:reportId" element={<ReportDetail />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
