import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Download,
  FileBarChart2,
  FileJson,
  FileSpreadsheet,
  Pause,
  Play,
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
import { LoadingSwap } from "../components/ui/LoadingSwap";
import { useToast } from "../components/ui/Toaster";
import {
  api,
  errorMessage,
  type ApiReport,
  type ApiReportSchedule,
  type ApiReportTrendPoint,
} from "../lib/api";
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
  const [trends, setTrends] = useState<ApiReportTrendPoint[]>([]);
  const [schedules, setSchedules] = useState<ApiReportSchedule[]>([]);
  const [intervalHours, setIntervalHours] = useState(168);
  const [scheduling, setScheduling] = useState(false);
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
    Promise.all([
      api.reports(controller.signal),
      api.repos(controller.signal),
      api.reportTrends(controller.signal),
      api.reportSchedules(controller.signal),
    ])
      .then(([reportList, repoList, trendList, scheduleList]) => {
        setReports(reportList);
        setScopeOptions(["All repositories", ...repoList.map((repo) => repo.fullName)]);
        setTrends(trendList);
        setSchedules(scheduleList);
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

  const exportReport = async (report: ApiReport, format: "csv" | "html") => {
    try {
      await api.exportReport(report.id, `${report.name.replace(/[^a-z0-9]+/gi, "-")}.${format}`, format);
      toast({ title: "Export started", message: `${report.name} · ${format.toUpperCase()}`, tone: "success" });
    } catch (err) {
      toast({ title: "Export failed", message: errorMessage(err), tone: "danger" });
    }
  };

  const scheduleReport = async () => {
    if (scheduling) return;
    setScheduling(true);
    try {
      const created = await api.createReportSchedule({
        name: (name || suggestedName).trim(),
        scope,
        kind,
        intervalHours,
      });
      setSchedules((current) => [created, ...current]);
      setName("");
      toast({ title: "Schedule created", message: created.name, tone: "success" });
    } catch (err) {
      toast({ title: "Schedule failed", message: errorMessage(err), tone: "danger" });
    } finally {
      setScheduling(false);
    }
  };

  const toggleSchedule = async (schedule: ApiReportSchedule) => {
    try {
      const updated = await api.toggleReportSchedule(schedule.id, !schedule.active);
      setSchedules((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (err) {
      toast({ title: "Schedule update failed", message: errorMessage(err), tone: "danger" });
    }
  };

  const removeSchedule = async (schedule: ApiReportSchedule) => {
    try {
      await api.deleteReportSchedule(schedule.id);
      setSchedules((current) => current.filter((entry) => entry.id !== schedule.id));
    } catch (err) {
      toast({ title: "Schedule delete failed", message: errorMessage(err), tone: "danger" });
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
          <Button
            icon={<RefreshCw size={16} />}
            loading={loading}
            onClick={() => setReloadKey((key) => key + 1)}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      <LoadingSwap loading={loading} skeleton={<ReportsSkeleton />}>
        {error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Reports unavailable"
            description={error}
            action={
              <Button
                icon={<RefreshCw size={15} />}
                loading={loading}
                onClick={() => setReloadKey((key) => key + 1)}
              >
                {loading ? "Refreshing..." : "Try again"}
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

          <section className="report-insight-grid">
            <article className="card report-trend-card">
              <div className="card-head compact">
                <div>
                  <div className="card-eyebrow"><CalendarClock size={14} /> Risk history</div>
                  <h2>Risk trend</h2>
                  <p className="card-sub">Latest completed scans across your repositories.</p>
                </div>
              </div>
              {trends.length === 0 ? (
                <div className="report-trend-empty">No completed scans yet.</div>
              ) : (
                <div className="report-trend-chart">
                  {trends.map((point, index) => {
                    const height = Math.max(6, Math.min(100, 100 - point.risk));
                    return (
                      <span
                        key={`${point.completedAt}-${index}`}
                        title={`${formatDate(point.completedAt)} · risk ${point.risk} · ${point.findings} findings`}
                      >
                        <i style={{ height: `${height}%` }} />
                      </span>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="card report-schedule-card">
              <div className="card-head compact">
                <div>
                  <div className="card-eyebrow"><CalendarClock size={14} /> Delivery</div>
                  <h2>Scheduled reports</h2>
                  <p className="card-sub">Generate fresh evidence automatically.</p>
                </div>
              </div>
              <div className="report-schedule-form">
                <label className="field">
                  <span>Repeat</span>
                  <select value={intervalHours} onChange={(event) => setIntervalHours(Number(event.target.value))}>
                    <option value={24}>Daily</option>
                    <option value={168}>Weekly</option>
                    <option value={720}>Monthly</option>
                  </select>
                </label>
                <Button
                  variant="primary"
                  loading={scheduling}
                  icon={<Plus size={15} />}
                  onClick={() => void scheduleReport()}
                >
                  Schedule
                </Button>
              </div>
              <div className="report-schedule-list">
                {schedules.length === 0 ? (
                  <span className="report-trend-empty">No schedules configured.</span>
                ) : (
                  schedules.map((schedule) => (
                    <div className="report-schedule-row" key={schedule.id}>
                      <span>
                        <strong>{schedule.name}</strong>
                        <small>{schedule.intervalHours}h · {formatDate(schedule.nextRunAt)}</small>
                      </span>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => void toggleSchedule(schedule)}
                        aria-label={schedule.active ? "Pause schedule" : "Resume schedule"}
                      >
                        {schedule.active ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => void removeSchedule(schedule)}
                        aria-label="Delete schedule"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
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
                        icon={<FileSpreadsheet size={14} />}
                        disabled={report.status !== "ready"}
                        onClick={(event) => {
                          event.stopPropagation();
                          void exportReport(report, "csv");
                        }}
                      >
                        CSV
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<FileJson size={14} />}
                        disabled={report.status !== "ready"}
                        onClick={(event) => {
                          event.stopPropagation();
                          void exportReport(report, "html");
                        }}
                      >
                        HTML
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
      </LoadingSwap>
    </div>
  );
}
