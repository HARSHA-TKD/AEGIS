import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Mail, MailCheck } from "lucide-react";
import { AuthShell } from "../components/auth/AuthShell";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { api, errorMessage } from "../lib/api";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!email.includes("@")) {
      setError("Enter the email address for your account.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await api.forgotPassword(email.trim());
      setResetToken(response.resetToken ?? null);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={sent ? "Check your email" : "Reset your password"}
      description={
        sent
          ? "If the address is registered, a reset link is on its way."
          : "Enter your account email and we will send a password reset link."
      }
      footer={
        <p>
          <Link to="/login" className="auth-back-link">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="auth-success">
          <span className="auth-success-icon">
            <MailCheck size={22} />
          </span>
          <strong>Reset request received</strong>
          <p>
            The link expires shortly for your security. Check your inbox and spam folder
            if it does not arrive.
          </p>
          {resetToken && (
            <Link className="btn btn-primary full-btn" to={`/reset-password?token=${encodeURIComponent(resetToken)}`}>
              Continue to reset <ArrowRight size={15} />
            </Link>
          )}
          <button type="button" className="link-btn" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Field label="Work email" htmlFor="forgot-email">
            <span className="auth-input-wrap">
              <Mail size={16} aria-hidden="true" />
              <input
                id="forgot-email"
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

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" loading={submitting} className="auth-submit">
            {submitting ? "Sending link" : "Send reset link"}
            {!submitting && <ArrowRight size={16} />}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
