import type {
  ApiFeedItem,
  ApiFinding,
  ApiRepo,
  ApiReport,
  ApiScannerFinding,
  ApiVulnerability,
} from "./api";
import type { FeedItem, Finding, Repo, Report, Severity, Vulnerability } from "./types";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

export function toSeverity(value: string): Severity {
  return (SEVERITIES as string[]).includes(value) ? (value as Severity) : "info";
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "never";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatLoc(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

export function formatBytes(value: number): string {
  if (!value) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} KB`;
  return `${value} B`;
}

export function toRepo(repo: ApiRepo): Repo {
  const scanning = repo.status === "scanning" || repo.status === "queued";
  return {
    id: repo.id,
    name: repo.name,
    org: repo.org,
    language: repo.language || "Unknown",
    branch: repo.branch,
    risk: repo.risk,
    critical: repo.critical,
    high: repo.high,
    medium: repo.medium,
    low: repo.low,
    lastScan: relativeTime(repo.lastScanAt),
    status: scanning ? "scanning" : repo.risk > 40 ? "at-risk" : "protected",
    loc: formatLoc(repo.loc),
  };
}

export function toFinding(finding: ApiFinding): Finding {
  return {
    id: finding.id,
    title: finding.title,
    severity: toSeverity(finding.severity),
    category: finding.category,
    cwe: finding.cwe,
    line: finding.line,
    snippet: finding.snippet,
    filePath: finding.filePath,
    description: finding.description,
    impact: finding.impact,
    fix: finding.fix,
    confidence: finding.confidence,
    tags: finding.tags,
  };
}

export function toScannerFinding(finding: ApiScannerFinding, index: number): Finding {
  return {
    id: `${finding.ruleId}-${finding.line}-${index}`,
    title: finding.title,
    severity: toSeverity(finding.severity),
    category: finding.category,
    cwe: finding.cwe,
    line: finding.line,
    snippet: finding.snippet,
    filePath: finding.filePath,
    description: finding.description,
    impact: finding.impact,
    fix: finding.fix,
    confidence: finding.confidence,
    tags: finding.tags,
  };
}

export function toVulnerability(vuln: ApiVulnerability): Vulnerability {
  return {
    id: vuln.id,
    cve: vuln.cve,
    title: vuln.title,
    summary: vuln.summary,
    severity: toSeverity(vuln.severity),
    cvss: vuln.cvss,
    epss: vuln.epss,
    exploited: vuln.exploited,
    published: vuln.published ? vuln.published.slice(0, 10) : "",
    ecosystem: vuln.ecosystem,
    package: vuln.package,
    affected: vuln.affected,
    fixVersion: vuln.fixVersion,
    tags: vuln.tags,
    cwe: vuln.cwe,
  };
}

export function toReport(report: ApiReport): Report {
  return {
    id: report.id,
    name: report.name,
    scope: report.scope,
    date: formatDate(report.generatedAt ?? report.createdAt),
    findings: report.findings,
    critical: report.critical,
    status: report.status === "ready" ? "ready" : "generating",
    size: formatBytes(report.sizeBytes),
  };
}

const FEED_KINDS = ["scan", "fix", "intel", "alert"] as const;

export function toFeedItem(item: ApiFeedItem): FeedItem {
  const kind = (FEED_KINDS as readonly string[]).includes(item.kind)
    ? (item.kind as FeedItem["kind"])
    : "alert";
  return {
    id: item.id,
    kind,
    title: item.title,
    detail: item.detail,
    time: relativeTime(item.createdAt),
  };
}
