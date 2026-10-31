import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Bug,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  Loader2,
  Package,
  Radar,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { Reveal } from "../components/ui/Reveal";
import { Tabs } from "../components/ui/Tabs";
import { SeverityBadge, Tag } from "../components/ui/Severity";
import { useToast } from "../components/ui/Toaster";
import { intelTabs, vulnerabilities, type IntelTab } from "../data/vulns";
import { api, errorMessage } from "../lib/api";
import { toVulnerability } from "../lib/adapters";
import type { Vulnerability } from "../lib/types";

const PAGE_SIZE = 8;

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function matchesTab(vuln: Vulnerability, tab: IntelTab) {
  switch (tab) {
    case "critical":
      return vuln.severity === "critical";
    case "exploited":
      return vuln.exploited;
    case "emerging":
      return vuln.epss < 0.72 && vuln.published >= "2024-01-01";
    default:
      return true;
  }
}

export function Intelligence() {
  const toast = useToast();
  const [tab, setTab] = useState<IntelTab>("latest");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [vulnList, setVulnList] = useState<Vulnerability[]>(vulnerabilities);
  const [selected, setSelected] = useState<Vulnerability | null>(null);
  const [syncing, setSyncing] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadTimer = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const visibleRef = useRef(PAGE_SIZE);
  const totalRef = useRef(vulnerabilities.length);

  const loadIntel = useCallback(async (signal?: AbortSignal) => {
    const list = await api.intel({ sort: "published", signal });
    setVulnList(list.map(toVulnerability));
    return list.length;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadIntel(controller.signal).catch((error) => {
      if ((error as Error).name !== "AbortError") {
        toast({ title: "Threat feed unavailable", message: errorMessage(error), tone: "danger" });
      }
    });
    return () => controller.abort();
  }, [loadIntel, toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vulnList
      .filter((vuln) => matchesTab(vuln, tab))
      .filter((vuln) =>
        q
          ? `${vuln.cve} ${vuln.title} ${vuln.summary} ${vuln.package} ${vuln.tags.join(" ")}`
              .toLowerCase()
              .includes(q)
          : true,
      )
      .sort((a, b) => (a.published < b.published ? 1 : -1));
  }, [tab, query, vulnList]);

  const counts = useMemo(
    () => ({
      latest: vulnList.length,
      critical: vulnList.filter((vuln) => vuln.severity === "critical").length,
      exploited: vulnList.filter((vuln) => vuln.exploited).length,
      emerging: vulnList.filter((vuln) => vuln.epss < 0.72 && vuln.published >= "2024-01-01")
        .length,
    }),
    [vulnList],
  );

  const requestMore = useCallback(() => {
    if (loadingRef.current || visibleRef.current >= totalRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    loadTimer.current = window.setTimeout(() => {
      setVisible((current) => {
        const next = Math.min(current + PAGE_SIZE, totalRef.current);
        visibleRef.current = next;
        return next;
      });
      loadingRef.current = false;
      setLoading(false);
      loadTimer.current = null;
    }, 650);
  }, []);

  useEffect(() => {
    totalRef.current = filtered.length;
  }, [filtered.length]);

  useEffect(() => {
    if (loadTimer.current !== null) {
      window.clearTimeout(loadTimer.current);
      loadTimer.current = null;
    }
    loadingRef.current = false;
    visibleRef.current = PAGE_SIZE;
    setLoading(false);
    setVisible(PAGE_SIZE);
  }, [tab, query]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) requestMore();
      },
      { rootMargin: "220px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [filtered.length, requestMore]);

  useEffect(
    () => () => {
      if (loadTimer.current !== null) window.clearTimeout(loadTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const toggleBookmark = (vuln: Vulnerability) => {
    setBookmarks((current) => {
      const next = new Set(current);
      if (next.has(vuln.id)) {
        next.delete(vuln.id);
        toast({ title: "Removed from watchlist", message: vuln.cve, tone: "info" });
      } else {
        next.add(vuln.id);
        toast({ title: "Added to watchlist", message: `${vuln.cve} will trigger alerts.`, tone: "success" });
      }
      return next;
    });
  };

  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const total = await loadIntel();
      toast({
        title: "Alerts refreshed",
        message: `${total} alerts loaded.`,
        tone: "success",
      });
    } catch (error) {
      toast({ title: "Could not refresh alerts", message: errorMessage(error), tone: "danger" });
    } finally {
      setSyncing(false);
    }
  };

  const exportFeed = () => {
    const header = "cve,title,severity,cvss,epss,exploited,published,package,fixVersion";
    const rows = filtered.map((vuln) =>
      [
        vuln.cve,
        `"${vuln.title.replace(/"/g, '""')}"`,
        vuln.severity,
        vuln.cvss,
        vuln.epss,
        vuln.exploited,
        vuln.published,
        `"${vuln.package.replace(/"/g, '""')}"`,
        `"${vuln.fixVersion.replace(/"/g, '""')}"`,
      ].join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "aegis-threat-feed.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast({ title: "Download ready", message: `${filtered.length} alerts saved as a CSV file.`, tone: "success" });
  };

  const copyAdvice = async () => {
    if (!selected) return;
    const text = [
      `${selected.cve}: ${selected.title}`,
      `Severity: ${selected.severity}`,
      `Package: ${selected.package} (${selected.affected})`,
      `Fix: update to ${selected.fixVersion}`,
      selected.exploited ? "Status: actively exploited. Treat this as urgent." : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", message: "Share these fix steps with your team.", tone: "success" });
    } catch {
      toast({ title: "Copy failed", message: "Clipboard access was denied.", tone: "danger" });
    }
  };

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;
  const exploitedFeed = vulnList.filter((vuln) => vuln.exploited).slice(0, 8);

  return (
    <div className="page-stack">
      <Reveal>
        <header className="page-head">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-pulse" />
              Vulnerability alerts
            </div>
            <h1>
              Security alerts, <span className="text-gradient">without the noise.</span>
            </h1>
            <p>
              See known vulnerabilities that affect the packages you use. Each alert explains what
              the problem is and how to fix it.
            </p>
          </div>
          <div className="head-actions">
            <button type="button" className="btn btn-neo" onClick={() => void sync()} disabled={syncing}>
              {syncing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
              {syncing ? "Refreshing" : "Refresh alerts"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={exportFeed}
            >
              <Download size={16} /> Download list
            </button>
          </div>
        </header>
      </Reveal>

      <Reveal>
        <div className="wire">
          <span className="wire-label">
            <Radio size={15} /> Recent alerts
          </span>
          <div className="wire-track-wrap">
            <div className="wire-track">
              {[...exploitedFeed, ...exploitedFeed].map((vuln, index) => (
                <span className="wire-item" key={`${vuln.id}-${index}`}>
                  <span className="wire-dot" />
                  <span className="mono">{vuln.cve}</span>
                  <span className="wire-title">{vuln.title.split(":")[0]}</span>
                  <span className="wire-epss">EPSS {(vuln.epss * 100).toFixed(1)}%</span>
                </span>
              ))}
            </div>
          </div>
          <span className="wire-count">
            <Zap size={13} /> {counts.exploited} actively exploited
          </span>
        </div>
      </Reveal>

      <Reveal>
        <article className="card intel-toolbar">
          <div className="intel-toolbar-row">
            <div className="search-field">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by CVE, package or keyword…"
                aria-label="Search alerts"
              />
              {query && (
                <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="intel-stats">
              <span className="intel-stat">
                <Radar size={15} /> {filtered.length} alerts
              </span>
              <span className="intel-stat">
                <Bug size={15} /> {bookmarks.size} saved
              </span>
            </div>
          </div>
          <div className="intel-toolbar-row lower">
            <Tabs
              layoutId="intel-tabs"
              tabs={intelTabs.map((entry) => ({
                id: entry.id,
                label: entry.label,
                count: counts[entry.id],
              }))}
              active={tab}
              onChange={(id) => setTab(id as IntelTab)}
            />
            <span className="intel-sort">
              <Clock3 size={14} /> Newest first
            </span>
          </div>
        </article>
      </Reveal>

      <section className="intel-feed" aria-label="Vulnerability alerts">
        {shown.map((vuln, index) => (
          <Reveal key={vuln.id} delay={Math.min(index, 4) * 0.035}>
            <article className={clsx("intel-card", `intel-${vuln.severity}`, vuln.exploited && "is-exploited")}>
              <span className="intel-rail" aria-hidden="true" />
              <div className="intel-card-head">
                <div className="intel-ident">
                  <span className="cve mono">{vuln.cve}</span>
                  <SeverityBadge severity={vuln.severity} />
                  {vuln.exploited && (
                    <span className="exploited-badge">
                      <Zap size={12} /> Actively exploited
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={clsx("bookmark-btn", bookmarks.has(vuln.id) && "is-saved")}
                  onClick={() => toggleBookmark(vuln)}
                  aria-label={bookmarks.has(vuln.id) ? "Remove from watchlist" : "Add to watchlist"}
                >
                  {bookmarks.has(vuln.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                </button>
              </div>

              <button type="button" className="intel-title-btn" onClick={() => setSelected(vuln)}>
                <h2>{vuln.title}</h2>
                <ArrowUpRight size={18} />
              </button>
              <p className="intel-summary">{vuln.summary}</p>

              <div className="intel-metrics">
                <div className={clsx("cvss", `cvss-${vuln.severity}`)}>
                  <span className="cvss-label">Severity</span>
                  <span className="cvss-value">{vuln.cvss.toFixed(1)}</span>
                </div>
                <div className="intel-metric">
                  <span className="metric-label">Attack chance</span>
                  <span className="metric-value">{(vuln.epss * 100).toFixed(1)}%</span>
                  <span className="metric-track">
                    <span style={{ width: `${vuln.epss * 100}%` }} />
                  </span>
                </div>
                <div className="intel-metric">
                  <span className="metric-label">
                    <Package size={12} /> Package
                  </span>
                  <span className="metric-value package-value">{vuln.package}</span>
                  <span className="metric-sub">{vuln.ecosystem} · {vuln.affected}</span>
                </div>
                <div className="intel-metric">
                  <span className="metric-label">
                    <CheckCircle2 size={12} /> Fixed in
                  </span>
                  <span className="metric-value">{vuln.fixVersion}</span>
                  <span className="metric-sub">{vuln.cwe}</span>
                </div>
              </div>

              <div className="intel-card-foot">
                <div className="intel-tags">
                  {vuln.tags.slice(0, 3).map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
                <div className="intel-foot-right">
                  <span className="intel-date">{formatDate(vuln.published)}</span>
                  <button type="button" className="link-btn" onClick={() => setSelected(vuln)}>
                    Details <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </article>
          </Reveal>
        ))}

        {filtered.length === 0 && (
          <div className="card feed-empty">
            <ShieldAlert size={26} />
            <h3>No alerts match that search</h3>
            <p>Try a CVE number, a package such as “openssh”, or a keyword like “rce”.</p>
            <button type="button" className="btn btn-neo" onClick={() => setQuery("")}>
              Clear search
            </button>
          </div>
        )}

        {loading && (
          <div className="feed-skeletons" aria-label="Loading more alerts">
            {[0, 1].map((item) => (
              <div className="intel-card skeleton-card" key={item}>
                <span className="skeleton line w-30" />
                <span className="skeleton line w-70" />
                <span className="skeleton line w-90" />
                <div className="skeleton-metrics">
                  <span className="skeleton block" />
                  <span className="skeleton block" />
                  <span className="skeleton block" />
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="feed-sentinel">
          {hasMore ? (
            <button type="button" className="btn btn-neo" onClick={requestMore}>
              {loading ? <Loader2 size={16} className="spin" /> : <Activity size={16} />}
              {loading ? "Loading…" : `Show more · ${filtered.length - visible} left`}
            </button>
          ) : (
            <span className="feed-end">
              <CheckCircle2 size={15} /> All {filtered.length} alerts shown
            </span>
          )}
        </div>
      </section>

      <AnimatePresence>
        {selected && (
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setSelected(null)}
          >
            <motion.aside
              className="drawer"
              role="dialog"
              aria-modal="true"
              aria-label={`${selected.cve} details`}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="drawer-head">
                <div>
                  <span className="mono drawer-cve">{selected.cve}</span>
                  <div className="drawer-badges">
                    <SeverityBadge severity={selected.severity} />
                    {selected.exploited && (
                      <span className="exploited-badge">
                        <Zap size={12} /> actively exploited
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" className="icon-btn" onClick={() => setSelected(null)} aria-label="Close details">
                  <X size={18} />
                </button>
              </div>

              <h2 className="drawer-title">{selected.title}</h2>
              <p className="drawer-summary">{selected.summary}</p>

              <div className="drawer-metrics">
                <div>
                  <span>Severity score</span>
                  <strong>{selected.cvss.toFixed(1)}</strong>
                </div>
                <div>
                  <span>Attack chance</span>
                  <strong>{(selected.epss * 100).toFixed(1)}%</strong>
                </div>
                <div>
                  <span>Issue type</span>
                  <strong className="mono">{selected.cwe}</strong>
                </div>
              </div>

              <div className="drawer-section">
                <span className="drawer-label">
                  <Package size={14} /> Affected package
                </span>
                <div className="drawer-package">
                  <strong>{selected.package}</strong>
                  <span>
                    {selected.ecosystem} · {selected.affected}
                  </span>
                  <span className="pill pill-mint">fixed in {selected.fixVersion}</span>
                </div>
              </div>

              <div className="drawer-section">
                <span className="drawer-label">
                  <Sparkles size={14} /> What this means
                </span>
                <p className="drawer-brief">
                  {selected.exploited
                    ? "Attackers are already using this flaw. Treat it as urgent: find where the package is used, apply the official fix, and check for signs of abuse."
                    : "No attacks have been confirmed yet, but the risk is rising. Update to the fixed version in your next release."}
                </p>
              </div>

              <div className="drawer-tags">
                {selected.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>

              <div className="drawer-actions">
                <button type="button" className="btn btn-primary" onClick={() => void copyAdvice()}>
                  <CheckCircle2 size={15} /> Copy what to do
                </button>
                <button
                  type="button"
                  className="btn btn-neo"
                  onClick={() =>
                    window.open(
                      `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(selected.cve)}`,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <ExternalLink size={15} /> Official notice
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
