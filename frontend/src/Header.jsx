import { useState } from "react";
import Icon from "./Icon.jsx";
import { useAuth } from "./AuthContext.jsx";
import "./Header.css";

export default function Header({
  activeSection,
  searchQuery,
  onSearchChange,
  onReport,
  notificationsOpen,
  onToggleNotifications,
  notificationCount,
}) {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const title =
    activeSection === "Incident Details" ? "Incident details" : activeSection;

  const displayName = user?.name || "User";
  const displayRole = user?.role || "Citizen";

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U";

  async function handleLogout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setLogoutError("");

    try {
      await logout();
      window.location.replace("/login");
    } catch (error) {
      setLogoutError(error.message || "Logout failed. Please try again.");
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>Workspace</span>
        <span className="breadcrumb-separator">/</span>
        <strong>{title}</strong>
      </div>

      <div className="topbar-actions">
        <label className="global-search">
          <Icon name="search" size={17} />
          <span className="visually-hidden">
            Search complaints and locations
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search complaints, locations..."
          />
          <kbd>⌘ K</kbd>
        </label>

        <div className="notification-wrap">
          <button
            className="icon-button"
            type="button"
            aria-label={`Notifications, ${notificationCount} unread`}
            aria-expanded={notificationsOpen}
            onClick={onToggleNotifications}
          >
            <Icon name="bell" />
            {notificationCount > 0 && <span className="notification-dot" />}
          </button>

          {notificationsOpen && (
            <section className="notification-popover">
              <h2>Notifications</h2>
              <p>
                {notificationCount > 0
                  ? `${notificationCount} new reports are waiting for review.`
                  : "You are all caught up."}
              </p>
            </section>
          )}
        </div>

        <div className="profile-summary">
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <span>
            <strong>{displayName}</strong>
            <small>{displayRole}</small>
          </span>
        </div>

        <nav className="auth-nav" aria-label="Account">
          <a className="auth-nav-login" href="/dashboard">
            Dashboard
          </a>

          <button
            className="auth-nav-signup"
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </nav>

        <button
          className="button button-primary top-report-button"
          type="button"
          onClick={onReport}
        >
          <Icon name="plus" size={17} />
          Report new issue
        </button>
      </div>

      {logoutError && (
        <p className="auth-message auth-message-info" role="alert">
          {logoutError}
        </p>
      )}
    </header>
  );
}
