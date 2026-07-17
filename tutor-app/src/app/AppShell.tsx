import { useEffect, useRef, useState } from "react";
import { Bell, Menu, NotebookPen, X } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { navigation, navigationFor } from "./navigation";
import { useAuth } from "./AuthContext";

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="brand" aria-label="Kim Thành Tutor">
        <span className="brand-mark" aria-hidden="true">KT</span>
        <span><strong>Kim Thành</strong><small>Tutor Workspace</small></span>
      </div>
      {(["work", "account"] as const).map((section) => (
        <div key={section}>
          <p className="nav-heading">{section === "work" ? "Làm việc" : "Tài khoản"}</p>
          <nav aria-label={section === "work" ? "Công việc gia sư" : "Tài khoản gia sư"}>
            {navigation.filter((item) => item.section === section).map((item) => (
              <NavLink key={item.path} to={item.path} onClick={onNavigate} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                <span className="nav-icon" aria-hidden="true"><item.icon size={18} strokeWidth={1.8} /></span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      ))}
    </>
  );
}

export function AppShell() {
  const { logout } = useAuth();
  const location = useLocation();
  const current = navigationFor(location.pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDrawerOpen(false);
    document.title = `${current?.label ?? "Không tìm thấy"} | Kim Thành Tutor`;
  }, [current, location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [drawerOpen]);

  return (
    <div className="app-shell">
      <aside className="sidebar"><Navigation /></aside>
      <div className="workspace">
        <header className="topbar">
          <button ref={menuButton} className="icon-button menu-button" type="button" aria-label="Mở menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Menu size={20} /></button>
          <div className="topbar-title"><strong>{current?.label ?? "Trang không tồn tại"}</strong><span>{current?.description}</span></div>
          <div className="topbar-spacer" />
          <NavLink className="quick-action" to="/lesson-logs"><NotebookPen size={16} />Ghi sổ đầu bài</NavLink>
          <NavLink className="icon-button" to="/notifications" aria-label="Thông báo"><Bell size={19} /></NavLink>
          <button className="avatar" type="button" aria-label="Đăng xuất" title="Đăng xuất" onClick={logout}>GS</button>
        </header>
        <main id="main-content" className="content" tabIndex={-1}><Outlet /></main>
      </div>

      <div className={`drawer-mask${drawerOpen ? " open" : ""}`} onMouseDown={() => setDrawerOpen(false)} aria-hidden={!drawerOpen}>
        <aside className="drawer" aria-label="Menu di động" onMouseDown={(event) => event.stopPropagation()}>
          <button className="drawer-close" type="button" aria-label="Đóng menu" onClick={() => setDrawerOpen(false)}><X size={23} /></button>
          <Navigation onNavigate={() => setDrawerOpen(false)} />
        </aside>
      </div>

      <nav className="bottom-nav" aria-label="Điều hướng nhanh">
        {navigation.filter((item) => item.mobile).map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => isActive ? "active" : undefined}>
            <span aria-hidden="true"><item.icon size={18} strokeWidth={1.8} /></span><small>{item.shortLabel}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
