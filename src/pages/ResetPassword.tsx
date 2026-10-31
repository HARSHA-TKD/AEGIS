import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { AuthShell } from "../components/auth/AuthShell";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { api, errorMessage } from "../lib/api";
import { clearSession } from "../lib/auth";

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !token) return;
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await api.resetPassword(token, password);
      clearSession();
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthShell
        title="Reset link needed"
        description="This page needs a valid password reset link."
        footer={
          <p>
            <Link to="/forgot-password" className="auth-back-link">
              Request a new link
            </Link>
          </p>
        }
      >
        <p className="auth-error" role="alert">
          The reset link is missing or incomplete. Request a new one to continue.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={done ? "Password updated" : "Choose a new password"}
      description={
        done
          ? "Your password has been reset. Sign in with your new password."
          : "Use at least 8 characters. This link can only be used once."
      }
      footer={
        <p>
          <Link to="/login" className="auth-back-link">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </p>
      }
    >
      {done ? (
        <div className="auth-success">
          <span className="auth-success-icon">
            <LockKeyhole size={22} />
          </span>
          <strong>You are all set</strong>
          <p>All other sessions have been signed out for your security.</p>
          <Link className="btn btn-primary full-btn" to="/login">
            Sign in <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Field label="New password" htmlFor="reset-password" hint="Use at least 8 characters.">
            <span className="auth-input-wrap">
              <LockKeyhole size={16} aria-hidden="true" />
              <input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Create a new password"
                minLength={8}
                autoFocus
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

          <Field label="Confirm new password" htmlFor="reset-confirm">
            <span className="auth-input-wrap">
              <LockKeyhole size={16} aria-hidden="true" />
              <input
                id="reset-confirm"
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                placeholder="Repeat the new password"
                minLength={8}
                required
              />
            </span>
          </Field>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" loading={submitting} className="auth-submit">
            {submitting ? "Updating password" : "Update password"}
            {!submitting && <ArrowRight size={16} />}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
