import clsx from "clsx";
import type { Severity } from "../../lib/types";

const labels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export function SeverityBadge({
  severity,
  compact = false,
}: {
  severity: Severity;
  compact?: boolean;
}) {
  return (
    <span className={clsx("sev", `sev-${severity}`, compact && "sev-compact")}>
      <span className="sev-dot" />
      {labels[severity]}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="tag">{children}</span>;
}
