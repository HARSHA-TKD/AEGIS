import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  CircleDot,
  Clock3,
  FolderGit2,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { SeverityBadge } from "../components/ui/Severity";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Button } from "../components/ui/Button";
import { api, errorMessage, type ApiDashboard, type ApiRepo, type ApiScan } from "../lib/api";
import { relativeTime, toFeedItem, toRepo } from "../lib/adapters";
import { currentUser } from "../lib/auth";
import type { FeedItem, Repo } from "../lib/types";

const severityColors: Record<string, string> = {
  Critical: "#dc4545",
  High: "#e58a38",
  Medium: "#d4a72c",
  Low: "#319b73",
};

const feedIcons = {
  alert: ShieldAlert,
  fix: ShieldCheck,
  scan: ScanSearch,
  intel: Activity,
} as const;

interface DashboardView {
  stats: ApiDashboard["stats"];
  severityMix: { label: string; value: number; color: string }[];
  riskTrend: { label: string; value: number }[];
  feed: FeedItem[];
  topRepos: Repo[];
  recentScans: ApiScan[];
}

function TrendChart({ points }: { points: { label: string; value: number }[] }) {
  const width = 760;
  const height = 236;
  const pad = { top: 18, right: 18, bottom: 30, left: 34 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const base = points.length ? points : [{ label: "—", value: 0 }];
  const series = base.length >= 2 ? base : [base[0], base[0]];
  const coords = useMemo(
    () =>
      series.map((point, index) => ({
        x: pad.left + (index / Math.max(1, series.length - 1)) * innerW,
        y: pad.top + (1 - point.value / 100) * innerH,
        ...point,
      })),
    [series, innerH, innerW, pad.left, pad.top],
  );
  const line = coords.map((point) => `${point.x},${point.y}`).join(" L ");
  const area = `M ${coords[0].x},${coords[0].y} L ${line} L ${coords[coords.length - 1].x},${
    height - pad.bottom
  } L ${coords[0].x},${height - pad.bottom} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="dash-chart" role="img" aria-label="Security risk across recent scans">
      <defs>
        <linearGradient id="dash-risk-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = pad.top + (1 - tick / 100) * innerH;
        return (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeDasharray="4 7"
            />
            <text x={8} y={y + 4} className="dash-chart-tick">
              {tick}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#dash-risk-fill)" />
      <path d={`M ${line}`} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      {coords.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          {(index === coords.length - 1 || index === 0) && (
            <circle cx={point.x} cy={point.y} r="4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
          )}
          {(index % Math.max(1, Math.ceil(coords.length / 7)) === 0 || index === coords.length - 1) && (
            <text x={point.x} y={height - 9} textAnchor="middle" className="dash-chart-label">
              {point.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function SeverityDonut({ mix }: { mix: { label: string; value: number; color: string }[] }) {
  const total = mix.reduce((sum, item) => sum + item.value, 0);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="dash-donut-wrap">
      <div className="dash-donut">
        <svg viewBox="0 0 152 152" aria-hidden="true">
          <circle cx="76" cy="76" r={radius} fill="none" stroke="var(--surface-3)" strokeWidth="12" />
          {mix.map((item) => {
            const length = total ? (item.value / total) * circumference : 0;
            const dash = Math.max(length - 4, 0);
            const circle = (
              <circle
                key={item.label}
                cx="76"
                cy="76"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 76 76)"
              />
            );
            offset += length;
            return circle;
          })}
        </svg>
        <span className="dash-donut-center">
          <strong>{total}</strong>
          <span>open findings</span>
        </span>
      </div>
      <div className="dash-legend">
        {mix.map((item) => (
          <div key={item.label} className="dash-legend-row">
            <span className="dash-legend-dot" style={{ background: item.color }} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{total ? Math.round((item.value / total) * 100) : 0}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="page-stack" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton height={30} width="38%" />
      <div className="dash-stat-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="card dash-stat" key={index}>
            <Skeleton height={34} width="34px" />
            <Skeleton height={30} width="48%" />
            <Skeleton height={12} width="66%" />
          </div>
        ))}
      </div>
      <div className="dash-main-grid">
        <div className="card dash-card">
          <Skeleton height={18} width="32%" />
          <Skeleton rows={5} height={14} />
        </div>
        <div className="card dash-card">
          <Skeleton height={18} width="50%" />
          <Skeleton height={140} />
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [remote, setRemote] = useState<ApiDashboard | null>(null);
  const [repos, setRepos] = useState<Record<string, ApiRepo>>({});
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all([api.dashboard(controller.signal), api.repos(controller.signal)])
      .then(([data, repoList]) => {
        setRemote(data);
        setRepos(Object.fromEntries(repoList.map((repo) => [repo.id, repo])));
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [reloadKey]);

  const view = useMemo<DashboardView | null>(() => {
    if (!remote) return null;
    return {
      stats: remote.stats,
      severityMix: remote.severityMix.map((item) => ({
        ...item,
        color: severityColors[item.label] ?? item.color,
      })),
      riskTrend: remote.riskTrend,
      feed: remote.feed.map(toFeedItem),
      topRepos: remote.topRepos.map(toRepo),
      recentScans: remote.recentScans,
    };
  }, [remote]);

  const firstName = (currentUser()?.name ?? "there").split(/\s+/)[0];
  const securityScore = view ? Math.max(0, 100 - view.stats.averageRisk) : 0;
  const priorityRepos = view
    ? [...view.topRepos].sort((a, b) => b.critical - a.critical || b.risk - a.risk).slice(0, 3)
    : [];
  const latestRisk = view?.riskTrend.at(-1)?.value ?? view?.stats.averageRisk ?? 0;

  if (error) {
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="Workspace overview"
          title={`Welcome back, ${firstName}.`}
          description="Your security overview could not be loaded."
        />
        <EmptyState
          icon={AlertTriangle}
          title="Dashboard unavailable"
          description={error}
          action={
            <Button variant="primary" icon={<RefreshCw size={15} />} onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (!view) return <DashboardSkeleton />;

  const hasFindings = view.stats.openFindings > 0;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Workspace overview"
        title={`Welcome back, ${firstName}.`}
        description="A clear view of your security posture, priority projects, and recent activity."
        actions={
          <>
            <Button icon={<FolderGit2 size={16} />} onClick={() => navigate("/repositories")}>
              Projects
            </Button>
            <Button variant="primary" icon={<ScanSearch size={16} />} onClick={() => navigate("/scan")}>
              Scan code
            </Button>
          </>
        }
      />

      <section className="dash-stat-grid" aria-label="Security summary">
        <article className="card dash-stat dash-stat-score">
          <div className="dash-stat-head">
            <span className="dash-stat-icon dash-icon-accent">
              <ShieldCheck size={18} />
            </span>
            <span className="pill pill-mint">{securityScore >= 60 ? "Healthy" : "Needs work"}</span>
          </div>
          <div className="dash-stat-value">
            {securityScore}
            <span>/100</span>
          </div>
          <div className="dash-stat-label">Security score</div>
          <p className="dash-stat-note">Derived from the average project risk score.</p>
        </article>

        <article className="card dash-stat">
          <div className="dash-stat-head">
            <span className="dash-stat-icon dash-icon-critical">
              <ShieldAlert size={18} />
            </span>
            <span className="pill pill-rose">Fix first</span>
          </div>
          <div className="dash-stat-value">{view.stats.critical}</div>
          <div className="dash-stat-label">Critical findings</div>
          <p className="dash-stat-note">{view.stats.high} high severity as well.</p>
        </article>

        <article className="card dash-stat">
          <div className="dash-stat-head">
            <span className="dash-stat-icon dash-icon-medium">
              <CircleDot size={18} />
            </span>
            <span className="pill pill-amber">Open</span>
          </div>
          <div className="dash-stat-value">{view.stats.openFindings}</div>
          <div className="dash-stat-label">Open findings</div>
          <p className="dash-stat-note">Across all connected projects.</p>
        </article>

        <article className="card dash-stat">
          <div className="dash-stat-head">
            <span className="dash-stat-icon dash-icon-low">
              <FolderGit2 size={18} />
            </span>
            <span className="pill">{view.stats.atRisk} at risk</span>
          </div>
          <div className="dash-stat-value">{view.stats.repositories}</div>
          <div className="dash-stat-label">Connected projects</div>
          <p className="dash-stat-note">{view.stats.scans} scans recorded.</p>
        </article>
      </section>

      <section className="dash-main-grid">
        <article className="card dash-card">
          <div className="card-head compact">
            <div>
              <div className="card-eyebrow">
                <Activity size={14} /> Risk trend
              </div>
              <h2>Security risk over time</h2>
              <p className="card-sub">Average risk from completed scans. Lower is better.</p>
            </div>
            <span className={clsx("chip", latestRisk <= 40 ? "chip-mint" : "")}>
              Latest {latestRisk}/100
            </span>
          </div>
          <TrendChart points={view.riskTrend} />
        </article>

        <article className="card dash-card">
          <div className="card-head compact">
            <div>
              <div className="card-eyebrow">
                <CircleDot size={14} /> Distribution
              </div>
              <h2>Findings by severity</h2>
            </div>
          </div>
          <SeverityDonut mix={view.severityMix} />
          {!hasFindings && <p className="dash-empty-note">No open findings. Run a scan to keep this current.</p>}
        </article>
      </section>

      <section className="dash-lower-grid">
        <article className="card dash-card">
          <div className="card-head compact">
            <div>
              <div className="card-eyebrow">
                <ShieldAlert size={14} /> Priority recommendations
              </div>
              <h2>What to review first</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate("/repositories")}>
              All projects <ChevronRight size={14} />
            </Button>
          </div>

          {priorityRepos.length ? (
            <div className="dash-reco-list">
              {priorityRepos.map((repo) => (
                <button
                  type="button"
                  className="dash-reco"
                  key={repo.id}
                  onClick={() => navigate("/repositories")}
                >
                  <span className={clsx("dash-reco-dot", repo.risk > 70 ? "is-critical" : repo.risk > 40 ? "is-high" : "is-low")} />
                  <span className="dash-reco-copy">
                    <strong>{repo.name}</strong>
                    <span>
                      {repo.critical > 0
                        ? `${repo.critical} critical and ${repo.high} high findings`
                        : repo.high > 0
                          ? `${repo.high} high severity findings`
                          : "No urgent findings"}
                    </span>
                  </span>
                  <span className="dash-reco-severity">
                    {repo.critical > 0 && <SeverityBadge severity="critical" compact />}
                    {repo.critical === 0 && repo.high > 0 && <SeverityBadge severity="high" compact />}
                  </span>
                  <span className="dash-reco-risk">{repo.risk}</span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FolderGit2}
              title="Connect your first project"
              description="Add a repository to start scanning and see prioritized recommendations."
              action={
                <Button variant="primary" onClick={() => navigate("/repositories")}>
                  Connect project
                </Button>
              }
              className="dash-inline-empty"
            />
          )}
        </article>

        <article className="card dash-card">
          <div className="card-head compact">
            <div>
              <div className="card-eyebrow">
                <Activity size={14} /> Recent activity
              </div>
              <h2>Latest events</h2>
            </div>
          </div>
          {view.feed.length ? (
            <div className="dash-feed">
              {view.feed.slice(0, 5).map((item) => {
                const Icon = feedIcons[item.kind];
                return (
                  <div className={clsx("dash-feed-item", `feed-${item.kind}`)} key={item.id}>
                    <span className="dash-feed-icon">
                      <Icon size={15} />
                    </span>
                    <div className="dash-feed-copy">
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <span className="dash-feed-time">{item.time}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="dash-empty-note">No activity yet. Connect a project and run a scan.</p>
          )}
        </article>
      </section>

      <section className="card dash-card">
        <div className="card-head compact">
          <div>
            <div className="card-eyebrow">
              <Clock3 size={14} /> Scan history
            </div>
            <h2>Recent scans</h2>
          </div>
        </div>
        {view.recentScans.length ? (
          <div className="dash-scan-list">
            {view.recentScans.map((scan) => {
              const repo = repos[scan.repositoryId];
              return (
                <div className="dash-scan-row" key={scan.id}>
                  <span className={clsx("dash-scan-state", `is-${scan.status}`)} />
                  <span className="dash-scan-copy">
                    <strong>{repo?.name ?? scan.repositoryId.slice(0, 8)}</strong>
                    <span>
                      {scan.filesScanned.toLocaleString()} files · {relativeTime(scan.completedAt ?? scan.createdAt)}
                    </span>
                  </span>
                  <span className="dash-scan-findings">{scan.findingsTotal} findings</span>
                  <span className="dash-scan-risk">Risk {scan.risk}</span>
                  <span className="pill">{scan.status}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="dash-empty-note">No scans yet. Start with a code scan or connect a project.</p>
        )}
      </section>
    </div>
  );
}
