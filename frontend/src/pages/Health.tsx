import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { api, type ApiHealth, errorMessage } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";

export function Health() {
  const [data, setData] = useState<ApiHealth | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.health());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="System"
        title="Service health"
        description="Live checks for the API, database, and AI provider."
        actions={
          <Button
            icon={<RefreshCw size={16} />}
            loading={loading}
            onClick={() => void load()}
          >
            {loading ? "Checking..." : "Re-check"}
          </Button>
        }
      />

      {error && <div className="inline-error">{error}</div>}
      {loading && !data && <div className="card audit-loading">Checking services...</div>}

      {data && (
        <>
          <div className={`health-banner ${data.status === "ok" ? "is-ok" : "is-degraded"}`}>
            <Activity size={20} />
            <div>
              <strong>{data.status === "ok" ? "All core systems operational" : "Degraded service"}</strong>
              <span>{data.service} · {data.environment}</span>
            </div>
          </div>
          <div className="health-grid">
            {Object.entries(data.checks).map(([name, check]) => (
              <div className="card health-card" key={name}>
                <span className="card-eyebrow">{name}</span>
                <strong>{check.status}</strong>
                {check.detail && <p>{check.detail}</p>}
              </div>
            ))}
          </div>
          <p className="audit-note">Request ID: {data.requestId}</p>
        </>
      )}
    </div>
  );
}
