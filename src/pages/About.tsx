import { Shield, Search, FileText, AlertTriangle, Zap, Lock, Users, ArrowRight } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { useNavigate } from "react-router-dom";

export function About() {
  const navigate = useNavigate();

  const features = [
    { icon: Search, title: "Static Code Analysis", desc: "Deep scanning of source code to detect vulnerabilities using 15+ security rules" },
    { icon: Shield, title: "Risk Assessment", desc: "Intelligent risk scoring based on severity, exploitability, and confidence" },
    { icon: FileText, title: "Comprehensive Reports", desc: "Generate detailed security reports with findings, remediation guidance, and evidence" },
    { icon: AlertTriangle, title: "Threat Intelligence", desc: "Stay updated with latest CVEs and vulnerabilities affecting your dependencies" },
    { icon: Zap, title: "Quick Scans", desc: "Analyze code snippets instantly or scan entire repositories" },
    { icon: Lock, title: "Secure by Design", desc: "Session-based authentication, encrypted tokens, and secure API practices" },
  ];

  const workflow = [
    { step: "1", title: "Connect", desc: "Link your GitHub repositories to AEGIS" },
    { step: "2", title: "Scan", desc: "Automated security analysis across your codebase" },
    { step: "3", title: "Analyze", desc: "Review prioritized findings with plain-language explanations" },
    { step: "4", title: "Remediate", desc: "Fix issues with step-by-step guidance and track progress" },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="About AEGIS"
        title="Secure Code Intelligence Platform"
        description="AEGIS helps development teams identify, prioritize, and fix security vulnerabilities before they reach production."
      />

      <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.8rem", margin: "0 0 1rem", fontFamily: "var(--font-display)" }}>What is AEGIS?</h2>
        <p style={{ maxWidth: "800px", margin: "0 auto", fontSize: "1.05rem", lineHeight: "1.7", color: "var(--text-secondary)" }}>
          AEGIS is a modern, enterprise-grade security platform that brings static application security testing (SAST) 
          to your development workflow. We make security accessible by providing clear explanations, actionable fixes, 
          and beautiful visualizations of your security posture.
        </p>
      </div>

      <div>
        <h2 style={{ fontSize: "1.5rem", margin: "0 0 1.5rem", textAlign: "center", fontFamily: "var(--font-display)" }}>Key Features</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
          {features.map((f, i) => (
            <div key={i} className="card" style={{ padding: "1.25rem", display: "flex", gap: "1rem" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <f.icon size={20} style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", margin: "0 0 1.5rem", textAlign: "center", fontFamily: "var(--font-display)" }}>How It Works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
          {workflow.map((w, i) => (
            <div key={i} style={{ textAlign: "center", position: "relative" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.2rem", fontWeight: 600 }}>
                {w.step}
              </div>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>{w.title}</h3>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)" }}>{w.desc}</p>
              {i < workflow.length - 1 && (
                <ArrowRight size={20} style={{ position: "absolute", right: "-35px", top: "14px", color: "var(--text-tertiary)", display: window.innerWidth > 768 ? "block" : "none" }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: "2rem", textAlign: "center", background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--bg) 100%)" }}>
        <Users size={48} style={{ margin: "0 auto 1rem", color: "var(--accent)" }} />
        <h2 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem", fontFamily: "var(--font-display)" }}>Built for Security-Conscious Teams</h2>
        <p style={{ maxWidth: "600px", margin: "0 auto 1.5rem", color: "var(--text-secondary)" }}>
          Whether you're a solo developer or part of an enterprise security team, AEGIS scales to meet your needs.
        </p>
        <Button onClick={() => navigate("/scan")} style={{ padding: "0.75rem 2rem" }}>
          Get Started <ArrowRight size={16} style={{ marginLeft: "0.5rem" }} />
        </Button>
      </div>

      <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
        <p>AEGIS v1.0 • Secure Code Intelligence Platform</p>
      </div>
    </div>
  );
}
