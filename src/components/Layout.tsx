import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import {
  ArrowRight,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  Command,
  FileBarChart2,
  FolderGit2,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanSearch,
  Settings,
  ShieldAlert,
  ShieldCheck,
  X,
  MailWarning,
  Info,
} from "lucide-react";
import { Logo } from "./Logo";
import { CommandPalette } from "./CommandPalette";
import { currentUser, initials, roleLabel, signOut } from "../lib/auth";
import { api } from "../lib/api";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
      { to: "/scan", label: "Scan code", icon: ScanSearch },
      { to: "/repositories", label: "Projects", icon: FolderGit2 },
      { to: "/reports", label: "Reports", icon: FileBarChart2 },
    ],
  },
  {
    label: "Stay informed",
    items: [
      { to: "/intelligence", label: "Vulnerability alerts", icon: ShieldAlert },
      { to: "/phishing", label: "Phishing Identifier", icon: MailWarning },
      { to: "/settings", label: "Settings", icon: Settings },
      { to: "/about", label: "About", icon: Info },
    ],
  },
] as const;

const pageMeta: Record<string, { eyebrow: string; title: string }> = {
  "/": { eyebrow: "Your workspace", title: "Overview" },
  "/scan": { eyebrow: "Step 2 of 3", title: "Scan code" },
  "/repositories": { eyebrow: "Projects", title: "Projects" },
      "/projects": { eyebrow: "Projects", title: "Project detail" },
  "/intelligence": { eyebrow: "Security news", title: "Vulnerability alerts" },
  "/reports": { eyebrow: "Step 3 of 3", title: "Reports" },
  "/settings": { eyebrow: "Your account", title: "Settings" },
};

const helpSteps = [
  {
    icon: FolderGit2,
    title: "Connect a project",
    detail: "Add a GitHub repository you want Aegis to check. Public projects work without any setup.",
  },
  {
    icon: ScanSearch,
    title: "Scan the code",
    detail: "Aegis looks for common security problems and explains each one in plain language.",
  },
  {
    icon: ShieldCheck,
    title: "Fix what matters",
    detail: "Follow the suggested fix, then scan again to confirm the problem is gone.",
  },
];

export function Layout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const meta = pageMeta[location.pathname] ?? pageMeta["/"];
  const user = currentUser();
  const displayName = user?.name ?? "Aegis Operator";
  const userInitials = initials(displayName);
  const userRole = roleLabel(user?.role ?? "owner");

  useEffect(() => {
    setMobileOpen(false);
    setHelpOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
      if (event.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" aria-hidden="true" />
      <div className="ambient ambient-b" aria-hidden="true" />
      <div className="ambient ambient-c" aria-hidden="true" />

      <AnimatePresence>
        {mobileOpen && (
          <motion.button
            className="scrim"
            aria-label="Close navigation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={clsx("sidebar", mobileOpen && "is-open")}>
        <div className="sidebar-inner">
          <div className="sidebar-top">
            <Logo />
            <button
              type="button"
              className="icon-btn sidebar-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="nav" aria-label="Primary">
            {navGroups.map((group) => (
              <div className="nav-group" key={group.label}>
                <span className="nav-label">{group.label}</span>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={"end" in item ? item.end : false}
                      className={({ isActive }) => clsx("nav-link", isActive && "is-active")}
                    >
                      <span className="nav-icon">
                        <Icon size={18} strokeWidth={1.9} />
                      </span>
                      <span className="nav-text">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-foot">
            <button type="button" className="help-card" onClick={() => setHelpOpen(true)}>
              <span className="help-card-icon">
                <CircleHelp size={17} />
              </span>
              <span className="help-card-copy">
                <strong>Need a hand?</strong>
                <span>Open the quick guide</span>
              </span>
              <ChevronRight size={16} />
            </button>

            <button className="user-card" type="button" onClick={() => navigate("/settings")}>
              <span className="avatar avatar-ring">{userInitials}</span>
              <span className="user-copy">
                <strong>{displayName}</strong>
                <span>{userRole}</span>
              </span>
              <ChevronRight size={16} className="user-chev" />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-btn menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="crumb">
              <span className="crumb-eyebrow">{meta.eyebrow}</span>
              <div className="crumb-title">{meta.title}</div>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="search-trigger"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search pages and actions"
            >
              <Command size={16} />
              <span>Search</span>
              <kbd>Ctrl K</kbd>
            </button>

            <button type="button" className="btn btn-primary topbar-scan" onClick={() => navigate("/scan")}>
              <ScanSearch size={17} />
              <span>Scan code</span>
            </button>

            <button
              type="button"
              className="avatar avatar-top"
              onClick={() => navigate("/settings")}
              aria-label="Open profile"
            >
              <CircleUserRound size={17} />
              <span>{userInitials}</span>
              <span className="avatar-status" />
            </button>

            <button
              type="button"
              className="icon-btn signout-btn"
              onClick={() => {
                void api
                  .logout()
                  .catch(() => undefined)
                  .finally(() => {
                    signOut();
                    navigate("/login", { replace: true });
                  });
              }}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>

      <AnimatePresence>
        {helpOpen && (
          <>
            <motion.button
              className="scrim help-scrim"
              aria-label="Close quick guide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHelpOpen(false)}
            />
            <motion.aside
              className="help-panel card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-guide-title"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
            >
              <div className="help-panel-head">
                <div>
                  <span className="card-eyebrow">Quick guide</span>
                  <h2 id="quick-guide-title">Aegis in three steps</h2>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setHelpOpen(false)}
                  aria-label="Close quick guide"
                >
                  <X size={17} />
                </button>
              </div>

              <ol className="help-steps">
                {helpSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title}>
                      <span className="help-step-index">{index + 1}</span>
                      <span className="help-step-icon">
                        <Icon size={17} />
                      </span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="help-panel-foot">
                <p>You can revisit this guide any time from the sidebar.</p>
                <button
                  type="button"
                  className="btn btn-primary full-btn"
                  onClick={() => {
                    setHelpOpen(false);
                    navigate("/scan");
                  }}
                >
                  Start with a scan <ArrowRight size={16} />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
