import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import {
  AlertTriangle,
  ChevronDown,
  Clock3,
  Code2,
  FileCode2,
  GitBranch,
  Github,
  Loader2,
  Play,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { SeverityBadge } from "../components/ui/Severity";
import { ProgressRing } from "../components/ui/ProgressRing";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/Toaster";
import { api, errorMessage, type ApiFinding, type ApiRepo, type ApiScan } from "../lib/api";
import { formatDate, formatLoc, relativeTime } from "../lib/adapters";
import { gradeFor } from "../lib/scanner";
import type { Severity } from "../lib/types";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const activeStatuses = new Set(["queued", "running", "pending"]);

function DetailSkeleton() {
  return (
    <div className="page-stack">
      <Skeleton height={30} width="32%" />
      <div className="project-detail-hero">
        <div className="card project-risk-card">
          <Skeleton height={120} width="120px" />
          <Skeleton rows={3} height={12} />
        </div>
        <div className="card project-info-card">
          <Skeleton height={18} width="42%" />
          <Skeleton rows={5} height={12} />
        </div>
      </div>
      <div className="card project-findings-card">
        <Skeleton height={18} width="28%" />
        <Skeleton rows={6} height={14} />
      </div>
    </div>
  );
}

export function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [repo, setRepo] = useState<ApiRepo | null>(null);
  const [scans, setScans] = useState<ApiScan[]>([]);
  const [findings, setFindings] = useState<ApiFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");
  const [scanError, setScanError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<"all" | Severity>("all");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      setScanError("");
      try {
        const [project, scanList] = await Promise.all([
          api.repo(projectId, controller.signal),
          api.scans(projectId, controller.signal),
        ]);
        if (cancelled) return;
        setRepo(project);
        setScans(scanList);

        let latest = scanList[0];
        if (latest && activeStatuses.has(latest.status)) {
          setPolling(true);
          for (let attempt = 0; attempt < 90; attempt += 1) {
            await wait(1000);
            if (cancelled) return;
            latest = await api.scan(latest.id, controller.signal);
            setScans((current) => current.map((scan) => (scan.id === latest.id ? latest : scan)));
            if (!activeStatuses.has(latest.status)) break;
          }
          const [updatedProject, updatedScans] = await Promise.all([
            api.repo(projectId, controller.signal),
            api.scans(projectId, controller.signal),
          ]);
          if (cancelled) return;
          setRepo(updatedProject);
          setScans(updatedScans);
        }

        if (latest?.status === "complete") {
          const latestFindings = await api.scanFindings(latest.id, controller.signal);
          if (!cancelled) setFindings(latestFindings);
        } else {
          setFindings([]);
        }
        if (latest?.status === "failed") {
          setScanError(latest.error || "The most recent scan failed.");
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError" && !cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setPolling(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, reloadKey]);

  const counts = useMemo(
    () =>
      findings.reduce(
        (result, finding) => {
          result[finding.severity as Severity] = (result[finding.severity as Severity] ?? 0) + 1;
          return result;
        },
        { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<Severity, number>,
      ),
    [findings],
  );

  const filtered = useMemo(
    () => (filter === "all" ? findings : findings.filter((finding) => finding.severity === filter)),
    [filter, findings],
  );

  const latestScan = scans[0];
  const grade = gradeFor(repo?.risk ?? 0);
  const running = polling || Boolean(latestScan && activeStatuses.has(latestScan.status));

  const startScan = async () => {
    if (!projectId || running) return;
    setPolling(true);
    setScanError("");
    try {
      const queued = await api.scanRepo(projectId);
      setScans((current) => [queued, ...current]);
      let current = queued;
      for (let attempt = 0; attempt < 90; attempt += 1) {
        if (!activeStatuses.has(current.status)) break;
        await wait(1000);
        current = await api.scan(queued.id);
        setScans((list) => list.map((scan) => (scan.id === current.id ? current : scan)));
      }
      if (current.status === "complete") {
        toast({
          title: "Scan complete",
          message: `${current.findingsTotal} findings · risk ${current.risk}/100.`,
          tone: current.findingsTotal ? "danger" : "success",
        });
        setReloadKey((key) => key + 1);
      } else if (current.status === "failed") {
        setScanError(current.error || "The scan failed.");
        toast({ title: "Scan failed", message: current.error || "The scan failed.", tone: "danger" });
      } else {
        toast({
          title: "Scan still running",
          message: "Aegis will keep the latest status visible here.",
          tone: "info",
        });
      }
    } catch (err) {
      setScanError(errorMessage(err));
      toast({ title: "Scan failed", message: errorMessage(err), tone: "danger" });
    } finally {
      setPolling(false);
    }
  };

  const remove = async () => {
    if (!projectId || deleting) return;
    setDeleting(true);
    try {
      await api.deleteRepo(projectId);
      toast({ title: "Project removed", message: "The repository and its scan history were deleted.", tone: "success" });
      navigate("/repositories");
    } catch (err) {
      toast({ title: "Could not delete project", message: errorMessage(err), tone: "danger" });
      setDeleting(false);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (error || !repo) {
    return (
      <div className="page-stack">
        <PageHeader breadcrumbs={[{ label: "Projects", to: "/repositories" }, { label: "Project" }]} title="Project unavailable" />
        <EmptyState
          icon={AlertTriangle}
          title="Could not load project"
          description={error || "This project does not exist or is not available."}
          action={
            <Button icon={<RefreshCw size={15} />} onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        breadcrumbs={[{ label: "Projects", to: "/repositories" }, { label: repo.name }]}
        eyebrow={<><Github size={13} /> {repo.fullName}</>}
        title={repo.name}
        description={`${repo.provider} repository on ${repo.branch}. Risk and findings reflect the most recent completed scan.`}
        actions={
          <>
            <Button
              variant="primary"
              icon={running ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
              onClick={() => void startScan()}
              disabled={running}
            >
              {running ? "Scanning" : "Scan now"}
            </Button>
            <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </>
        }
      />

      <section className="project-detail-hero">
        <article className={clsx("card project-risk-card", `risk-${grade.tone}`)}>
          <div className="project-risk-main">
            <ProgressRing
              value={repo.risk}
              size={148}
              stroke={11}
              tone={repo.risk > 70 ? "critical" : repo.risk > 40 ? "high" : "low"}
              label={String(repo.risk)}
              sublabel="risk score"
            />
            <div className="project-risk-copy">
              <span className={clsx("pill", repo.risk > 40 ? "pill-rose" : "pill-mint")}>
                {repo.risk > 40 ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                {repo.status === "scanning" ? "Scanning" : repo.risk > 40 ? "Needs attention" : "Looking good"}
              </span>
              <h2>{grade.label}</h2>
              <p>
                {repo.risk > 70
                  ? "Prioritize critical and reachable findings before the next release."
                  : repo.risk > 40
                    ? "Plan remediation for the highest severity findings."
                    : "No urgent issues are currently reflected in the latest scan."}
              </p>
              <span className="project-risk-meta">
                <Clock3 size={13} /> Last scan {relativeTime(repo.lastScanAt)}
              </span>
            </div>
          </div>
          <div className="project-severity project-severity-wide">
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
        </article>

        <article className="card project-info-card">
          <div className="card-head compact">
            <div>
              <div className="card-eyebrow">
                <Code2 size={14} /> Project details
              </div>
              <h2>Repository metadata</h2>
            </div>
          </div>
          <dl className="project-meta-list">
            <div>
              <dt>Provider</dt>
              <dd><Github size={13} /> GitHub</dd>
            </div>
            <div>
              <dt>Default branch</dt>
              <dd><GitBranch size={13} /> {repo.branch}</dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>{repo.language || "Unknown"}</dd>
            </div>
            <div>
              <dt>Files scanned</dt>
              <dd>{repo.files.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Lines of code</dt>
              <dd>{formatLoc(repo.loc)}</dd>
            </div>
            <div>
              <dt>Connected</dt>
              <dd>{formatDate(repo.createdAt)}</dd>
            </div>
          </dl>
        </article>
      </section>

      {scanError && (
        <div className="scan-alert" role="alert">
          <ShieldAlert size={16} /> {scanError}
        </div>
      )}

      <section className="project-detail-main">
        <article className="card project-findings-card">
          <div className="card-head compact">
            <div>
              <div className="card-eyebrow">
                <FileCode2 size={14} /> Latest findings
              </div>
              <h2>
                {latestScan ? `Scan from ${relativeTime(latestScan.createdAt)}` : "No completed scan yet"}
              </h2>
            </div>
            {latestScan?.status === "complete" && (
              <span className="pill">{findings.length} findings</span>
            )}
          </div>

          {running ? (
            <div className="project-scan-progress">
              <Loader2 size={22} className="spin" />
              <div>
                <strong>Scan in progress</strong>
                <span>Findings will appear when the scan completes.</span>
              </div>
              <div className="scan-track is-indeterminate">
                <span />
              </div>
            </div>
          ) : !latestScan || latestScan.status !== "complete" ? (
            <EmptyState
              icon={ScanSearch}
              title="No completed scan"
              description="Run the first scan to see findings, severity counts, and remediation guidance."
              action={
                <Button variant="primary" icon={<Play size={15} />} onClick={() => void startScan()}>
                  Run scan
                </Button>
              }
              className="dash-inline-empty"
            />
          ) : findings.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No findings in this scan"
              description="The active rules did not match anything in the scanned files."
              className="dash-inline-empty"
            />
          ) : (
            <>
              <div className="finding-filters" role="group" aria-label="Filter findings by severity">
                <button
                  type="button"
                  className={clsx("filter-pill", filter === "all" && "is-active")}
                  onClick={() => setFilter("all")}
                >
                  All <span>{findings.length}</span>
                </button>
                {(["critical", "high", "medium", "low"] as Severity[])
                  .filter((severity) => counts[severity] > 0)
                  .map((severity) => (
                    <button
                      type="button"
                      key={severity}
                      className={clsx("filter-pill", `filter-${severity}`, filter === severity && "is-active")}
                      onClick={() => setFilter(severity)}
                    >
                      {severity} <span>{counts[severity]}</span>
                    </button>
                  ))}
              </div>

              <div className="project-finding-list">
                {filtered.map((finding) => (
                  <details className="project-finding" key={finding.id}>
                    <summary>
                      <SeverityBadge severity={finding.severity as Severity} compact />
                      <span className="project-finding-copy">
                        <strong>{finding.title}</strong>
                        <span>
                          {finding.filePath || "repository"} · line {finding.line} · {finding.category}
                        </span>
                      </span>
                      <span className="tag">{finding.cwe}</span>
                      <ChevronDown size={15} className="project-finding-chev" />
                    </summary>
                    <div className="project-finding-body">
                      <div>
                        <span>Description</span>
                        <p>{finding.description}</p>
                      </div>
                      <div>
                        <span>Why it matters</span>
                        <p>{finding.impact}</p>
                      </div>
                      <div className="is-fix">
                        <span>How to fix</span>
                        <p>{finding.fix}</p>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </>
          )}
        </article>

        <aside className="card project-history-card">
          <div className="card-head compact">
            <div>
              <div className="card-eyebrow">
                <Clock3 size={14} /> Scan history
              </div>
              <h2>Recent scans</h2>
            </div>
          </div>
          {scans.length ? (
            <div className="project-scan-list">
              {scans.slice(0, 10).map((scan) => (
                <div className="project-scan-row" key={scan.id}>
                  <span className={clsx("project-scan-dot", `is-${scan.status}`)} />
                  <div className="project-scan-copy">
                    <strong>{relativeTime(scan.completedAt ?? scan.createdAt)}</strong>
                    <span>{scan.commitSha ? scan.commitSha.slice(0, 7) : `${scan.filesScanned} files`}</span>
                  </div>
                  <span className="project-scan-metrics">
                    <span>{scan.findingsTotal} findings</span>
                    <span>risk {scan.risk}</span>
                  </span>
                  <span className="pill">{scan.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dash-empty-note">No scans recorded yet.</p>
          )}
        </aside>
      </section>

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        eyebrow="Destructive action"
        title="Delete this project?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} icon={<Trash2 size={15} />} onClick={() => void remove()}>
              Delete project
            </Button>
          </>
        }
      >
        <p className="modal-copy">
          This removes <strong>{repo.fullName}</strong>, its scan history, and all stored findings.
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
