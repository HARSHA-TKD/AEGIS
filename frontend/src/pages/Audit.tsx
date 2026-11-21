import { useCallback, useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { api, type ApiAuditEntry, errorMessage } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toaster";

export function Audit() {
  const [items, setItems] = useState<ApiAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.audit();
      setItems(result.items);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Security"
        title="Audit log"
        description="A record of account, project, report, and assistant activity."
        actions={
          <Button
            icon={<RefreshCw size={16} />}
            loading={loading}
            onClick={() => setReloadKey((value) => value + 1)}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      {error && <div className="inline-error">{error}</div>}

      {loading ? (
        <div className="card audit-loading">Loading activity...</div>
      ) : items.length === 0 ? (
        <EmptyState icon={History} title="No audit events" description="Actions you take will appear here." />
      ) : (
        <div className="card audit-table">
          <div className="audit-row audit-head">
            <span>Action</span>
            <span>Actor</span>
            <span>Target</span>
            <span>When</span>
          </div>
          {items.map((entry) => (
            <div className="audit-row" key={entry.id}>
              <strong>{entry.action}</strong>
              <span>{entry.actorEmail || "System"}</span>
              <span>{entry.targetType ? `${entry.targetType}${entry.targetId ? ` · ${entry.targetId.slice(0, 8)}` : ""}` : "—"}</span>
              <span>{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div className="audit-note">
          <span>{items.length} recent events</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => toast({ title: "Audit events are append-only for this workspace.", tone: "info" })}
          >
            Learn more
          </button>
        </div>
      )}
    </div>
  );
}
