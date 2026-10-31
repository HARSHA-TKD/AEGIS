export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type ScanState = "idle" | "scanning" | "complete";

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  cwe: string;
  line: number;
  snippet: string;
  filePath?: string;
  description: string;
  impact: string;
  fix: string;
  confidence: number;
  tags: string[];
}

export interface Vulnerability {
  id: string;
  cve: string;
  title: string;
  summary: string;
  severity: Severity;
  cvss: number;
  epss: number;
  exploited: boolean;
  published: string;
  ecosystem: string;
  package: string;
  affected: string;
  fixVersion: string;
  tags: string[];
  cwe: string;
}

export interface Repo {
  id: string;
  name: string;
  org: string;
  language: string;
  branch: string;
  risk: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  lastScan: string;
  status: "protected" | "at-risk" | "scanning";
  loc: string;
}

export interface Report {
  id: string;
  name: string;
  scope: string;
  date: string;
  findings: number;
  critical: number;
  status: "ready" | "generating";
  size: string;
}

export interface FeedItem {
  id: string;
  kind: "scan" | "fix" | "intel" | "alert";
  title: string;
  detail: string;
  time: string;
}
