import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { AuthShell } from "../components/auth/AuthShell";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { api, errorMessage } from "../lib/api";
import { saveSession } from "../lib/auth";

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const address = email.trim();
    if (!address || !address.includes("@") || !password) {
      setError("Enter your work email and password to continue.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const session = await api.login(address, password);
      saveSession(session.accessToken, session.user);
      navigate(from === "/login" ? "/" : from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to review projects, scans, and security findings."
      footer={
        <p>
          New to Aegis? <Link to="/register">Create an account</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Field label="Work email" htmlFor="login-email">
          <span className="auth-input-wrap">
            <Mail size={16} aria-hidden="true" />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@company.com"
              autoFocus
              required
            />
          </span>
        </Field>

        <Field
          label="Password"
          htmlFor="login-password"
        >
          <span className="auth-input-wrap">
            <LockKeyhole size={16} aria-hidden="true" />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </Field>

        <div className="auth-form-row">
          <span className="auth-form-hint">Use the password set for your workspace.</span>
          <Link className="auth-inline-link" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" loading={submitting} className="auth-submit">
          {submitting ? "Signing in" : "Sign in"}
          {!submitting && <ArrowRight size={16} />}
        </Button>
      </form>

      {import.meta.env.DEV && (
        <p className="auth-dev-note">
          Local demo: operator@aegis.dev / aegis-demo-2026
        </p>
      )}
    </AuthShell>
  );
}
