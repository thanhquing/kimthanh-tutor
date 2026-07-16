import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { navigation, navigationFor } from "./navigation";

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return <><div className="brand"><span className="brand-mark"><ShieldCheck size={21} /></span><span><strong>Kim Thành Tutor</strong><small>Operations Console</small></span></div>
    {(["operations", "system"] as const).map((section) => <div key={section}><p className="nav-heading">{section === "operations" ? "Vận hành" : "Hệ thống"}</p><nav aria-label={section === "operations" ? "Điều hướng vận hành" : "Điều hướng hệ thống"}>{navigation.filter((item) => item.section === section).map((item) => <NavLink key={item.path} to={item.path} onClick={onNavigate} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}><item.icon size={18} /><span>{item.label}</span></NavLink>)}</nav></div>)}</>;
}

export function AppShell() {
  const location = useLocation(); const current = navigationFor(location.pathname); const { logout, me } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false); const button = useRef<HTMLButtonElement>(null);
  useEffect(() => { setDrawerOpen(false); document.title = `${current?.label ?? "Không tìm thấy"} | Kim Thành Tutor`; }, [current, location.pathname]);
  useEffect(() => { if (!drawerOpen) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setDrawerOpen(false); button.current?.focus(); } }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [drawerOpen]);
  return <div className="app-shell"><aside className="sidebar"><Navigation /></aside><div className="workspace"><header className="topbar"><button ref={button} className="icon-button menu-button" type="button" aria-label="Mở menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Menu size={20} /></button><div className="topbar-title"><strong>{current?.label ?? "Trang không tồn tại"}</strong><span>{current?.description}</span></div><div className="topbar-spacer" /><span className="admin-identity">{me?.user.email ?? "Quản trị viên"}</span><button className="logout-button" type="button" onClick={logout}><LogOut size={16} />Đăng xuất</button></header><main id="main-content" className="content" tabIndex={-1}><Outlet /></main></div>
    <div className={`drawer-mask${drawerOpen ? " open" : ""}`} onMouseDown={() => setDrawerOpen(false)} aria-hidden={!drawerOpen}><aside className="drawer" aria-label="Menu di động" onMouseDown={(event) => event.stopPropagation()}><button className="drawer-close" type="button" aria-label="Đóng menu" onClick={() => setDrawerOpen(false)}><X size={23} /></button><Navigation onNavigate={() => setDrawerOpen(false)} /></aside></div>
    <nav className="bottom-nav" aria-label="Điều hướng nhanh">{navigation.filter((item) => item.mobile).map((item) => <NavLink key={item.path} to={item.path} className={({ isActive }) => isActive ? "active" : undefined}><item.icon size={18} /><small>{item.shortLabel}</small></NavLink>)}</nav></div>;
}
