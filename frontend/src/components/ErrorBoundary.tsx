import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { ApiError } from "../lib/api";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  reloading: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloading: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, reloading: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Aegis UI error", error, info.componentStack);
  }

  render() {
    const { error, reloading } = this.state;
    if (!error) return this.props.children;

    const requestId = error instanceof ApiError ? error.requestId : "";
    return (
      <div className="error-boundary">
        <div className="card error-boundary-card">
          <span className="error-boundary-icon">
            <AlertTriangle size={22} />
          </span>
          <h1>Something interrupted the workspace</h1>
          <p>{error.message || "An unexpected error occurred."}</p>
          {requestId && <code>Request ID: {requestId}</code>}
          <button
            type="button"
            className="btn btn-primary"
            disabled={reloading}
            aria-busy={reloading || undefined}
            onClick={() => {
              this.setState({ reloading: true });
              window.setTimeout(() => window.location.reload(), 220);
            }}
          >
            <RefreshCw size={16} className={reloading ? "spin" : undefined} />
            {reloading ? "Reloading..." : "Reload Aegis"}
          </button>
        </div>
      </div>
    );
  }
}
