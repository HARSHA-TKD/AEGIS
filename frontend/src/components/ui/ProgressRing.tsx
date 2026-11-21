import { useId } from "react";
import type { Severity } from "../../lib/types";

const tones: Record<Severity, [string, string]> = {
  critical: ["#dc4545", "#e17b8c"],
  high: ["#e58a38", "#eab073"],
  medium: ["#d4a72c", "#e2c56e"],
  low: ["#319b73", "#6bc3a4"],
  info: ["#94a3b8", "#cbd5e1"],
};

interface ProgressRingProps {
  value: number;
  size?: number;
  stroke?: number;
  tone?: Severity;
  label?: string;
  sublabel?: string;
  reverse?: boolean;
}

export function ProgressRing({
  value,
  size = 128,
  stroke = 9,
  tone = "low",
  label,
  sublabel,
  reverse = false,
}: ProgressRingProps) {
  const id = useId().replace(/:/g, "");
  const [from, to] = tones[tone];
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * circumference;

  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="ring-svg" aria-hidden="true">
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(42,56,72,0.13)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          strokeDashoffset={0}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 7px ${from}66)` }}
        />
        {reverse && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference - dash} ${circumference}`}
            strokeDashoffset={-dash}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="ring-content">
        {label !== undefined && <span className="ring-value">{label}</span>}
        {sublabel !== undefined && <span className="ring-sub">{sublabel}</span>}
      </div>
    </div>
  );
}
