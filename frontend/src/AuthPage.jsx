import { useState } from "react";
import Icon from "./Icon.jsx";
import { useAuth } from "./AuthContext.jsx";
import "./AuthPage.css";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  show,
  onToggle,
}) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>

      <div className={`auth-input-wrap ${error ? "auth-input-invalid" : ""}`}>
        <input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          required
        />

        <button
          className="password-toggle"
          type="button"
          onClick={onToggle}
          aria-label={`${show ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={show}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>

      {error && (
        <p className="auth-field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function AuthLayout({ mode, children }) {
  const isSignup = mode === "signup";

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About CivicSense">
        <a className="auth-brand" href="/" aria-label="CivicSense home">
          <span className="auth-brand-mark">
            <Icon name="grid" size={21} />
          </span>
          <span>
            <strong>CivicSense</strong>
            <small>CIVIC INTELLIGENCE</small>
          </span>
        </a>

        <div className="auth-story-content">
          <span className="auth-story-icon">
            <Icon name="pin" size={22} />
          </span>

          <p className="auth-story-eyebrow">
            A BETTER WAY TO CARE FOR OUR COMMUNITIES
          </p>

          <h1>
            Small reports.
            <br />
            Meaningful change.
          </h1>

          <p className="auth-story-copy">
            Bring local issues into view and help your community take the next
            step toward resolution.
          </p>

          <div className="auth-story-note">
            <span className="auth-note-check">
              <Icon name="check" size={15} />
            </span>
            <span>One shared place for civic issues and community action.</span>
          </div>
        </div>

        <p className="auth-story-footer">
          A community-focused civic issue platform
        </p>
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-brand">
          <a className="auth-brand" href="/" aria-label="CivicSense home">
            <span className="auth-brand-mark">
              <Icon name="grid" size={21} />
            </span>
            <span>
              <strong>CivicSense</strong>
              <small>CIVIC INTELLIGENCE</small>
            </span>
          </a>
        </div>

        <div className="auth-card">
          <div className="auth-card-heading">
            <span className="auth-heading-icon">
              <Icon name={isSignup ? "users" : "grid"} size={20} />
            </span>

            <p className="auth-kicker">
              {isSignup ? "JOIN YOUR COMMUNITY" : "WELCOME BACK"}
            </p>

            <h2>
              {isSignup ? "Create your account" : "Sign in to CivicSense"}
            </h2>

            <p>
              {isSignup
                ? "Get started with your community issue dashboard."
                : "Enter your details to continue to your dashboard."}
            </p>
          </div>

          {children}
        </div>

        <p className="auth-privacy-note">
          <Icon name="check" size={14} />
          Your community reports help make local issues visible.
        </p>

        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} CivicSense</span>
          <a href="/">Back to homepage</a>
        </footer>
      </section>
    </main>
  );
}

function LoginForm() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitForm(event) {
    event.preventDefault();

    if (isSubmitting) return;

    const nextErrors = {};
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      nextErrors.email = "Enter your email address.";
    } else if (!emailPattern.test(cleanEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    setErrors(nextErrors);
    setMessage("");

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      await login({
        email: cleanEmail,
        password,
      });

      window.location.replace("/dashboard");
    } catch (error) {
      setMessage(error.message || "Unable to log in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function requestPasswordReset() {
    setMessage(
      "Password reset is not available yet. Please contact your project administrator if you cannot sign in.",
    );
  }

  return (
    <AuthLayout mode="login">
      <form className="auth-form" onSubmit={submitForm} noValidate>
        <div className="auth-field">
          <label htmlFor="login-email">Email address</label>

          <input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: "" }));
              setMessage("");
            }}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            required
          />

          {errors.email && (
            <p className="auth-field-error" id="login-email-error">
              {errors.email}
            </p>
          )}
        </div>

        <PasswordField
          id="login-password"
          label="Password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: "" }));
            setMessage("");
          }}
          error={errors.password}
          autoComplete="current-password"
          show={showPassword}
          onToggle={() => setShowPassword((visible) => !visible)}
        />

        <div className="auth-form-options">
          <span />
          <button
            type="button"
            className="auth-inline-link"
            onClick={requestPasswordReset}
          >
            Forgot password?
          </button>
        </div>

        {message && (
          <p className="auth-message auth-message-info" role="alert">
            {message}
          </p>
        )}

        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Log in"}
          {!isSubmitting && <Icon name="arrow" size={17} />}
        </button>

        <p className="auth-switch">
          Don’t have an account? <a href="/signup">Sign up</a>
        </p>
      </form>
    </AuthLayout>
  );
}

function SignupForm() {
  const { signup } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitForm(event) {
    event.preventDefault();

    if (isSubmitting) return;

    const nextErrors = {};
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 80) {
      nextErrors["signup-name"] = "Name must be between 2 and 80 characters.";
    }

    if (!cleanEmail) {
      nextErrors["signup-email"] = "Enter your email address.";
    } else if (!emailPattern.test(cleanEmail)) {
      nextErrors["signup-email"] = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors["signup-password"] = "Create a password.";
    } else if (password.length < 8 || password.length > 72) {
      nextErrors["signup-password"] =
        "Password must be between 8 and 72 characters.";
    }

    if (!confirmPassword) {
      nextErrors["signup-confirm-password"] = "Confirm your password.";
    } else if (password !== confirmPassword) {
      nextErrors["signup-confirm-password"] = "Passwords do not match.";
    }

    setErrors(nextErrors);
    setMessage("");

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      await signup({
        name: cleanName,
        email: cleanEmail,
        password,
      });

      window.location.replace("/dashboard");
    } catch (error) {
      setMessage(
        error.message || "Unable to create your account. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout mode="signup">
      <form className="auth-form signup-form" onSubmit={submitForm} noValidate>
        <div className="auth-field">
          <label htmlFor="signup-name">Full name</label>

          <input
            id="signup-name"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Your full name"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setErrors((current) => ({ ...current, "signup-name": "" }));
              setMessage("");
            }}
            aria-invalid={Boolean(errors["signup-name"])}
            aria-describedby={
              errors["signup-name"] ? "signup-name-error" : undefined
            }
            required
          />

          {errors["signup-name"] && (
            <p className="auth-field-error" id="signup-name-error">
              {errors["signup-name"]}
            </p>
          )}
        </div>

        <div className="auth-field">
          <label htmlFor="signup-email">Email address</label>

          <input
            id="signup-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, "signup-email": "" }));
              setMessage("");
            }}
            aria-invalid={Boolean(errors["signup-email"])}
            aria-describedby={
              errors["signup-email"] ? "signup-email-error" : undefined
            }
            required
          />

          {errors["signup-email"] && (
            <p className="auth-field-error" id="signup-email-error">
              {errors["signup-email"]}
            </p>
          )}
        </div>

        <PasswordField
          id="signup-password"
          label="Password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({
              ...current,
              "signup-password": "",
            }));
            setMessage("");
          }}
          error={errors["signup-password"]}
          autoComplete="new-password"
          show={showPassword}
          onToggle={() => setShowPassword((visible) => !visible)}
        />

        <PasswordField
          id="signup-confirm-password"
          label="Confirm password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setErrors((current) => ({
              ...current,
              "signup-confirm-password": "",
            }));
            setMessage("");
          }}
          error={errors["signup-confirm-password"]}
          autoComplete="new-password"
          show={showConfirmPassword}
          onToggle={() => setShowConfirmPassword((visible) => !visible)}
        />

        <p className="auth-password-hint">
          Use 8–72 characters for your password.
        </p>

        {message && (
          <p className="auth-message auth-message-info" role="alert">
            {message}
          </p>
        )}

        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
          {!isSubmitting && <Icon name="arrow" size={17} />}
        </button>

        <p className="auth-switch">
          Already have an account? <a href="/login">Log in</a>
        </p>
      </form>
    </AuthLayout>
  );
}

export default function AuthPage({ mode }) {
  return mode === "signup" ? <SignupForm /> : <LoginForm />;
}
