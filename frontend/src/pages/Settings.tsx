import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  ArrowRight,
  BellRing,
  Check,
  ChevronRight,
  Cpu,
  Gauge,
  Github,
  Gitlab,
  Globe2,
  Mail,
  Palette,
  Plug,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Slack,
  Sparkles,
  SquareKanban,
  UserRound,
  Zap,
} from "lucide-react";
import { Reveal } from "../components/ui/Reveal";
import { useToast } from "../components/ui/Toaster";
import { accents, applyAccent, type AccentId } from "../lib/theme";
import { api } from "../lib/api";
import { currentUser, roleLabel } from "../lib/auth";

const engines = [
  {
    id: "pro",
    name: "Balanced",
    tag: "Recommended",
    detail: "Best for most projects. Finds real issues without too much noise.",
    latency: "about 2 seconds",
    context: "large projects",
    icon: Sparkles,
  },
  {
    id: "flash",
    name: "Fast",
    tag: "Fast",
    detail: "A quick check before you commit. Catches common mistakes.",
    latency: "under a second",
    context: "small changes",
    icon: Zap,
  },
  {
    id: "deep",
    name: "Thorough",
    tag: "Slowest",
    detail: "The most complete check. Use it before a release.",
    latency: "10 to 30 seconds",
    context: "whole projects",
    icon: Cpu,
  },
] as const;

type EngineId = (typeof engines)[number]["id"];

const featureToggles = [
  {
    id: "taint",
    name: "Follow data through the code",
    detail: "Trace user input across files, not just single lines.",
  },
  {
    id: "cve",
    name: "Match known vulnerabilities",
    detail: "Compare your packages with public security alerts.",
  },
  {
    id: "secrets",
    name: "Find committed secrets",
    detail: "Catch passwords and keys accidentally saved in code.",
  },
  {
    id: "patch",
    name: "Suggest fixes",
    detail: "Write a suggested fix for every issue found.",
  },
  {
    id: "pr",
    name: "Comment on pull requests",
    detail: "Add notes before code is merged.",
  },
];

const integrations = [
  {
    id: "github",
    name: "GitHub",
    detail: "Add and manage projects from the Projects page",
    icon: Github,
    connected: true,
  },
  {
    id: "gitlab",
    name: "GitLab",
    detail: "Coming soon",
    icon: Gitlab,
    connected: false,
  },
  {
    id: "slack",
    name: "Slack",
    detail: "Coming soon",
    icon: Slack,
    connected: false,
  },
  {
    id: "jira",
    name: "Jira",
    detail: "Coming soon",
    icon: SquareKanban,
    connected: false,
  },
];

type StoredSettings = {
  engine?: string;
  sensitivity?: number;
  toggles?: Record<string, boolean>;
};

const loadSettings = (): StoredSettings => {
  try {
    return JSON.parse(localStorage.getItem("aegis-settings") ?? "{}") as StoredSettings;
  } catch {
    return {};
  }
};

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={clsx("switch", on && "is-on")}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    >
      <span className="switch-knob">
        {on && <Check size={10} />}
      </span>
    </button>
  );
}

export function Settings() {
  const toast = useToast();
  const [accent, setAccent] = useState<AccentId>(() => {
    const stored = localStorage.getItem("aegis-accent");
    return accents.some((entry) => entry.id === stored) ? (stored as AccentId) : "orange";
  });
  const [saved] = useState(loadSettings);
  const [engine, setEngine] = useState<EngineId>(() =>
    engines.some((entry) => entry.id === saved.engine) ? (saved.engine as EngineId) : "pro",
  );
  const [sensitivity, setSensitivity] = useState(saved.sensitivity ?? 72);
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => ({
    taint: true,
    cve: true,
    secrets: true,
    patch: true,
    pr: false,
    ...(saved.toggles ?? {}),
  }));
  const [profile, setProfile] = useState(() => {
    const user = currentUser();
    return {
      name: user?.name ?? "Aegis Operator",
      email: user?.email ?? "operator@aegis.dev",
      role: roleLabel(user?.role ?? "owner"),
      timezone: "Asia/Kolkata (IST)",
    };
  });
  const connected = Object.fromEntries(
    integrations.map((entry) => [entry.id, entry.connected]),
  ) as Record<string, boolean>;

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .me()
      .then((user) =>
        setProfile((current) => ({
          ...current,
          name: user.name,
          email: user.email,
          role: roleLabel(user.role),
        })),
      )
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const save = () => {
    localStorage.setItem("aegis-settings", JSON.stringify({ engine, sensitivity, toggles }));
    toast({
      title: "Preferences saved",
      message: "Your choices are stored in this browser.",
      tone: "success",
    });
  };

  const sensitivityLabel = sensitivity < 35 ? "Conservative" : sensitivity < 70 ? "Balanced" : "Aggressive";

  return (
    <div className="page-stack">
      <Reveal>
        <header className="page-head">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-pulse" />
              Workspace settings
            </div>
            <h1>
              Make Aegis fit <span className="text-gradient">how you work.</span>
            </h1>
            <p>
              Update your profile and choose how scans behave. Most people can keep the defaults.
            </p>
          </div>
          <div className="head-actions">
            <button type="button" className="btn btn-primary" onClick={save}>
              <Save size={16} /> Save changes
            </button>
          </div>
        </header>
      </Reveal>

      <section className="settings-grid wide-left">
        <Reveal>
          <article className="card profile-card">
            <div className="card-head compact">
              <div>
                <div className="card-eyebrow">
                  <UserRound size={14} /> Profile
                </div>
                <h2>Your profile</h2>
              </div>
              <span className="pill pill-mint">
                <ShieldCheck size={12} /> signed in
              </span>
            </div>
            <div className="profile-body">
              <div className="profile-avatar">
                <span>HS</span>
              </div>
              <div className="profile-fields">
                <label className="field">
                  <span>Display name</span>
                  <input
                    value={profile.name}
                    onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <div className="field-icon">
                    <Mail size={15} />
                    <input
                      value={profile.email}
                      onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                    />
                  </div>
                </label>
                <label className="field">
                  <span>Role</span>
                  <input
                    value={profile.role}
                    onChange={(event) => setProfile({ ...profile, role: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Timezone</span>
                  <div className="field-icon">
                    <Globe2 size={15} />
                    <select
                      value={profile.timezone}
                      onChange={(event) => setProfile({ ...profile, timezone: event.target.value })}
                    >
                      <option>Asia/Kolkata (IST)</option>
                      <option>Europe/London (GMT)</option>
                      <option>America/New_York (EST)</option>
                      <option>UTC</option>
                    </select>
                  </div>
                </label>
              </div>
            </div>
          </article>
        </Reveal>

        <Reveal delay={0.05}>
          <article className="card accent-card">
            <div className="card-eyebrow">
              <Palette size={14} /> Appearance
            </div>
            <h2>Accent colour</h2>
            <p className="card-sub">Choose the colour used for buttons and charts.</p>
            <div className="accent-grid">
              {accents.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  className={clsx("accent-swatch", accent === entry.id && "is-selected")}
                  onClick={() => setAccent(entry.id)}
                  aria-label={entry.name}
                  aria-pressed={accent === entry.id}
                >
                  <span className="accent-dot" style={{ background: entry.color, boxShadow: `0 0 14px ${entry.color}66` }}>
                    {accent === entry.id && <Check size={13} />}
                  </span>
                  <span>{entry.name}</span>
                </button>
              ))}
            </div>
            <div className="accent-preview">
              <span className="preview-dot" />
              <div>
                <strong>Preview</strong>
                <span>Buttons and charts update instantly.</span>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setAccent("orange")}>
                Default
              </button>
            </div>
          </article>
        </Reveal>
      </section>

      <Reveal>
        <details className="more-details settings-advanced">
          <summary className="more-details-summary">
            <span className="more-details-title">
              <SlidersHorizontal size={16} /> Advanced settings
            </span>
            <span className="more-details-hint">Scan engine, API key, strictness and connected tools</span>
            <ChevronRight className="more-details-chev" size={16} />
          </summary>
          <div className="more-details-body">
      <section className="settings-grid wide-left">
        <Reveal>
          <article className="card engine-select-card">
            <div className="card-head compact">
              <div>
                <div className="card-eyebrow">
                  <Cpu size={14} /> Scan engine
                </div>
                <h2>How scans run</h2>
              </div>
              <span className="pill pill-violet">Aegis runtime</span>
            </div>
            <div className="engine-options">
              {engines.map((entry) => {
                const Icon = entry.icon;
                return (
                  <button
                    type="button"
                    key={entry.id}
                    className={clsx("engine-option", engine === entry.id && "is-selected")}
                    onClick={() => setEngine(entry.id)}
                    aria-pressed={engine === entry.id}
                  >
                    <span className="engine-option-icon">
                      <Icon size={19} />
                    </span>
                    <span className="engine-option-copy">
                      <span className="engine-option-top">
                        <strong>{entry.name}</strong>
                        <span className="tag tag-mint">{entry.tag}</span>
                      </span>
                      <span className="engine-option-detail">{entry.detail}</span>
                      <span className="engine-option-meta">
                        <span>{entry.latency}</span>
                        <span>{entry.context}</span>
                      </span>
                    </span>
                    <span className="engine-radio">{engine === entry.id && <span />}</span>
                  </button>
                );
              })}
            </div>
          </article>
        </Reveal>

      </section>

      <section className="settings-grid">
        <Reveal>
          <article className="card detection-card">
            <div className="card-head compact">
              <div>
                <div className="card-eyebrow">
                  <Gauge size={14} /> Strictness
                </div>
                <h2>How much to report</h2>
              </div>
              <span className="pill pill-mint">{sensitivityLabel}</span>
            </div>
            <div className="sensitivity">
              <div className="sensitivity-value">
                {sensitivity}
                <span>%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={sensitivity}
                onChange={(event) => setSensitivity(Number(event.target.value))}
                aria-label="Detection sensitivity"
                className="range"
                style={{ ["--fill" as string]: `${sensitivity}%` }}
              />
              <div className="sensitivity-labels">
                <span>Fewer alerts</span>
                <span>More coverage</span>
              </div>
            </div>
            <p className="sensitivity-note">
              {sensitivity < 35
                ? "Only likely issues are shown. Best for older codebases with lots of warnings."
                : sensitivity < 70
                  ? "A balanced mix of important issues and useful warnings."
                  : "More issues are shown. You may need to dismiss some false alarms."}
            </p>
          </article>
        </Reveal>

        <Reveal delay={0.05}>
          <article className="card toggles-card">
            <div className="card-head compact">
              <div>
                <div className="card-eyebrow">
                  <Sparkles size={14} /> What scans check
                </div>
                <h2>Checks to run</h2>
              </div>
              <span className="pill pill-muted">5 checks</span>
            </div>
            <div className="toggle-list">
              {featureToggles.map((feature) => (
                <div className="toggle-row" key={feature.id}>
                  <div>
                    <strong>{feature.name}</strong>
                    <span>{feature.detail}</span>
                  </div>
                  <Toggle
                    on={Boolean(toggles[feature.id])}
                    onChange={(value) => setToggles((current) => ({ ...current, [feature.id]: value }))}
                    label={feature.name}
                  />
                </div>
              ))}
            </div>
          </article>
        </Reveal>
      </section>

      <section className="settings-grid">
        <Reveal className="col-span-2">
          <article className="card integrations-card">
            <div className="card-head compact">
              <div>
                <div className="card-eyebrow">
                  <Plug size={14} /> Other tools
                </div>
                <h2>Connected tools</h2>
              </div>
              <span className="pill pill-mint">
                <BellRing size={12} /> GitHub only
              </span>
            </div>
            <div className="integration-list">
              {integrations.map((entry) => {
                const Icon = entry.icon;
                const isOn = connected[entry.id];
                return (
                  <div className={clsx("integration-row", isOn && "is-connected")} key={entry.id}>
                    <span className="integration-icon">
                      <Icon size={19} />
                    </span>
                    <div className="integration-copy">
                      <strong>{entry.name}</strong>
                      <span>{entry.detail}</span>
                    </div>
                    <span className={clsx("pill", isOn ? "pill-mint" : "pill-muted")}>
                      {isOn ? "connected" : "available"}
                    </span>
                    <button
                      type="button"
                      className={clsx("btn btn-sm", isOn ? "btn-neo" : "btn-primary")}
                      onClick={() => {
                        if (isOn) {
                          toast({
                            title: `${entry.name}`,
                            message: "Add and manage projects from the Projects page.",
                            tone: "info",
                          });
                          return;
                        }
                        toast({
                          title: `${entry.name} is coming soon`,
                          message: "Aegis currently connects to GitHub only.",
                          tone: "info",
                        });
                      }}
                    >
                      {isOn ? "Manage" : "Coming soon"} <ArrowRight size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="integration-foot">
              <ShieldCheck size={14} />
              Aegis only reads your code. Nothing is changed in your projects.
            </div>
          </article>
        </Reveal>
      </section>
          </div>
        </details>
      </Reveal>
    </div>
  );
}
