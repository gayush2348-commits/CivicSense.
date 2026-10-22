import Icon from "./Icon.jsx";
import "./Sidebar.css";

const navigationItems = [
  { label: "Dashboard", icon: "grid" },
  { label: "All Complaints", icon: "clipboard", showCount: true },
  { label: "Incident Clusters", icon: "layers" },
  { label: "Issue Map", icon: "map" },
  { label: "Resource Allocation", icon: "users" },
  { label: "Analytics", icon: "chart" },
  { label: "Settings", icon: "settings" },
];

export default function Sidebar({
  activeSection,
  onNavigate,
  collapsed = false,
  onToggle,
  complaintCount = 0,
  userName = "CivicSense User",
  userRole = "Citizen",
}) {
  const displayName = userName?.trim() || "CivicSense User";

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a
        className="brand"
        href="#dashboard"
        onClick={(event) => {
          event.preventDefault();
          onNavigate("Dashboard");
        }}
        aria-label="CivicSense Dashboard"
      >
        <span className="brand-mark">
          <Icon name="grid" size={21} />
        </span>

        {!collapsed && (
          <span>
            <strong>CivicSense</strong>
            <small>CIVIC INTELLIGENCE</small>
          </span>
        )}
      </a>

      <div className="workspace-label">{!collapsed && "WORKSPACE"}</div>

      <nav aria-label="Main navigation">
        {navigationItems.map((item) => {
          const isActive = activeSection === item.label;

          return (
            <button
              className={`nav-item ${isActive ? "nav-item-active" : ""}`}
              key={item.label}
              type="button"
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate(item.label)}
            >
              <Icon name={item.icon} size={19} />

              {!collapsed && <span>{item.label}</span>}

              {!collapsed && item.showCount && (
                <span className="nav-count">{complaintCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <button
        className="sidebar-toggle"
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <span>{collapsed ? "›" : "‹"}</span>
        {!collapsed && <span>Collapse sidebar</span>}
      </button>

      <div className="sidebar-footer">
        <span className="avatar avatar-light">{initials || "CU"}</span>

        {!collapsed && (
          <span>
            <strong>{displayName}</strong>
            <small>{userRole}</small>
          </span>
        )}
      </div>
    </aside>
  );
}
