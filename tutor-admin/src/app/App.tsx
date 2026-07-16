import { Navigate, Route, Routes } from "react-router-dom";
import { AuthGate } from "./AuthGate";
import { AppShell } from "./AppShell";
import { navigation } from "./navigation";
import { NotFoundPage } from "../pages/AccessStatePages";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { SettingsPage } from "../pages/SettingsPage";

export function App() {
  return <AuthGate><Routes><Route path="/" element={<Navigate to="/overview" replace />} /><Route element={<AppShell />}>{navigation.map((item) => <Route key={item.path} path={`${item.path}/*`} element={item.path === "/settings" ? <SettingsPage /> : <PlaceholderPage item={item} />} />)}<Route path="*" element={<NotFoundPage />} /></Route></Routes></AuthGate>;
}
