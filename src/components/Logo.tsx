import { useId } from "react";

export function LogoMark({ size = 38 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`eg-${id}`} x1="8" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent)" />
          <stop offset="0.52" stopColor="var(--accent-2)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
        <filter id={`glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M32 6.5 53 14v14.2c0 12.3-8.4 23.1-21 28.3C19.4 51.3 11 40.5 11 28.2V14l21-7.5Z"
        stroke={`url(#eg-${id})`}
        strokeWidth="2.4"
        filter={`url(#glow-${id})`}
      />
      <path
        d="M32 21.5c-7.6 0-13.8 6.1-13.8 11.5S24.4 44.5 32 44.5 45.8 38.4 45.8 33 39.6 21.5 32 21.5Z"
        stroke={`url(#eg-${id})`}
        strokeWidth="2"
      />
      <circle cx="32" cy="33" r="5" fill={`url(#eg-${id})`} filter={`url(#glow-${id})`} />
      <circle cx="33.7" cy="31.3" r="1.3" fill="#0f131a" />
      <path d="M18 12.5 24 10" stroke={`url(#eg-${id})`} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <LogoMark />
      </div>
      <div className="brand-text">
        <span className="brand-name">
          AEGIS<span className="brand-tick">/</span>
        </span>
        <span className="brand-sub">Secure code intelligence</span>
      </div>
    </div>
  );
}
