import { MailWarning, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/Toaster";
import { api, errorMessage } from "../lib/api";

export function Phishing() {
  const toast = useToast();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyze = async () => {
    if (!text.trim() && !url.trim()) {
      toast({ title: "Add content", message: "Paste email text or URL to analyze", tone: "danger" });
      return;
    }
    setLoading(true);
    try {
      const res = await api.phishingAnalyze({ text, url: url || undefined });
      setResult(res);
      toast({ title: res.verdict, message: `Risk score: ${res.score}/100`, tone: res.score >= 45 ? "danger" : "success" });
    } catch (e) {
      toast({ title: "Analysis failed", message: errorMessage(e), tone: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const getTone = (score: number) => {
    if (score >= 70) return "critical";
    if (score >= 45) return "high";
    if (score >= 25) return "medium";
    return "low";
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Email & URL Security"
        title="Phishing Identifier"
        description="Analyze suspicious emails, messages, or URLs for phishing indicators with AI-style heuristics."
      />

      <div className="phishing-grid">
        <div className="card" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1.5rem" }}>Input</h3>
          <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "1.2rem" }}>Email/Message Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the suspicious email content, headers, or message here..."
            style={{ width: "100%", minHeight: "200px", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "1.2rem", fontFamily: "inherit", resize: "vertical" }}
          />
          <label style={{ display: "block", margin: "1rem 0 0.75rem", fontSize: "1.2rem" }}>URL (optional)</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://suspicious-example.com/login"
            style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "1.2rem" }}
          />
          <Button onClick={analyze} disabled={loading} style={{ marginTop: "1rem", width: "100%" }}>
            {loading ? "Analyzing..." : "Analyze for Phishing"}
          </Button>
        </div>

        <div className="card" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1.5rem" }}>Analysis Result</h3>
          {!result && (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
              <MailWarning size={48} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
              <p>Enter content and click analyze to see results</p>
            </div>
          )}
          {result && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", padding: "1rem", background: `var(--${getTone(result.score)}-bg, #fef2f2)`, borderRadius: "8px" }}>
                {result.score >= 45 ? <ShieldAlert size={32} style={{ color: "var(--danger)" }} /> : <ShieldCheck size={32} style={{ color: "var(--success)" }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "1.7rem", fontWeight: 600 }}>{result.verdict}</div>
                  <div style={{ fontSize: "1.2rem", color: "var(--text-secondary)" }}>Risk Score: {result.score}/100 ({result.riskLevel})</div>
                </div>
              </div>

              <h4 style={{ margin: "0 0 0.75rem", fontSize: "1.25rem" }}>Indicators Found</h4>
              {result.findings.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: "1.2rem" }}>No obvious indicators detected</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
                  {result.findings.map((f: any, i: number) => (
                    <div key={i} style={{ display: "flex", gap: "0.75rem", padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "6px" }}>
                      <AlertTriangle size={18} style={{ color: f.severity === "high" ? "var(--danger)" : "var(--warning)", marginTop: "2px" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "1.15rem", fontWeight: 500, textTransform: "capitalize" }}>{f.type} - {f.severity}</div>
                        <div style={{ fontSize: "1.1rem", color: "var(--text-secondary)" }}>{f.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h4 style={{ margin: "0 0 0.75rem", fontSize: "1.25rem" }}>Recommendations</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {result.recommendations.map((r: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "start" }}>
                    <CheckCircle2 size={16} style={{ color: "var(--success)", marginTop: "2px" }} />
                    <span style={{ fontSize: "1.15rem" }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
