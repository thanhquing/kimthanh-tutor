import { Navigate, Route, Routes } from "react-router-dom";
import { AccountUnavailablePage, ForbiddenPage } from "../pages/AccessStatePages";
import { AvailabilityPage } from "../pages/AvailabilityPage";
import { ConsentPage } from "../pages/ConsentPage";
import { LoginPage } from "../pages/LoginPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { ProfilePage } from "../pages/ProfilePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { AuthProvider } from "./AuthContext";
import { AppShell } from "./AppShell";
import { navigation } from "./navigation";
import { TutorAccessGate } from "./TutorAccessGate";

export function App() {
  return (
    <AuthProvider><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/consent" element={<ConsentPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route path="/account-unavailable" element={<AccountUnavailablePage />} />
      <Route element={<TutorAccessGate><AppShell /></TutorAccessGate>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/profile/*" element={<ProfilePage />} />
        <Route path="/availability/*" element={<AvailabilityPage />} />
        {navigation.filter((item) => item.path !== "/profile" && item.path !== "/availability").map((item) => <Route key={item.path} path={`${item.path}/*`} element={<PlaceholderPage item={item} />} />)}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes></AuthProvider>
  );
}
