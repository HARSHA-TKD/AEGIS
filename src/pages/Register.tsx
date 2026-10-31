import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { AuthShell } from "../components/auth/AuthShell";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { api, errorMessage } from "../lib/api";
import { saveSession } from "../lib/auth";

export function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!name.trim()) {
      setError("Enter your name to create an account.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid work email.");
      return;
    }
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
      const session = await api.register(name.trim(), email.trim(), password);
      saveSession(session.accessToken, session.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      description="Start reviewing projects and turning findings into fixes."
      footer={
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Field label="Full name" htmlFor="register-name">
          <span className="auth-input-wrap">
            <UserRound size={16} aria-hidden="true" />
            <input
              id="register-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder="Your name"
              autoFocus
              required
            />
          </span>
        </Field>

        <Field label="Work email" htmlFor="register-email">
          <span className="auth-input-wrap">
            <Mail size={16} aria-hidden="true" />
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@company.com"
              required
            />
          </span>
        </Field>

        <Field label="Password" htmlFor="register-password" hint="Use at least 8 characters.">
          <span className="auth-input-wrap">
            <LockKeyhole size={16} aria-hidden="true" />
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Create a password"
              minLength={8}
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

        <Field label="Confirm password" htmlFor="register-confirm">
          <span className="auth-input-wrap">
            <LockKeyhole size={16} aria-hidden="true" />
            <input
              id="register-confirm"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              placeholder="Repeat your password"
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
          {submitting ? "Creating account" : "Create account"}
          {!submitting && <ArrowRight size={16} />}
        </Button>
      </form>
    </AuthShell>
  );
}
