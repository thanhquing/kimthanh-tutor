import { Navigate, Route, Routes } from "react-router-dom";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { AppShell } from "./AppShell";
import { navigation } from "./navigation";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<AppShell />}>
        {navigation.map((item) => (
          <Route key={item.path} path={`${item.path}/*`} element={<PlaceholderPage item={item} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
