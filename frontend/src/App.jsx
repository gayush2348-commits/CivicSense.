import { useEffect } from "react";
import AuthPage from "./AuthPage.jsx";
import HomePage from "./HomePage.jsx";
import Icon from "./Icon.jsx";
import { useAuth } from "./AuthContext.jsx";
import "./App.css";

function WelcomePage() {
  return (
    <main className="auth-page welcome-page">
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
            Report local issues, share their location, and help bring important
            community problems to attention.
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

      <section className="auth-form-side welcome-form-side">
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

        <div className="auth-card welcome-card">
          <div className="auth-card-heading">
            <span className="auth-heading-icon">
              <Icon name="grid" size={20} />
            </span>

            <p className="auth-kicker">WELCOME TO CIVICSENSE</p>

            <h2>Make your community better.</h2>

            <p>
              Get started by creating an account or signing in to report and
              follow local civic issues.
            </p>
          </div>

          <div className="welcome-actions">
            <a className="auth-submit" href="/signup">
              Create account
              <Icon name="arrow" size={17} />
            </a>

            <a className="welcome-login-button" href="/login">
              Log in to your account
            </a>
          </div>
        </div>

        <p className="auth-privacy-note">
          <Icon name="check" size={14} />
          Your community reports help make local issues visible.
        </p>

        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} CivicSense</span>
          <span>Community. Action. Change.</span>
        </footer>
      </section>
    </main>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  const path =
    window.location.pathname.replace(/\/+$/, "").toLowerCase() || "/";

  const isLoginPage = path === "/login";
  const isSignupPage = path === "/signup";
  const isAuthPage = isLoginPage || isSignupPage;
  const isWelcomePage = path === "/";
  const isDashboardPage = path === "/dashboard";

  useEffect(() => {
    if (loading) return;

    if (user && (isAuthPage || isWelcomePage)) {
      window.location.replace("/dashboard");
    }
  }, [loading, user, isAuthPage, isWelcomePage]);

  if (loading) {
    return (
      <main className="auth-loading">
        <p>Checking your session...</p>
      </main>
    );
  }

  if (user && (isAuthPage || isWelcomePage)) {
    return null;
  }

  if (isWelcomePage) {
    return <WelcomePage />;
  }

  if (isAuthPage) {
    return <AuthPage mode={isSignupPage ? "signup" : "login"} />;
  }

  if (isDashboardPage) {
    if (!user) {
      window.location.replace("/login");
      return null;
    }

    return <HomePage />;
  }

  return (
    <main className="auth-loading">
      <h1>Page not found</h1>
      <a href="/">Back to home</a>
    </main>
  );
}
