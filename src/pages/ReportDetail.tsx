import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileBarChart2,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { SeverityBadge } from "../components/ui/Severity";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/Toaster";
import { api, errorMessage, type ApiReportDetail } from "../lib/api";
import { formatBytes, formatDate } from "../lib/adapters";
import type { Severity } from "../lib/types";

function DetailSkeleton() {
  return (
    <div className="page-stack">
      <Skeleton height={28} width="28%" />
      <div className="report-detail-stats">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="card report-detail-stat" key={index}>
            <Skeleton height={22} width="40%" />
            <Skeleton height={12} width="64%" />
          </div>
        ))}
      </div>
      <div className="card report-detail-body">
        <Skeleton height={18} width="30%" />
        <Skeleton rows={8} height={12} />
      </div>
    </div>
  );
}

export function ReportDetail() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [report, setReport] = useState<ApiReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<"all" | Severity>("all");

  useEffect(() => {
    if (!reportId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .report(reportId, controller.signal)
      .then(setReport)
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [reportId, reloadKey]);

  const findings = Array.isArray(report?.findings) ? report.findings : report?.summary?.findings ?? [];
  const counts = useMemo(
    () => {
      const list = Array.isArray(findings) ? findings : [];
      return list.reduce(
        (result, finding: any) => {
          const sev = (finding.severity as Severity);
          result[sev] = (result[sev] ?? 0) + 1;
          return result;
        },
        { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<Severity, number>,
      );
    },
    [findings],
  );
  const filtered = useMemo(() => {
    const list = Array.isArray(findings) ? findings : [];
    return filter === "all" ? list : list.filter((finding: any) => finding.severity === filter);
  }, [filter, findings]);

  const download = async () => {
    if (!report) return;
    try {
      await api.downloadReport(report.id, `${report.name.replace(/[^a-z0-9]+/gi, "-")}.json`);
      toast({ title: "Download started", message: report.name, tone: "success" });
    } catch (err) {
      toast({ title: "Download failed", message: errorMessage(err), tone: "danger" });
    }
  };

  const remove = async () => {
    if (!report || deleting) return;
    setDeleting(true);
    try {
      await api.deleteReport(report.id);
      toast({ title: "Report deleted", message: report.name, tone: "success" });
      navigate("/reports");
    } catch (err) {
      toast({ title: "Could not delete report", message: errorMessage(err), tone: "danger" });
      setDeleting(false);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (error || !report) {
    return (
      <div className="page-stack">
        <PageHeader breadcrumbs={[{ label: "Reports", to: "/reports" }, { label: "Report" }]} title="Report unavailable" />
        <EmptyState
          icon={AlertTriangle}
          title="Could not load report"
          description={error || "This report does not exist or is not available."}
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
        breadcrumbs={[{ label: "Reports", to: "/reports" }, { label: report.name }]}
        eyebrow={<><FileBarChart2 size={13} /> {report.kind.replace("_", " ")}</>}
        title={report.name}
        description={`Scope: ${report.scope}. Generated ${formatDate(report.generatedAt ?? report.createdAt)} · ${formatBytes(report.sizeBytes)}`}
        actions={
          <>
            <Button icon={<ArrowLeft size={16} />} onClick={() => navigate("/reports")}>
              Back to reports
            </Button>
            <Button icon={<Download size={16} />} onClick={() => void download()} disabled={report.status !== "ready"}>
              Download JSON
            </Button>
            <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </>
        }
      />

      <section className="report-detail-stats">
        <article className="card report-detail-stat">
          <span className="report-detail-stat-value">{report.findings}</span>
          <span className="report-detail-stat-label">Total findings</span>
        </article>
        <article className="card report-detail-stat">
          <span className="report-detail-stat-value">{counts.critical}</span>
          <span className="report-detail-stat-label">Critical</span>
        </article>
        <article className="card report-detail-stat">
          <span className="report-detail-stat-value">{counts.high}</span>
          <span className="report-detail-stat-label">High</span>
        </article>
        <article className="card report-detail-stat">
          <span className="report-detail-stat-value">{report.status}</span>
          <span className="report-detail-stat-label">Status</span>
        </article>
      </section>

      <article className="card report-detail-body">
        <div className="card-head compact">
          <div>
            <div className="card-eyebrow">
              <ShieldAlert size={14} /> Findings
            </div>
            <h2>Included issues</h2>
          </div>
        </div>

        {(Array.isArray(findings) ? findings.length : 0) === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No findings in this report"
            description="The report was created but no findings were present in the selected scan scope."
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

            <div className="report-finding-table">
              <div className="report-finding-table-head">
                <span>Issue</span>
                <span>Location</span>
                <span>Category</span>
                <span>Severity</span>
                <span>CWE</span>
              </div>
              {filtered.map((finding) => (
                <div className="report-finding-row" key={finding.id}>
                  <div className="report-finding-title">
                    <strong>{finding.title}</strong>
                    <span>{finding.description.slice(0, 110)}</span>
                  </div>
                  <span className="report-finding-loc">
                    {finding.filePath || "—"} {finding.line > 0 ? `:${finding.line}` : ""}
                  </span>
                  <span className="report-finding-cat">{finding.category}</span>
                  <span><SeverityBadge severity={finding.severity as Severity} compact /></span>
                  <span className="mono">{finding.cwe}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="report-remediation">
          <h3>Remediation guidance</h3>
          <p>
            Open each project to apply fixes and re-scan. Reports capture the state at generation time and
            do not auto-update when findings change.
          </p>
          <Button icon={<RefreshCw size={15} />} onClick={() => navigate("/repositories")}>
            Go to projects
          </Button>
        </div>
      </article>

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        eyebrow="Destructive action"
        title="Delete this report?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} icon={<Trash2 size={15} />} onClick={() => void remove()}>
              Delete report
            </Button>
          </>
        }
      >
        <p className="modal-copy">This deletes <strong>{report.name}</strong>. This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
