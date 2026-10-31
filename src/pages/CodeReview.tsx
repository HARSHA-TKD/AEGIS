import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  ArrowRight,
  Braces,
  Check,
  ClipboardCheck,
  Clock3,
  Code2,
  Copy,
  FileCode2,
  FileSearch,
  FolderGit2,
  Gauge,
  Loader2,
  Play,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { SeverityBadge } from "../components/ui/Severity";
import { ProgressRing } from "../components/ui/ProgressRing";
import { EmptyState } from "../components/ui/EmptyState";
import { CodeEditor } from "../components/ui/CodeEditor";
import { useToast } from "../components/ui/Toaster";
import { gradeFor, sampleCode, weight } from "../lib/scanner";
import type { Finding, Repo, ScanState, Severity } from "../lib/types";
import { api, errorMessage, type ApiScannerFinding } from "../lib/api";
import { toFinding, toRepo, toScannerFinding } from "../lib/adapters";

const languages = ["TypeScript", "JavaScript", "Python", "Java", "Go", "PHP", "Rust"];

const scanModes = [
  { id: "paste", label: "Paste code" },
  { id: "upload", label: "Upload file" },
  { id: "repo", label: "From a project" },
] as const;

type ScanMode = (typeof scanModes)[number]["id"];
type ResultTab = "findings" | "fixes";
type Filter = "all" | Severity;

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  return findings.reduce(
    (counts, finding) => {
      counts[finding.severity] += 1;
      return counts;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<Severity, number>,
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CodeReview() {
  const navigate = useNavigate();
  const toast = useToast();
  const [code, setCode] = useState(sampleCode);
  const [fileName, setFileName] = useState("checkout.ts");
  const [language, setLanguage] = useState("TypeScript");
  const [mode, setMode] = useState<ScanMode>("paste");
  const [repoList, setRepoList] = useState<Repo[]>([]);
  const [repoLoading, setRepoLoading] = useState(true);
  const [repoError, setRepoError] = useState("");
  const [repoReloadKey, setRepoReloadKey] = useState(0);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanPhase, setScanPhase] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanRisk, setScanRisk] = useState(0);
  const [scanSource, setScanSource] = useState<"snippet" | "repo">("snippet");
  const [findings, setIssues] = useState<Finding[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>("findings");
  const [filter, setFilter] = useState<Filter>("all");
  const [doneFixes, setDoneFixes] = useState<Set<string>>(new Set());
  const [lastScan, setLastScan] = useState<{ duration: string; findings: number; source: string } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lines = code.split("\n");
  const counts = useMemo(() => countBySeverity(findings), [findings]);
  const grade = useMemo(() => gradeFor(scanRisk), [scanRisk]);
  const findingLines = useMemo(() => new Set(findings.map((finding) => finding.line)), [findings]);
  const visibleFindings = useMemo(
    () => (filter === "all" ? findings : findings.filter((finding) => finding.severity === filter)),
    [filter, findings],
  );
  const selected = visibleFindings.find((finding) => finding.id === selectedId) ?? visibleFindings[0] ?? null;
  const doneCount = findings.filter((finding) => doneFixes.has(finding.id)).length;
  const fixPct = findings.length ? Math.round((doneCount / findings.length) * 100) : 0;

  useEffect(() => {
    const controller = new AbortController();
    setRepoLoading(true);
    setRepoError("");
    api
      .repos(controller.signal)
      .then((list) => {
        const mapped = list.map(toRepo);
        setRepoList(mapped);
        setSelectedRepo((current) =>
          mapped.some((repo) => repo.id === current) ? current : mapped[0]?.id ?? "",
        );
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setRepoError(errorMessage(error));
      })
      .finally(() => setRepoLoading(false));
    return () => controller.abort();
  }, [repoReloadKey]);

  const resetResults = () => {
    setIssues([]);
    setSelectedId(null);
    setDoneFixes(new Set());
    setLastScan(null);
    setScanRisk(0);
    setScanError("");
    setResultTab("findings");
    setFilter("all");
  };

  const startScan = async () => {
    if (mode === "repo" && !selectedRepo) {
      toast({ title: "Choose a project", message: "Connect or select a project first.", tone: "danger" });
      return;
    }
    if (mode !== "repo" && !code.trim()) {
      toast({ title: "Nothing to review", message: "Paste code or upload a file first.", tone: "danger" });
      return;
    }

    resetResults();
    setScanState("scanning");
    const started = performance.now();

    try {
      let result: Finding[];
      let risk: number;
      let source: string;
      let origin: "snippet" | "repo";

      if (mode === "repo") {
        const repo = repoList.find((entry) => entry.id === selectedRepo);
        source = repo ? `${repo.org}/${repo.name}` : "Selected project";
        origin = "repo";
        setScanPhase("Queueing project scan");
        const queued = await api.scanRepo(selectedRepo);
        let current = queued;
        for (let attempt = 0; attempt < 80; attempt += 1) {
          if (current.status === "complete" || current.status === "failed") break;
          setScanPhase(current.status === "queued" ? "Waiting for a scanner" : "Scanning project files");
          await new Promise((resolve) => window.setTimeout(resolve, 850));
          current = await api.scan(queued.id);
        }
        if (current.status !== "complete") {
          throw new Error(current.error || "The project scan did not finish. Please try again.");
        }
        setScanPhase("Loading findings");
        const remoteIssues = await api.scanFindings(current.id);
        result = remoteIssues.map(toFinding);
        risk = current.risk;
      } else {
        source = fileName || "Code snippet";
        origin = "snippet";
        setScanPhase("Analyzing code");
        const analysis = await api.analyze(code, fileName || "snippet");
        result = analysis.findings.map((finding: ApiScannerFinding, index: number) =>
          toScannerFinding(finding, index),
        );
        risk = analysis.risk;
      }

      const seconds = (performance.now() - started) / 1000;
      const elapsed = seconds < 0.1 ? "<0.1" : seconds.toFixed(1);
      setIssues(result);
      setSelectedId(result[0]?.id ?? null);
      setScanRisk(risk);
      setScanSource(origin);
      setLastScan({ duration: elapsed, findings: result.length, source });
      setScanState("complete");
      setScanPhase("");
      toast({
        title: result.length ? `${result.length} findings` : "No issues found",
        message: result.length
          ? `Risk score ${risk}/100. Start with the highest severity findings.`
          : "The active rules did not match anything in this code.",
        tone: result.length ? "danger" : "success",
      });
    } catch (error) {
      setScanState("idle");
      setScanPhase("");
      setScanError(errorMessage(error));
      toast({ title: "Scan failed", message: errorMessage(error), tone: "danger" });
    }
  };

  const loadSample = () => {
    setCode(sampleCode);
    setFileName("checkout.ts");
    setLanguage("TypeScript");
    setMode("paste");
    setScanState("idle");
    setScanPhase("");
    resetResults();
  };

  const handleFile = (file: File) => {
    if (file.size > 400_000) {
      toast({ title: "File too large", message: "Choose a source file smaller than 400 KB.", tone: "danger" });
      return;
    }
    void file.text().then((text) => {
      setCode(text);
      setFileName(file.name);
      setMode("paste");
      setScanState("idle");
      resetResults();
      toast({ title: "File loaded", message: `${file.name} is ready to analyze.`, tone: "success" });
    });
  };

  const toggleFix = (id: string) => {
    setDoneFixes((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyFix = async (finding: Finding) => {
    const ok = await copyText(finding.fix);
    toast({
      title: ok ? "Fix copied" : "Copy failed",
      message: ok ? "The remediation guidance is on your clipboard." : "Clipboard access was denied.",
      tone: ok ? "success" : "danger",
    });
  };

  const addToFixList = (finding: Finding) => {
    if (scanSource !== "repo") {
      toast({
        title: "Snippet analysis is not stored",
        message: "Run a project scan to persist findings and track their status.",
        tone: "info",
      });
      return;
    }
    api
      .updateFinding(finding.id, "accepted")
      .then(() => {
        setDoneFixes((current) => new Set(current).add(finding.id));
        toast({ title: "Added to fix list", message: `${finding.cwe} is marked for remediation.`, tone: "success" });
      })
      .catch((error) => toast({ title: "Could not update finding", message: errorMessage(error), tone: "danger" }));
  };

  const verdict =
    scanState !== "complete"
      ? "Run a scan to see the risk score and prioritized findings."
      : scanRisk >= 65
        ? "High exposure. Address critical and reachable issues before releasing."
        : scanRisk >= 35
          ? "Elevated risk. Plan fixes for the highest severity findings."
          : "Low risk. No urgent issues were detected by the active rules.";

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Scan code"
        title="Review code before it ships."
        description="Paste a snippet, upload a file, or scan a connected project. Every finding includes a plain-language explanation and a suggested fix."
        actions={
          <>
            <Button icon={<RefreshCw size={16} />} onClick={loadSample}>
              Load example
            </Button>
            <Button
              variant="primary"
              icon={scanState === "scanning" ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
              onClick={() => void startScan()}
              disabled={scanState === "scanning"}
            >
              {scanState === "scanning" ? "Scanning" : "Analyze code"}
            </Button>
          </>
        }
      />

      <section className="scan-grid">
        <article className="card editor-card">
          <div className="editor-top">
            <div className="window-dots" aria-hidden="true">
              <span /> <span /> <span />
            </div>
            <label className="editor-file">
              <FileCode2 size={15} />
              <input
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                aria-label="File name"
                spellCheck={false}
              />
            </label>
            <label className="editor-lang">
              <Braces size={14} />
              <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Language">
                {languages.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="editor-modebar">
            <Tabs
              layoutId="scan-mode"
              tabs={scanModes}
              active={mode}
              onChange={(id) => {
                setMode(id as ScanMode);
                setScanError("");
              }}
              className="tabs-sm"
            />
            <span className="editor-hint">
              <Code2 size={13} /> {lines.length} lines · {code.length.toLocaleString()} chars
            </span>
          </div>

          {mode === "paste" && (
            <CodeEditor
              code={code}
              language={language}
              onChange={(next) => {
                setCode(next);
                if (scanState === "complete") {
                  setScanState("idle");
                  resetResults();
                }
              }}
              findingLines={findingLines}
            />
          )}

          {mode === "upload" && (
            <div
              className={clsx("dropzone", dragOver && "is-drag")}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                const file = event.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
            >
              <span className="dropzone-icon">
                <UploadCloud size={28} />
              </span>
              <h3>Drop a source file here</h3>
              <p>TypeScript, JavaScript, Python, Java, Go, PHP, or Rust · up to 400 KB</p>
              <Button icon={<UploadCloud size={15} />} onClick={() => fileInputRef.current?.click()}>
                Browse files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept=".ts,.tsx,.js,.jsx,.py,.java,.go,.php,.rs,.txt"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <span className="dropzone-foot">
                <ShieldCheck size={14} /> Files are sent to the Aegis API for analysis and are not stored.
              </span>
            </div>
          )}

          {mode === "repo" && (
            <div className="repo-picker">
              <div className="repo-picker-head">
                <div>
                  <h3>Choose a project</h3>
                  <p>Scans the connected repository and stores the findings.</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => navigate("/repositories")}>
                  Manage projects <ArrowRight size={14} />
                </Button>
              </div>

              {repoLoading ? (
                <div className="repo-picker-loading">
                  <Loader2 size={18} className="spin" /> Loading projects
                </div>
              ) : repoError ? (
                <EmptyState
                  icon={ShieldAlert}
                  title="Projects unavailable"
                  description={repoError}
                  action={<Button onClick={() => setRepoReloadKey((key) => key + 1)}>Try again</Button>}
                  className="dash-inline-empty"
                />
              ) : repoList.length ? (
                <div className="repo-picker-list">
                  {repoList.map((repo) => (
                    <button
                      type="button"
                      key={repo.id}
                      className={clsx("repo-option", selectedRepo === repo.id && "is-selected")}
                      onClick={() => setSelectedRepo(repo.id)}
                    >
                      <span className="repo-option-radio">
                        {selectedRepo === repo.id && <Check size={12} />}
                      </span>
                      <span className="repo-ident">
                        <strong>{repo.name}</strong>
                        <span>
                          {repo.org}/{repo.name} · {repo.branch}
                        </span>
                      </span>
                      <span className="repo-option-meta">{repo.loc} lines</span>
                      <span className={clsx("pill", repo.risk > 60 ? "pill-rose" : "pill-mint")}>
                        risk {repo.risk}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FolderGit2}
                  title="No projects connected"
                  description="Connect a repository first, then return here to run a project scan."
                  action={
                    <Button variant="primary" onClick={() => navigate("/repositories")}>
                      Connect project
                    </Button>
                  }
                  className="dash-inline-empty"
                />
              )}
            </div>
          )}

          <div className="editor-foot">
            <div className="editor-meta">
              <span>
                <ShieldCheck size={14} /> 15 rules · server-side analysis
              </span>
              <span>
                <Sparkles size={14} /> Findings include remediation guidance
              </span>
            </div>
            <Button
              variant="primary"
              icon={scanState === "scanning" ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
              onClick={() => void startScan()}
              disabled={scanState === "scanning"}
            >
              {scanState === "scanning" ? scanPhase || "Scanning" : "Scan for issues"}
            </Button>
          </div>

          {scanError && (
            <div className="scan-alert" role="alert">
              <ShieldAlert size={16} />
              <span>{scanError}</span>
            </div>
          )}
        </article>

        <aside className="scan-side">
          <article className={clsx("card risk-card", scanState === "complete" && `risk-${grade.tone}`)}>
            <div className="card-head compact">
              <div>
                <div className="card-eyebrow">
                  <Gauge size={14} /> Risk readout
                </div>
                <h2>Exposure score</h2>
              </div>
              <span className={clsx("pill", scanState === "complete" ? `pill-${grade.tone}` : "pill-muted")}>
                {scanState === "complete" ? grade.grade : "—"}
              </span>
            </div>

            <div className="risk-main">
              <ProgressRing
                value={scanState === "complete" ? scanRisk : 0}
                size={142}
                stroke={10}
                tone={scanState === "complete" ? grade.tone : "low"}
                label={scanState === "complete" ? String(scanRisk) : "--"}
                sublabel={scanState === "scanning" ? "scanning" : "risk score"}
              />
              <div className="risk-copy">
                <span className="risk-grade">
                  {scanState === "complete" ? grade.label : scanState === "scanning" ? "Scan in progress" : "Awaiting scan"}
                </span>
                <p>{scanState === "scanning" ? scanPhase : verdict}</p>
                {lastScan && scanState === "complete" && (
                  <div className="risk-meta">
                    <span>
                      <Clock3 size={13} /> {lastScan.duration}s
                    </span>
                    <span>
                      <FileSearch size={13} /> {lastScan.findings} findings
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="risk-sev-grid">
              {(["critical", "high", "medium", "low"] as Severity[]).map((severity) => (
                <div key={severity} className={`risk-sev risk-sev-${severity}`}>
                  <span className="risk-sev-value">{counts[severity]}</span>
                  <span className="risk-sev-label">{severity}</span>
                </div>
              ))}
            </div>

            <div className="scan-source">
              <span>Source</span>
              <strong>{scanState === "complete" ? lastScan?.source ?? "—" : mode === "repo" ? repoList.find((repo) => repo.id === selectedRepo)?.name ?? "—" : fileName}</strong>
            </div>
          </article>

          <article className="card scan-note-card">
            <div className="card-eyebrow">
              <ClipboardCheck size={14} /> How this works
            </div>
            <ol className="scan-note-list">
              <li>
                <span>1</span>
                <div>
                  <strong>Choose an input</strong>
                  <p>Paste code, upload a file, or select a connected project.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Run the scan</strong>
                  <p>The backend checks the code against 15 security rules.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Review and fix</strong>
                  <p>Read the explanation, copy the fix, and mark work as done.</p>
                </div>
              </li>
            </ol>
          </article>
        </aside>
      </section>

      <section className="card scan-results" aria-live="polite">
        <div className="card-head scan-results-head">
          <div>
            <div className="card-eyebrow">
              <FileSearch size={14} /> Results
            </div>
            <h2>Findings and fixes</h2>
          </div>
          {scanState === "complete" && findings.length > 0 && (
            <Tabs
              layoutId="scan-results-tab"
              tabs={[
                { id: "findings", label: "Findings", count: findings.length },
                { id: "fixes", label: "Fix list", count: findings.length },
              ]}
              active={resultTab}
              onChange={(id) => setResultTab(id as ResultTab)}
            />
          )}
        </div>

        {scanState === "idle" && (
          <EmptyState
            icon={ScanSearch}
            title="No scan yet"
            description="Choose an input above and run a scan. Findings will appear here with explanations and remediation guidance."
          />
        )}

        {scanState === "scanning" && (
          <div className="scan-progress" aria-busy="true">
            <span className="scan-progress-orb">
              <Loader2 size={26} className="spin" />
            </span>
            <h3>{scanPhase || "Scanning"}</h3>
            <p>This usually takes a few seconds. Project scans can take longer.</p>
            <div className="scan-track is-indeterminate">
              <span />
            </div>
          </div>
        )}

        {scanState === "complete" && findings.length === 0 && (
          <EmptyState
            icon={ShieldCheck}
            title="No issues found"
            description="The active rules did not match anything in this input. Try another file or project to keep coverage current."
            action={
              <Button icon={<RefreshCw size={15} />} onClick={loadSample}>
                Load an example
              </Button>
            }
          />
        )}

        {scanState === "complete" && findings.length > 0 && resultTab === "findings" && (
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

            <div className="findings-layout">
              <div className="findings-list">
                {visibleFindings.map((finding, index) => (
                  <button
                    key={finding.id}
                    type="button"
                    className={clsx("finding-item", selected?.id === finding.id && "is-selected")}
                    onClick={() => setSelectedId(finding.id)}
                  >
                    <span className={clsx("finding-index", `sev-bg-${finding.severity}`)}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="finding-copy">
                      <strong>{finding.title}</strong>
                      <span className="finding-meta">
                        line {finding.line} · {finding.cwe} · {finding.category}
                      </span>
                    </span>
                    <SeverityBadge severity={finding.severity} compact />
                  </button>
                ))}
              </div>

              {selected && (
                <div className="finding-detail">
                  <div className="finding-detail-head">
                    <div>
                      <div className="finding-detail-badges">
                        <SeverityBadge severity={selected.severity} />
                        <span className="tag">{selected.cwe}</span>
                        <span className="tag">{selected.category}</span>
                      </div>
                      <h3>{selected.title}</h3>
                    </div>
                    <span className="confidence">
                      <span className="confidence-track">
                        <span style={{ width: `${selected.confidence}%` }} />
                      </span>
                      {selected.confidence}% confidence
                    </span>
                  </div>

                  <div className="finding-location">
                    <FileCode2 size={14} />
                    {selected.filePath || fileName} <span>line {selected.line}</span>
                  </div>
                  <pre className="finding-code">
                    <code>{selected.snippet}</code>
                  </pre>

                  <div className="finding-blocks">
                    <div className="finding-block">
                      <span className="finding-block-label">
                        <Sparkles size={14} /> What this means
                      </span>
                      <p>{selected.description}</p>
                    </div>
                    <div className="finding-block">
                      <span className="finding-block-label">
                        <TriangleAlert size={14} /> Why it matters
                      </span>
                      <p>{selected.impact}</p>
                    </div>
                    <div className="finding-block finding-fix">
                      <span className="finding-block-label">
                        <ClipboardCheck size={14} /> How to fix
                      </span>
                      <p>{selected.fix}</p>
                    </div>
                  </div>

                  <div className="finding-actions">
                    <Button variant="primary" icon={<Copy size={15} />} onClick={() => void copyFix(selected)}>
                      Copy fix
                    </Button>
                    {scanSource === "repo" ? (
                      <Button icon={<ArrowRight size={15} />} onClick={() => addToFixList(selected)}>
                        Add to fix list
                      </Button>
                    ) : (
                      <span className="finding-ephemeral">Snippet results are not saved.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {scanState === "complete" && findings.length > 0 && resultTab === "fixes" && (
          <div className="fix-list">
            <div className="fix-list-head">
              <div>
                <span className="insight-eyebrow">Remediation checklist</span>
                <h3>
                  {doneCount} of {findings.length} marked done
                </h3>
              </div>
              <div className="remediation-progress">
                <span className="mono">{fixPct}%</span>
                <div className="remediation-track">
                  <span style={{ width: `${fixPct}%` }} />
                </div>
              </div>
              <Button
                icon={<Copy size={15} />}
                onClick={async () => {
                  const checklist = [...findings]
                    .sort((a, b) => weight(b.severity) - weight(a.severity))
                    .map((finding) => `[ ] ${finding.cwe} — ${finding.title}\n    ${finding.fix}`)
                    .join("\n\n");
                  const ok = await copyText(checklist);
                  toast({
                    title: ok ? "Checklist copied" : "Copy failed",
                    message: ok ? "Share the fix list with your team." : "Clipboard access was denied.",
                    tone: ok ? "success" : "danger",
                  });
                }}
              >
                Copy checklist
              </Button>
            </div>

            {[...findings]
              .sort((a, b) => weight(b.severity) - weight(a.severity))
              .map((finding, index) => {
                const done = doneFixes.has(finding.id);
                return (
                  <div className={clsx("fix-item", done && "is-done")} key={finding.id}>
                    <button
                      type="button"
                      className="fix-check"
                      onClick={() => toggleFix(finding.id)}
                      aria-label={`Mark ${finding.title} as fixed`}
                      aria-pressed={done}
                    >
                      {done ? <Check size={13} /> : <span />}
                    </button>
                    <span className="fix-order">P{index + 1}</span>
                    <div className="fix-copy">
                      <div className="fix-title-row">
                        <strong>{finding.title}</strong>
                        <SeverityBadge severity={finding.severity} compact />
                      </div>
                      <p>{finding.fix}</p>
                    </div>
                    <span className="fix-cwe mono">{finding.cwe}</span>
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}

