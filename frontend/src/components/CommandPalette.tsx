import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CornerDownLeft,
  FileBarChart2,
  FolderGit2,
  LayoutDashboard,
  PlusCircle,
  ScanSearch,
  Search,
  Settings,
  ShieldAlert,
  Terminal,
  type LucideIcon,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  hint: string;
  group: string;
  path: string;
  icon: LucideIcon;
  keywords: string;
}

const commands: Command[] = [
  {
    id: "dashboard",
    label: "Overview",
    hint: "Your next steps and latest results",
    group: "Navigate",
    path: "/",
    icon: LayoutDashboard,
    keywords: "dashboard home overview posture",
  },
  {
    id: "scan",
    label: "Scan code",
    hint: "Paste, upload or choose a project",
    group: "Navigate",
    path: "/scan",
    icon: ScanSearch,
    keywords: "scan review analyze code issues",
  },
  {
    id: "intel",
    label: "Vulnerability alerts",
    hint: "Known issues in your packages",
    group: "Navigate",
    path: "/intelligence",
    icon: ShieldAlert,
    keywords: "cve alerts vulnerabilities packages",
  },
  {
    id: "repos",
    label: "Projects",
    hint: "Add projects and see their risk",
    group: "Navigate",
    path: "/repositories",
    icon: FolderGit2,
    keywords: "repos repositories projects coverage",
  },
  {
    id: "reports",
    label: "Reports",
    hint: "Save and download scan results",
    group: "Navigate",
    path: "/reports",
    icon: FileBarChart2,
    keywords: "reports download export save",
  },
  {
    id: "settings",
    label: "Settings",
    hint: "Profile, accent and advanced options",
    group: "Navigate",
    path: "/settings",
    icon: Settings,
    keywords: "settings config api keys integrations theme",
  },
  {
    id: "new-scan",
    label: "Start a new scan",
    hint: "Open the code scanner",
    group: "Actions",
    path: "/scan",
    icon: Terminal,
    keywords: "new start scan terminal code",
  },
  {
    id: "connect",
    label: "Add a project",
    hint: "Connect GitHub",
    group: "Actions",
    path: "/repositories",
    icon: PlusCircle,
    keywords: "connect add project github repository",
  },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.hint} ${command.keywords}`.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const run = (command: Command) => {
    navigate(command.path);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((current) => (current + 1) % Math.max(filtered.length, 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => (current - 1 + filtered.length) % Math.max(filtered.length, 1));
    }
    if (event.key === "Enter" && filtered[cursor]) {
      event.preventDefault();
      run(filtered[cursor]);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="palette"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="palette-input-row">
              <Search size={18} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Jump to a page or run an action…"
                aria-label="Search commands"
              />
              <kbd>esc</kbd>
            </div>
            <div className="palette-list">
              {filtered.length === 0 && (
                <div className="palette-empty">
                  <ShieldAlert size={18} />
                  No results. Try “scan” or “report”.
                </div>
              )}
              {filtered.map((command, index) => {
                const Icon = command.icon;
                const previous = filtered[index - 1];
                const showGroup = !previous || previous.group !== command.group;
                return (
                  <div key={command.id}>
                    {showGroup && <div className="palette-group">{command.group}</div>}
                    <button
                      type="button"
                      className={`palette-item ${index === cursor ? "is-active" : ""}`}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => run(command)}
                    >
                      <span className="palette-icon">
                        <Icon size={17} />
                      </span>
                      <span className="palette-copy">
                        <strong>{command.label}</strong>
                        <span>{command.hint}</span>
                      </span>
                      {index === cursor ? (
                        <span className="palette-enter">
                          <CornerDownLeft size={15} />
                        </span>
                      ) : (
                        <ArrowRight size={15} className="palette-arrow" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="palette-foot">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>↵</kbd> open
              </span>
              <span className="palette-brand">AEGIS COMMAND</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
