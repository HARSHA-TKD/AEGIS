import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  AlertTriangle,
  ChevronRight,
  Code2,
  FolderGit2,
  GitBranch,
  Github,
  Gitlab,
  Loader2,
  Plus,
  RefreshCw,
  ScanSearch,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { SeverityBadge } from "../components/ui/Severity";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import { Field } from "../components/ui/Field";
import { useToast } from "../components/ui/Toaster";
import { api, errorMessage, type ApiRepo } from "../lib/api";
import { formatLoc, relativeTime } from "../lib/adapters";

const filters = [
  { id: "all", label: "All projects" },
  { id: "at-risk", label: "Needs attention" },
  { id: "protected", label: "Looking good" },
] as const;

type Filter = (typeof filters)[number]["id"];

const providerOptions = [
  { id: "github", label: "GitHub", icon: Github, hint: "Read-only access", available: true },
  { id: "gitlab", label: "GitLab", icon: Gitlab, hint: "Not available yet", available: false },
] as const;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function ProjectCard({
  repo,
  scanning,
  onScan,
  onOpen,
}: {
  repo: ApiRepo;
  scanning: boolean;
  onScan: (repo: ApiRepo) => void;
  onOpen: (repo: ApiRepo) => void;
}) {
  const atRisk = repo.risk > 40;
  const tone = repo.risk > 70 ? "critical" : atRisk ? "high" : "low";

  return (
    <article className={clsx("card project-card", scanning && "is-scanning")}>
      <div className="project-card-head">
        <span className="project-icon">
          <Github size={19} />
        </span>
        <div className="project-ident">
          <strong>{repo.name}</strong>
          <span>{repo.fullName}</span>
        </div>
        <span className={clsx("pill", scanning ? "pill-amber" : atRisk ? "pill-rose" : "pill-mint")}>
          {scanning ? <Loader2 size={12} className="spin" /> : atRisk ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
          {scanning ? "Scanning" : atRisk ? "Needs attention" : "Looking good"}
        </span>
      </div>

      <div className="project-card-body">
        <div className={clsx("project-score", `score-${tone}`)}>
          <span className="project-score-value">{repo.risk}</span>
          <span className="project-score-label">risk score</span>
          <span className="project-score-track">
            <span style={{ width: `${repo.risk}%` }} />
          </span>
        </div>
        <div className="project-severity">
          <div>
            <SeverityBadge severity="critical" compact />
            <strong>{repo.critical}</strong>
          </div>
          <div>
            <SeverityBadge severity="high" compact />
            <strong>{repo.high}</strong>
          </div>
          <div>
            <SeverityBadge severity="medium" compact />
            <strong>{repo.medium}</strong>
          </div>
          <div>
            <SeverityBadge severity="low" compact />
            <strong>{repo.low}</strong>
          </div>
        </div>
      </div>

      <div className="project-meta">
        <span>
          <GitBranch size={13} /> {repo.branch}
        </span>
        <span>
          <Code2 size={13} /> {repo.language || "Unknown"}
        </span>
        <span>{formatLoc(repo.loc)} lines</span>
        <span>{repo.files.toLocaleString()} files</span>
      </div>

      <div className="project-card-foot">
        <span className="project-last-scan">
          <RefreshCw size={13} /> {scanning ? "Scan in progress" : `Scanned ${relativeTime(repo.lastScanAt)}`}
        </span>
        <div className="project-actions">
          <Button size="sm" variant="ghost" onClick={() => onScan(repo)} disabled={scanning}>
            {scanning ? <Loader2 size={14} className="spin" /> : <ScanSearch size={14} />}
            {scanning ? "Scanning" : "Scan"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onOpen(repo)}>
            Open <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </article>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="project-stat-grid">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="card project-stat" key={index}>
          <Skeleton height={34} width="34px" />
          <Skeleton height={26} width="40%" />
          <Skeleton height={11} width="62%" />
        </div>
      ))}
      {Array.from({ length: 4 }, (_, index) => (
        <div className="card project-card" key={`card-${index}`}>
          <Skeleton height={40} width="40px" />
          <Skeleton height={18} width="52%" />
          <Skeleton rows={3} height={12} />
        </div>
      ))}
    </div>
  );
}

export function Repositories() {
  const navigate = useNavigate();
  const toast = useToast();
  const [repos, setRepos] = useState<ApiRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [provider, setProvider] = useState("github");
  const [repoName, setRepoName] = useState("");
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .repos(controller.signal)
      .then(setRepos)
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [reloadKey]);

  const stats = useMemo(() => {
    const total = repos.length;
    const atRisk = repos.filter((repo) => repo.risk > 40).length;
    const critical = repos.reduce((sum, repo) => sum + repo.critical, 0);
    const lines = repos.reduce((sum, repo) => sum + repo.loc, 0);
    return { total, atRisk, critical, lines };
  }, [repos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repos.filter((repo) => {
      const filterOk =
        filter === "all" ? true : filter === "at-risk" ? repo.risk > 40 : repo.risk <= 40;
      const queryOk = q
        ? `${repo.fullName} ${repo.name} ${repo.org} ${repo.language}`.toLowerCase().includes(q)
        : true;
      return filterOk && queryOk;
    });
  }, [filter, query, repos]);

  const counts = useMemo(
    () => ({
      all: repos.length,
      "at-risk": repos.filter((repo) => repo.risk > 40).length,
      protected: repos.filter((repo) => repo.risk <= 40).length,
    }),
    [repos],
  );

  const scan = async (repo: ApiRepo) => {
    if (scanningId) return;
    setScanningId(repo.id);
    try {
      const queued = await api.scanRepo(repo.id);
      let current = queued;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        if (current.status === "complete" || current.status === "failed") break;
        await wait(850);
        current = await api.scan(queued.id);
      }
      if (current.status === "failed") throw new Error(current.error || "The scan failed.");
      if (current.status !== "complete") {
        toast({
          title: "Scan still running",
          message: "Open the project to follow the scan in real time.",
          tone: "info",
        });
      } else {
        toast({
          title: "Scan complete",
          message: `${repo.fullName} · ${current.findingsTotal} findings · risk ${current.risk}/100.`,
          tone: current.findingsTotal ? "danger" : "success",
        });
      }
      const list = await api.repos();
      setRepos(list);
    } catch (err) {
      toast({ title: "Scan failed", message: errorMessage(err), tone: "danger" });
    } finally {
      setScanningId(null);
    }
  };

  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (connecting) return;
    setConnecting(true);
    setConnectError("");
    try {
      const connected = await api.connectRepo(repoName.trim(), token.trim() || undefined);
      setModalOpen(false);
      setRepoName("");
      setToken("");
      setRepos(await api.repos());
      toast({
        title: "Project connected",
        message: `${connected.fullName} · first scan is starting.`,
        tone: "success",
      });
      navigate(`/projects/${connected.id}`);
    } catch (err) {
      setConnectError(errorMessage(err));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Projects"
        title="Protect the code that matters."
        description="Connect repositories, monitor risk, and move from finding to fix without leaving the workspace."
        actions={
          <>
            <Button icon={<ScanSearch size={16} />} onClick={() => navigate("/scan")}>
              Scan code
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
              Connect project
            </Button>
          </>
        }
      />

      {loading ? (
        <ProjectsSkeleton />
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Projects unavailable"
          description={error}
          action={
            <Button icon={<RefreshCw size={15} />} onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </Button>
          }
        />
      ) : (
        <>
          <section className="project-stat-grid" aria-label="Project summary">
            <article className="card project-stat">
              <span className="project-stat-icon">
                <FolderGit2 size={17} />
              </span>
              <strong>{stats.total}</strong>
              <span>Connected projects</span>
            </article>
            <article className="card project-stat">
              <span className="project-stat-icon is-critical">
                <ShieldAlert size={17} />
              </span>
              <strong>{stats.atRisk}</strong>
              <span>Need attention</span>
            </article>
            <article className="card project-stat">
              <span className="project-stat-icon is-high">
                <ShieldAlert size={17} />
              </span>
              <strong>{stats.critical}</strong>
              <span>Critical findings</span>
            </article>
            <article className="card project-stat">
              <span className="project-stat-icon is-low">
                <Code2 size={17} />
              </span>
              <strong>{formatLoc(stats.lines)}</strong>
              <span>Lines scanned</span>
            </article>
          </section>

          <div className="projects-toolbar card">
            <div className="search-field projects-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects…"
                aria-label="Search projects"
              />
            </div>
            <Tabs
              layoutId="projects-filter"
              tabs={filters.map((entry) => ({
                id: entry.id,
                label: entry.label,
                count: counts[entry.id],
              }))}
              active={filter}
              onChange={(id) => setFilter(id as Filter)}
            />
          </div>

          {repos.length === 0 ? (
            <EmptyState
              icon={FolderGit2}
              title="No projects connected"
              description="Connect a GitHub repository to run a baseline scan and start tracking risk."
              action={
                <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
                  Connect project
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No projects match"
              description="Try a different search or filter."
              action={
                <Button
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <section className="project-grid" aria-label="Projects">
              {filtered.map((repo) => (
                <ProjectCard
                  key={repo.id}
                  repo={repo}
                  scanning={scanningId === repo.id}
                  onScan={(item) => void scan(item)}
                  onOpen={(item) => navigate(`/projects/${item.id}`)}
                />
              ))}
            </section>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!connecting) setModalOpen(false);
        }}
        eyebrow="New project"
        title="Connect a repository"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={connecting}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="connect-project"
              variant="primary"
              loading={connecting}
              icon={<Plus size={15} />}
            >
              Connect and scan
            </Button>
          </>
        }
      >
        <form id="connect-project" className="connect-form" onSubmit={connect}>
          <p className="connect-intro">
            Aegis reads repository contents to run security scans. It never writes to your code.
            The first scan starts automatically.
          </p>

          <div className="provider-grid">
            {providerOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  type="button"
                  key={option.id}
                  className={clsx("provider-option", provider === option.id && "is-selected")}
                  onClick={() => option.available && setProvider(option.id)}
                  disabled={!option.available}
                >
                  <span className="provider-icon">
                    <Icon size={19} />
                  </span>
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </button>
              );
            })}
          </div>

          <Field label="Repository" htmlFor="repo-name" hint="Use the owner/name format, for example octocat/Hello-World.">
            <input
              id="repo-name"
              value={repoName}
              onChange={(event) => setRepoName(event.target.value)}
              placeholder="owner/repository"
              autoComplete="off"
              required
            />
          </Field>

          <Field
            label="Access token"
            htmlFor="repo-token"
            hint="Optional GitHub token for private repositories. Stored encrypted."
          >
            <input
              id="repo-token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="ghp_…"
              autoComplete="off"
            />
          </Field>

          {connectError && (
            <p className="form-alert" role="alert">
              {connectError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}
