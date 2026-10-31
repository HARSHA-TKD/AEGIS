import { CheckCircle2, FileSearch, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "../Logo";

const benefits = [
  {
    icon: FileSearch,
    title: "Findings you can act on",
    detail: "Every issue includes the affected line, CWE context, impact, and a remediation path.",
  },
  {
    icon: ShieldCheck,
    title: "A clear security picture",
    detail: "Track project risk, severity mix, and scan history without digging through noise.",
  },
  {
    icon: Sparkles,
    title: "Built for focused review",
    detail: "Move from overview to evidence quickly, with fewer distractions along the way.",
  },
];

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand">
          <span className="auth-brand-mark">
            <LogoMark size={36} />
          </span>
          <span className="auth-brand-copy">
            <strong>AEGIS</strong>
            <span>Secure code intelligence</span>
          </span>
        </div>

        <div className="auth-story-main">
          <span className="auth-kicker">
            <CheckCircle2 size={14} /> Security review, simplified
          </span>
          <h1>See the risk. Understand the fix. Move on.</h1>
          <p>
            Aegis turns scans into a clear, evidence-backed review experience for teams
            that need to ship without losing sight of security.
          </p>

          <ul className="auth-benefits">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <li key={benefit.title}>
                  <span className="auth-benefit-icon">
                    <Icon size={17} />
                  </span>
                  <span>
                    <strong>{benefit.title}</strong>
                    <span>{benefit.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="auth-story-foot">
          <ShieldCheck size={14} /> Session controls and password reset are handled by the
          Aegis API.
        </p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-head">
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {children}
          {footer && <div className="auth-card-foot">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
