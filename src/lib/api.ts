import { clearSession, getToken } from "./auth";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

function detailFrom(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  if (Array.isArray(record.detail)) {
    return record.detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : String(item),
      )
      .join(", ");
  }
  return "";
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError("Unable to reach the Aegis API. Is the backend running?", 0);
  }

  if (response.status === 401 && auth) {
    clearSession();
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw new ApiError(
      detailFrom(payload) || `Request failed with status ${response.status}.`,
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface ApiTokenResponse {
  accessToken: string;
  tokenType: string;
  user: ApiUser;
}

export interface ApiForgotPasswordResponse {
  detail: string;
  resetToken: string | null;
}

export interface ApiSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  current: boolean;
}

export interface ApiRepo {
  id: string;
  provider: string;
  fullName: string;
  name: string;
  org: string;
  language: string;
  branch: string;
  risk: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  loc: number;
  files: number;
  status: string;
  lastScanAt: string | null;
  createdAt: string;
}

export interface ApiScan {
  id: string;
  repositoryId: string;
  status: string;
  commitSha: string | null;
  filesScanned: number;
  loc: number;
  risk: number;
  findingsTotal: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ApiFinding {
  id: string;
  scanId: string;
  repositoryId: string;
  ruleId: string;
  title: string;
  severity: string;
  category: string;
  cwe: string;
  filePath: string;
  line: number;
  snippet: string;
  description: string;
  impact: string;
  fix: string;
  confidence: number;
  tags: string[];
  status: string;
  createdAt: string;
}

export interface ApiScannerFinding {
  ruleId: string;
  title: string;
  severity: string;
  category: string;
  cwe: string;
  filePath: string;
  line: number;
  snippet: string;
  description: string;
  impact: string;
  fix: string;
  confidence: number;
  tags: string[];
}

export interface ApiAnalyzeResponse {
  findings: ApiScannerFinding[];
  risk: number;
  grade: { grade: string; label: string; tone: string };
}

export interface ApiVulnerability {
  id: string;
  cve: string;
  title: string;
  summary: string;
  severity: string;
  cvss: number;
  epss: number;
  exploited: boolean;
  published: string | null;
  ecosystem: string;
  package: string;
  affected: string;
  fixVersion: string;
  tags: string[];
  cwe: string;
}

export interface ApiReport {
  id: string;
  name: string;
  scope: string;
  kind: string;
  status: string;
  findings: number;
  critical: number;
  sizeBytes: number;
  createdAt: string;
  generatedAt: string | null;
}

export interface ApiReportSummaryFinding {
  id: string;
  title: string;
  severity: string;
  category: string;
  cwe: string;
  repository: string;
  filePath: string;
  line: number;
  confidence: number;
}

export interface ApiReportDetail extends ApiReport {
  summary: {
    report: { name: string; scope: string; kind: string; generatedAt: string };
    totals: { repositories: number; findings: number; critical: number; high: number; medium: number; low: number };
    severity: Record<string, number>;
    categories: { category: string; count: number }[];
    repositories: {
      id: string;
      fullName: string;
      language: string;
      branch: string;
      risk: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      lastScanAt: string | null;
    }[];
    findings: ApiReportSummaryFinding[];
  };
}

export interface ApiFeedItem {
  id: string;
  kind: string;
  title: string;
  detail: string;
  createdAt: string;
}

export interface ApiDashboard {
  stats: {
    repositories: number;
    atRisk: number;
    critical: number;
    high: number;
    openFindings: number;
    scans: number;
    averageRisk: number;
  };
  severityMix: { label: string; value: number; color: string }[];
  riskTrend: { label: string; value: number }[];
  radar: { label: string; value: number }[];
  feed: ApiFeedItem[];
  topRepos: ApiRepo[];
  recentScans: ApiScan[];
}

export const api = {
  login(email: string, password: string) {
    return request<ApiTokenResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
  },
  register(name: string, email: string, password: string) {
    return request<ApiTokenResponse>("/auth/register", {
      method: "POST",
      body: { name, email, password },
      auth: false,
    });
  },
  me() {
    return request<ApiUser>("/auth/me");
  },
  updateProfile(payload: { name?: string; email?: string }) {
    return request<ApiUser>("/auth/me", { method: "PATCH", body: payload });
  },
  changePassword(currentPassword: string, newPassword: string) {
    return request<{ detail: string }>("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
  },
  forgotPassword(email: string) {
    return request<ApiForgotPasswordResponse>("/auth/forgot-password", {
      method: "POST",
      body: { email },
      auth: false,
    });
  },
  resetPassword(token: string, password: string) {
    return request<{ detail: string }>("/auth/reset-password", {
      method: "POST",
      body: { token, password },
      auth: false,
    });
  },
  sessions(signal?: AbortSignal) {
    return request<ApiSession[]>("/auth/sessions", { signal });
  },
  revokeSession(sessionId: string) {
    return request<{ detail: string }>(`/auth/sessions/${sessionId}`, { method: "DELETE" });
  },
  revokeOtherSessions() {
    return request<{ detail: string }>("/auth/sessions", { method: "DELETE" });
  },
  logout() {
    return request<{ detail: string }>("/auth/logout", { method: "POST" });
  },
  dashboard(signal?: AbortSignal) {
    return request<ApiDashboard>("/dashboard", { signal });
  },
  repos(signal?: AbortSignal) {
    return request<ApiRepo[]>("/repos", { signal });
  },
  repo(repoId: string, signal?: AbortSignal) {
    return request<ApiRepo>(`/repos/${repoId}`, { signal });
  },
  connectRepo(fullName: string, token?: string) {
    return request<ApiRepo>("/repos", {
      method: "POST",
      body: { fullName, token: token || undefined },
    });
  },
  updateRepo(repoId: string, payload: { branch?: string; token?: string }) {
    return request<ApiRepo>(`/repos/${repoId}`, { method: "PATCH", body: payload });
  },
  deleteRepo(repoId: string) {
    return request<void>(`/repos/${repoId}`, { method: "DELETE" });
  },
  scanRepo(repoId: string) {
    return request<ApiScan>(`/repos/${repoId}/scan`, { method: "POST" });
  },
  scans(repositoryId?: string, signal?: AbortSignal) {
    const query = repositoryId ? `?repositoryId=${encodeURIComponent(repositoryId)}` : "";
    return request<ApiScan[]>(`/scans${query}`, { signal });
  },
  scan(scanId: string, signal?: AbortSignal) {
    return request<ApiScan>(`/scans/${scanId}`, { signal });
  },
  scanFindings(scanId: string, signal?: AbortSignal) {
    return request<ApiFinding[]>(`/scans/${scanId}/findings`, { signal });
  },
  analyze(code: string, filePath: string) {
    return request<ApiAnalyzeResponse>("/scans/analyze", {
      method: "POST",
      body: { code, filePath },
    });
  },
  findings(params?: { repositoryId?: string; severity?: string; status?: string; signal?: AbortSignal }) {
    const search = new URLSearchParams();
    if (params?.repositoryId) search.set("repositoryId", params.repositoryId);
    if (params?.severity) search.set("severity", params.severity);
    if (params?.status) search.set("status", params.status);
    const query = search.toString();
    return request<ApiFinding[]>(`/findings${query ? `?${query}` : ""}`, { signal: params?.signal });
  },
  updateFinding(findingId: string, status: string) {
    return request<ApiFinding>(`/findings/${findingId}`, { method: "PATCH", body: { status } });
  },
  reports(signal?: AbortSignal) {
    return request<ApiReport[]>("/reports", { signal });
  },
  report(reportId: string, signal?: AbortSignal) {
    return request<ApiReportDetail>(`/reports/${reportId}`, { signal });
  },
  createReport(payload: { name: string; scope: string; kind: string; repositoryId?: string }) {
    return request<ApiReport>("/reports", { method: "POST", body: payload });
  },
  async downloadReport(reportId: string, fallbackName: string) {
    const token = getToken();
    const response = await fetch(`${BASE}/reports/${reportId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new ApiError("Download failed.", response.status);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const disposition = response.headers.get("content-disposition");
    const match = disposition?.match(/filename="?([^";]+)"?/i);
    anchor.download = match?.[1] || fallbackName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  },
  deleteReport(reportId: string) {
    return request<void>(`/reports/${reportId}`, { method: "DELETE" });
  },
  intel(params?: { severity?: string; exploited?: boolean; q?: string; sort?: string; signal?: AbortSignal }) {
    const search = new URLSearchParams();
    if (params?.severity) search.set("severity", params.severity);
    if (params?.exploited !== undefined) search.set("exploited", String(params.exploited));
    if (params?.q) search.set("q", params.q);
    if (params?.sort) search.set("sort", params.sort);
    const query = search.toString();
    return request<ApiVulnerability[]>(`/intel${query ? `?${query}` : ""}`, { signal: params?.signal });
  },
  vuln(identifier: string, signal?: AbortSignal) {
    return request<ApiVulnerability>(`/intel/${encodeURIComponent(identifier)}`, { signal });
  },
  phishingAnalyze(payload: { text: string; url?: string }) {
    return request<{ score: number; verdict: string; riskLevel: string; findings: { type: string; severity: string; detail: string }[]; recommendations: string[] }>("/phishing/analyze", { method: "POST", body: payload });
  },
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
