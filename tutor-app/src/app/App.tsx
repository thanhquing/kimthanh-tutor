import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AccountUnavailablePage, ForbiddenPage } from "../pages/AccessStatePages";
import { ConsentPage } from "../pages/ConsentPage";
import { LoginPage } from "../pages/LoginPage";
import {
  ForgotPasswordPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "../pages/AuthPasswordPages";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { LoadingState } from "../components/states/LoadingState";
import { AuthProvider } from "./AuthContext";
import { AppShell } from "./AppShell";
import { navigation } from "./navigation";
import { TutorAccessGate } from "./TutorAccessGate";

const AvailabilityPage = lazy(() => import("../pages/AvailabilityPage").then((module) => ({ default: module.AvailabilityPage })));
const DashboardPage = lazy(() => import("../pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ProfilePage = lazy(() => import("../pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const TrialsPage = lazy(() => import("../pages/TrialsPage").then((module) => ({ default: module.TrialsPage })));
const ClassesPage = lazy(() => import("../pages/ClassesPage").then((module) => ({ default: module.ClassesPage })));
const ClassDetailPage = lazy(() => import("../pages/ClassDetailPage").then((module) => ({ default: module.ClassDetailPage })));

function FeatureRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="panel"><LoadingState label="Đang mở màn hình…" /></div>}>{children}</Suspense>;
}

export function App() {
  return (
    <AuthProvider><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/consent" element={<ConsentPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route path="/account-unavailable" element={<AccountUnavailablePage />} />
      <Route element={<TutorAccessGate><AppShell /></TutorAccessGate>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/profile/*" element={<FeatureRoute><ProfilePage /></FeatureRoute>} />
        <Route path="/availability/*" element={<FeatureRoute><AvailabilityPage /></FeatureRoute>} />
        <Route path="/dashboard/*" element={<FeatureRoute><DashboardPage /></FeatureRoute>} />
        <Route path="/trials/*" element={<FeatureRoute><TrialsPage /></FeatureRoute>} />
        <Route path="/classes" element={<FeatureRoute><ClassesPage /></FeatureRoute>} />
        <Route path="/classes/:id" element={<FeatureRoute><ClassDetailPage /></FeatureRoute>} />
        {navigation.filter((item) => !["/dashboard", "/profile", "/availability", "/trials", "/classes"].includes(item.path)).map((item) => <Route key={item.path} path={`${item.path}/*`} element={<PlaceholderPage item={item} />} />)}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes></AuthProvider>
  );
}
