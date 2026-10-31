import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileBarChart2,
  FileJson,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toaster";
import { api, errorMessage, type ApiReport } from "../lib/api";
import { formatDate, formatBytes } from "../lib/adapters";
import { useNavigate } from "react-router-dom";

const kinds = [
  { id: "posture", label: "Security posture" },
  { id: "compliance", label: "Compliance evidence" },
  { id: "deep_review", label: "Deep review summary" },
  { id: "dependency", label: "Dependency focus" },
  { id: "custom", label: "Custom report" },
] as const;

type KindId = (typeof kinds)[number]["id"];

function ReportsSkeleton() {
  return (
    <div className="page-stack">
      <div className="report-stat-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="card report-stat" key={index}>
            <Skeleton height={34} width="34px" />
            <Skeleton height={28} width="32%" />
            <Skeleton height={11} width="58%" />
          </div>
        ))}
      </div>
      <div className="card report-generator">
        <Skeleton height={18} width="26%" />
        <Skeleton rows={4} height={14} />
      </div>
    </div>
  );
}

export function Reports() {
  const navigate = useNavigate();
  const toast = useToast();
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [scopeOptions, setScopeOptions] = useState<string[]>(["All repositories"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [scope, setScope] = useState("All repositories");
  const [kind, setKind] = useState<KindId>("posture");
  const [name, setName] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([api.reports(controller.signal), api.repos(controller.signal)])
      .then(([reportList, repoList]) => {
        setReports(reportList);
        setScopeOptions(["All repositories", ...repoList.map((repo) => repo.fullName)]);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [reloadKey]);

  const totals = useMemo(
    () => ({
      reports: reports.length,
      findings: reports.reduce((sum, report) => sum + report.findings, 0),
      critical: reports.reduce((sum, report) => sum + report.critical, 0),
    }),
    [reports],
  );

  const suggestedName = useMemo(() => {
    const label = kinds.find((entry) => entry.id === kind)?.label ?? "Report";
    return `${label} — ${formatDate(new Date().toISOString())}`;
  }, [kind]);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const created = await api.createReport({
        name: (name || suggestedName).trim(),
        scope,
        kind,
      });
      setReports((current) => [created, ...current]);
      setName("");
      toast({
        title: "Report ready",
        message: `${created.findings} findings · ${formatBytes(created.sizeBytes)} JSON download.`,
        tone: "success",
      });
    } catch (err) {
      toast({ title: "Report creation failed", message: errorMessage(err), tone: "danger" });
    } finally {
      setGenerating(false);
    }
  };

  const download = async (report: ApiReport) => {
    try {
      await api.downloadReport(report.id, `${report.name.replace(/[^a-z0-9]+/gi, "-")}.json`);
      toast({ title: "Download started", message: report.name, tone: "success" });
    } catch (err) {
      toast({ title: "Download failed", message: errorMessage(err), tone: "danger" });
    }
  };

  const remove = async (report: ApiReport) => {
    try {
      await api.deleteReport(report.id);
      setReports((current) => current.filter((entry) => entry.id !== report.id));
      toast({ title: "Report deleted", message: report.name, tone: "success" });
    } catch (err) {
      toast({ title: "Could not delete report", message: errorMessage(err), tone: "danger" });
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Reports"
        title="Share evidence without losing context."
        description="Generate JSON reports from the latest scan data. Open the detail view to see findings, severity, and remediation context."
        actions={
          <Button icon={<RefreshCw size={16} />} onClick={() => setReloadKey((key) => key + 1)}>
            Refresh
          </Button>
        }
      />

      {loading ? (
        <ReportsSkeleton />
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Reports unavailable"
          description={error}
          action={
            <Button icon={<RefreshCw size={15} />} onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </Button>
          }
        />
      ) : (
        <>
          <section className="report-stat-grid" aria-label="Report summary">
            <article className="card report-stat">
              <span className="report-stat-icon">
                <FileBarChart2 size={18} />
              </span>
              <strong>{totals.reports}</strong>
              <span>Reports</span>
            </article>
            <article className="card report-stat">
              <span className="report-stat-icon is-high">
                <ShieldAlert size={18} />
              </span>
              <strong>{totals.findings}</strong>
              <span>Findings recorded</span>
            </article>
            <article className="card report-stat">
              <span className="report-stat-icon is-critical">
                <ShieldAlert size={18} />
              </span>
              <strong>{totals.critical}</strong>
              <span>Critical findings</span>
            </article>
          </section>

          <article className="card report-generator">
            <div className="card-head compact">
              <div>
                <div className="card-eyebrow">
                  <FileJson size={14} /> New report
                </div>
                <h2>Generate a report</h2>
                <p className="card-sub">Use the most recent completed scans for the selected scope.</p>
              </div>
            </div>

            <div className="report-generator-body">
              <div className="report-generator-grid">
                <label className="field">
                  <span>Report name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={suggestedName}
                    spellCheck={false}
                  />
                </label>
                <label className="field">
                  <span>Scope</span>
                  <select value={scope} onChange={(event) => setScope(event.target.value)}>
                    {scopeOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Purpose</span>
                  <select value={kind} onChange={(event) => setKind(event.target.value as KindId)}>
                    {kinds.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="report-generator-foot">
                <div className="report-generator-note">
                  <ShieldCheck size={14} />
                  <span>Reports are generated from real scan findings and stored as JSON.</span>
                </div>
                <Button
                  variant="primary"
                  loading={generating}
                  icon={<Plus size={15} />}
                  onClick={() => void generate()}
                >
                  Create report
                </Button>
              </div>
            </div>
          </article>

          <article className="card report-list-card">
            <div className="card-head compact">
              <div>
                <div className="card-eyebrow">
                  <FileBarChart2 size={14} /> Saved reports
                </div>
                <h2>All reports</h2>
              </div>
            </div>

            {reports.length === 0 ? (
              <EmptyState
                icon={FileJson}
                title="No reports yet"
                description="Create your first report to export a shareable JSON summary."
                className="dash-inline-empty"
              />
            ) : (
              <div className="report-table">
                <div className="report-table-head">
                  <span>Name</span>
                  <span>Scope</span>
                  <span>Kind</span>
                  <span>Findings</span>
                  <span>Created</span>
                  <span>Size</span>
                  <span />
                </div>
                {reports.map((report) => (
                  <div className="report-row" key={report.id}>
                    <button type="button" className="report-name-cell" onClick={() => navigate(`/reports/${report.id}`)}>
                      <span className="report-file-icon">
                        <FileBarChart2 size={16} />
                      </span>
                      <span className="report-name-copy">
                        <strong>{report.name}</strong>
                        <span>{report.status}</span>
                      </span>
                    </button>
                    <span className="report-scope-cell">{report.scope}</span>
                    <span className="report-kind-cell">{report.kind.replace("_", " ")}</span>
                    <span className="report-findings-cell">
                      {report.findings}
                      {report.critical > 0 && <span className="critical-pill">{report.critical} critical</span>}
                    </span>
                    <span className="report-date-cell">{formatDate(report.generatedAt ?? report.createdAt)}</span>
                    <span className="report-size-cell">{formatBytes(report.sizeBytes)}</span>
                    <span className="report-actions-cell">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Download size={14} />}
                        disabled={report.status !== "ready"}
                        onClick={(event) => {
                          event.stopPropagation();
                          void download(report);
                        }}
                      >
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 size={14} />}
                        onClick={(event) => {
                          event.stopPropagation();
                          void remove(report);
                        }}
                      >
                        Delete
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </>
      )}
    </div>
  );
}
