import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import {
  ArrowRight,
  Bell,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  Command,
  FileBarChart2,
  FolderGit2,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ScanSearch,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  X,
  MailWarning,
  Info,
} from "lucide-react";
import { Logo } from "./Logo";
import { CommandPalette } from "./CommandPalette";
import { Assistant } from "./Assistant";
import { currentUser, initials, roleLabel, signOut } from "../lib/auth";
import { api, type ApiNotification } from "../lib/api";
import { hasPermission } from "../lib/permissions";
import { applyTheme, currentTheme } from "../lib/theme";

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
      { to: "/health", label: "Service health", icon: HeartPulse, permission: "health:read" },
      { to: "/audit", label: "Audit log", icon: ScrollText, permission: "audit:read" },
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
  "/health": { eyebrow: "System", title: "Service health" },
  "/audit": { eyebrow: "Security", title: "Audit log" },
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
  const [tourOpen, setTourOpen] = useState(() => {
    try {
      return localStorage.getItem("aegis-tour-complete") !== "true";
    } catch {
      return false;
    }
  });
  const [tourStep, setTourStep] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [theme, setTheme] = useState(currentTheme());
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
    setNotificationsOpen(false);
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

  useEffect(() => {
    if (!notificationsOpen) return;
    void api
      .notifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, [notificationsOpen]);

  function finishTour() {
    try {
      localStorage.setItem("aegis-tour-complete", "true");
    } catch {}
    setTourOpen(false);
    setTourStep(0);
  }

  function nextTourStep() {
    if (tourStep >= helpSteps.length - 1) finishTour();
    else setTourStep((current) => current + 1);
  }

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
                  if ("permission" in item && !hasPermission(user?.role, item.permission)) return null;
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={"end" in item ? item.end : false}
                      className={({ isActive }) => clsx("nav-link", isActive && "is-active")}
                    >
                      {location.pathname === item.to && (
                        <motion.span
                          layoutId="nav-active-pill"
                          className="nav-active-pill"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
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
              className="icon-btn notification-btn"
              onClick={() => setNotificationsOpen((current) => !current)}
              aria-label="Open notifications"
              title="Notifications"
            >
              <Bell size={18} />
              {notifications.length > 0 && <span className="notification-dot" />}
            </button>

            <button
              type="button"
              className="icon-btn theme-btn"
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                applyTheme(next);
                setTheme(next);
              }}
              aria-label="Toggle color theme"
              title="Toggle color theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

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

        <motion.main
          key={location.pathname}
          className="page"
          initial={{ opacity: 0, y: 14, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 24, mass: 0.9 }}
        >
          <Outlet />
        </motion.main>
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

      <AnimatePresence>
        {notificationsOpen && (
          <>
            <motion.button
              className="scrim notification-scrim"
              aria-label="Close notifications"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotificationsOpen(false)}
            />
            <motion.aside
              className="help-panel card notification-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Notifications"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
            >
              <div className="help-panel-head">
                <div>
                  <span className="card-eyebrow">Activity</span>
                  <h2>Notifications</h2>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setNotificationsOpen(false)}
                  aria-label="Close notifications"
                >
                  <X size={17} />
                </button>
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <p>You're all caught up.</p>
                ) : (
                  notifications.map((item) => (
                    <div className="notification-item" key={item.id}>
                      <span className={`notification-kind ${item.kind}`}>{item.kind}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                        <time>{new Date(item.createdAt).toLocaleString()}</time>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tourOpen && (
          <>
            <motion.button
              className="scrim tour-scrim"
              aria-label="Close onboarding tour"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={finishTour}
            />
            <motion.div
              className="onboarding-card card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="onboarding-title"
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              <span className="onboarding-step">Step {tourStep + 1} of {helpSteps.length}</span>
              {(() => {
                const step = helpSteps[tourStep];
                const Icon = step.icon;
                return (
                  <>
                    <span className="onboarding-icon"><Icon size={24} /></span>
                    <h2 id="onboarding-title">{step.title}</h2>
                    <p>{step.detail}</p>
                  </>
                );
              })()}
              <div className="onboarding-dots">
                {helpSteps.map((step, index) => (
                  <span key={step.title} className={index === tourStep ? "is-active" : ""} />
                ))}
              </div>
              <div className="onboarding-actions">
                <button type="button" className="btn btn-ghost" onClick={finishTour}>Skip tour</button>
                <button type="button" className="btn btn-primary" onClick={nextTourStep}>
                  {tourStep === helpSteps.length - 1 ? "Finish" : "Next"}
                  <ArrowRight size={15} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Assistant />
    </div>
  );
}
