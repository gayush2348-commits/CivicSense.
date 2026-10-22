import { useEffect, useMemo, useState } from "react";
import "./HomePage.css";
import Sidebar from "./Sidebar.jsx";
import Icon from "./Icon.jsx";
import Header from "./Header.jsx";
import ComplaintForm from "./ComplaintForm.jsx";
import {
  categories,
  complaintStatuses,
  initialClusters,
  initialResourceRecommendations,
  teams,
} from "./data/sampleData.js";

const categoryColors = {
  "Water Leakage": "blue",
  "Road Damage": "orange",
  "Pothole / Road Damage": "orange",
  Garbage: "green",
  "Garbage Accumulation": "green",
  Streetlight: "amber",
  "Broken Streetlight": "amber",
  Other: "slate",
};

const isResolvedStatus = (status) =>
  ["resolved", "closed"].includes(String(status || "").toLowerCase());

const isPendingStatus = (status) => !isResolvedStatus(status);

function normalizeComplaint(saved = {}, fallback = {}) {
  const rawLocation = saved.location;
  const locationData =
    rawLocation && typeof rawLocation === "object" ? rawLocation : {};

  const rawDescription = String(
    saved.description || fallback.description || "",
  );

  const titleMatch = rawDescription.match(/^Title:\s*(.+?)(?:\r?\n|$)/);

  const rawDate =
    saved.createdAt || saved.created_at || saved.submittedAt || saved.updatedAt;

  const parsedDate = rawDate ? new Date(rawDate) : new Date();

  const rawScore =
    saved.priorityScore ??
    saved.priority_score ??
    saved.priority?.score ??
    saved.priority_score_result ??
    null;

  const priorityScore =
    rawScore != null && Number.isFinite(Number(rawScore))
      ? Number(rawScore)
      : null;

  const factors = Array.isArray(saved.priorityFactors)
    ? saved.priorityFactors
    : Array.isArray(saved.priorityReasons)
      ? saved.priorityReasons
      : Array.isArray(saved.priority_factors)
        ? saved.priority_factors
        : [];

  const description = rawDescription
    .replace(/^Title:\s*.+?(?:\r?\n\r?\n|\r?\n|$)/, "")
    .trim();

  const rawCoordinates =
    saved.coordinates && typeof saved.coordinates === "object"
      ? saved.coordinates
      : {};

  const rawDuplicates =
    saved.duplicateCandidates ??
    saved.duplicate_candidates ??
    saved.similarComplaints ??
    saved.similar_complaints ??
    [];

  const rawCluster = saved.cluster ?? saved.clustering ?? null;

  return {
    id: String(
      saved._id ||
        saved.id ||
        saved.complaintId ||
        fallback.id ||
        `complaint-${Date.now()}`,
    ),

    title:
      saved.title ||
      titleMatch?.[1] ||
      fallback.title ||
      saved.category ||
      "Civic complaint",

    description: description || rawDescription || fallback.description || "",

    category:
      saved.predictedCategory ||
      saved.predicted_category ||
      saved.category ||
      fallback.category ||
      "Other",

    location:
      locationData.address ||
      saved.address ||
      (typeof rawLocation === "string" ? rawLocation : "") ||
      fallback.location ||
      "Location not provided",

    coordinates: {
      latitude:
        locationData.latitude ??
        saved.latitude ??
        rawCoordinates.latitude ??
        rawCoordinates.lat ??
        fallback.coordinates?.latitude ??
        null,

      longitude:
        locationData.longitude ??
        saved.longitude ??
        rawCoordinates.longitude ??
        rawCoordinates.lng ??
        fallback.coordinates?.longitude ??
        null,
    },

    severity: saved.severity || fallback.severity || "Not provided",

    priorityScore,

    status: saved.status || fallback.status || "Reported",

    submittedAt: Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString().slice(0, 10)
      : parsedDate.toISOString().slice(0, 10),

    priorityExplanation:
      saved.priorityExplanation ||
      saved.priority_explanation ||
      saved.priority?.explanation ||
      "",

    priorityFactors: factors,

    recommendedAction:
      saved.recommendedAction ||
      saved.recommended_action ||
      saved.priority?.recommendedAction ||
      "",

    assignedTeam:
      saved.assignedDepartment ||
      saved.assignedTeam ||
      saved.assigned_team ||
      "",

    imageFileName: fallback.imageFileName || "",

    imageUrl:
      saved.imageUrl ||
      saved.image_url ||
      saved.image?.url ||
      saved.image?.secure_url ||
      "",

    confidence: saved.confidence ?? null,

    // Preserve ML fields returned by the backend.
    recommendedDepartment:
      saved.recommendedDepartment ||
      saved.recommended_department ||
      saved.assignedDepartment ||
      "",

    duplicateCandidates: Array.isArray(rawDuplicates) ? rawDuplicates : [],

    cluster: rawCluster && typeof rawCluster === "object" ? rawCluster : null,
  };
}

function StatusBadge({ status }) {
  const statusClass = String(status || "Reported")
    .toLowerCase()
    .replaceAll(" ", "-");

  return (
    <span className={`status-badge status-${statusClass}`}>
      {status || "Reported"}
    </span>
  );
}

function PriorityBadge({ score }) {
  if (score == null || !Number.isFinite(Number(score))) {
    return <span className="priority-badge priority-low">Not scored</span>;
  }

  const numericScore = Number(score);
  const priorityClass =
    numericScore >= 80 ? "high" : numericScore >= 60 ? "medium" : "low";

  const label =
    numericScore >= 80 ? "High" : numericScore >= 60 ? "Medium" : "Low";

  return (
    <span className={`priority-badge priority-${priorityClass}`}>{label}</span>
  );
}

function SummaryCard({ icon, label, value, note, tone, onClick }) {
  return (
    <button
      className={`metric-card metric-${tone}`}
      type="button"
      onClick={onClick}
    >
      <span className="metric-top">
        <span className={`metric-icon icon-${tone}`}>
          <Icon name={icon} size={19} />
        </span>
        <span className="metric-note">{note}</span>
      </span>

      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>

      <span className="metric-link">
        View complaints <Icon name="arrow" size={14} />
      </span>
    </button>
  );
}

function SummaryCards({ complaints, onMetricClick }) {
  const metrics = [
    {
      label: "Total Complaints",
      value: complaints.length,
      note: "All reported issues",
      tone: "navy",
      icon: "clipboard",
      filter: {},
    },
    {
      label: "Pending Issues",
      value: complaints.filter((item) => isPendingStatus(item.status)).length,
      note: "Awaiting resolution",
      tone: "teal",
      icon: "clock",
      filter: { status: "pending" },
    },
    {
      label: "High-Priority Incidents",
      value: complaints.filter(
        (item) => item.priorityScore != null && item.priorityScore >= 80,
      ).length,
      note: "Needs attention",
      tone: "orange",
      icon: "layers",
      filter: { priority: "High" },
    },
    {
      label: "Resolved Issues",
      value: complaints.filter((item) => isResolvedStatus(item.status)).length,
      note: "Resolved or closed",
      tone: "green",
      icon: "check",
      filter: { status: "Resolved" },
    },
  ];

  return (
    <section className="metrics-grid" aria-label="Complaint summary">
      {metrics.map((metric) => (
        <SummaryCard
          key={metric.label}
          {...metric}
          onClick={() => onMetricClick(metric.filter)}
        />
      ))}
    </section>
  );
}

function SectionHeading({ eyebrow, title, action, onAction }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>

      {action && (
        <button className="text-button" type="button" onClick={onAction}>
          {action}
          <Icon name="arrow" size={15} />
        </button>
      )}
    </div>
  );
}

function PriorityIssues({ complaints, onViewDetails, onViewAll }) {
  const priorityComplaints = [...complaints]
    .filter(
      (item) =>
        item.priorityScore != null &&
        Number.isFinite(Number(item.priorityScore)),
    )
    .sort((a, b) => Number(b.priorityScore) - Number(a.priorityScore))
    .slice(0, 3);

  return (
    <section className="panel priority-panel">
      <SectionHeading
        eyebrow="SAVED PRIORITY SCORES"
        title="Priority issues"
        action="View all"
        onAction={onViewAll}
      />

      {priorityComplaints.length === 0 ? (
        <p className="empty-state">No scored priority issues available yet.</p>
      ) : (
        <div className="priority-list">
          {priorityComplaints.map((complaint, index) => (
            <article className="priority-item" key={complaint.id}>
              <span className={`priority-number priority-number-${index + 1}`}>
                0{index + 1}
              </span>

              <div className="priority-content">
                <div className="priority-title-row">
                  <h3>{complaint.title}</h3>
                  <span className="score">
                    {complaint.priorityScore}
                    <small>/100</small>
                  </span>
                </div>

                <div className="priority-meta">
                  <span
                    className={`category-label category-${categoryColors[complaint.category] || "slate"}`}
                  >
                    {complaint.category}
                  </span>

                  <span>
                    <Icon name="pin" size={14} />
                    {complaint.location}
                  </span>

                  <PriorityBadge score={complaint.priorityScore} />
                </div>

                <p className="priority-explanation">
                  {complaint.priorityExplanation ||
                    "No priority explanation provided."}
                </p>

                <p className="recommended-action">
                  <strong>Recommended:</strong>{" "}
                  {complaint.recommendedAction || "No action recommendation"}
                </p>
              </div>

              <button
                className="button button-secondary priority-view"
                type="button"
                onClick={() => onViewDetails(complaint.id)}
              >
                View details
              </button>
            </article>
          ))}
        </div>
      )}

      <p className="demo-note">
        <Icon name="sparkle" size={15} />
        Only priority scores returned by the backend are displayed.
      </p>
    </section>
  );
}

function ComplaintsTable({
  complaints,
  searchQuery,
  filters,
  onFiltersChange,
  onViewDetails,
  onViewAll,
}) {
  const filteredComplaints = complaints.filter((complaint) => {
    const query = searchQuery.trim().toLowerCase();

    const matchesSearch =
      !query ||
      [
        complaint.id,
        complaint.title,
        complaint.description,
        complaint.location,
        complaint.category,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      );

    const matchesCategory =
      !filters.category || complaint.category === filters.category;

    const score = complaint.priorityScore;

    const matchesPriority =
      !filters.priority ||
      (filters.priority === "High"
        ? score != null && Number(score) >= 80
        : score == null || Number(score) < 80);

    const matchesStatus =
      !filters.status ||
      (filters.status === "pending"
        ? isPendingStatus(complaint.status)
        : complaint.status === filters.status);

    return matchesSearch && matchesCategory && matchesPriority && matchesStatus;
  });

  function updateFilter(name, value) {
    onFiltersChange({ ...filters, [name]: value });
  }

  return (
    <section className="panel complaints-panel">
      <SectionHeading
        title="Recent complaints"
        action="View all complaints"
        onAction={onViewAll}
      />

      <div className="filters-row">
        <label className="filter-control">
          <span>Category</span>
          <select
            value={filters.category}
            onChange={(event) => updateFilter("category", event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-control">
          <span>Priority</span>
          <select
            value={filters.priority}
            onChange={(event) => updateFilter("priority", event.target.value)}
          >
            <option value="">All priorities</option>
            <option value="High">High priority</option>
            <option value="Low">Medium / low / not scored</option>
          </select>
        </label>

        <label className="filter-control">
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="">All statuses</option>
            {complaintStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
            <option value="pending">Pending issues</option>
          </select>
        </label>

        <span className="result-count">
          {filteredComplaints.length} results
        </span>
      </div>

      <div className="table-scroll">
        <table className="complaints-table">
          <thead>
            <tr>
              <th scope="col">Complaint ID</th>
              <th scope="col">Issue</th>
              <th scope="col">Category</th>
              <th scope="col">Location</th>
              <th scope="col">Priority</th>
              <th scope="col">Status</th>
              <th scope="col">Reported date</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredComplaints.map((complaint) => (
              <tr key={complaint.id}>
                <td className="complaint-id">{complaint.id}</td>

                <td className="issue-cell">
                  <strong>{complaint.title}</strong>
                  <small>{complaint.id}</small>
                </td>

                <td>
                  <span
                    className={`category-label category-${categoryColors[complaint.category] || "slate"}`}
                  >
                    {complaint.category}
                  </span>
                </td>

                <td>
                  <span className="location-cell">
                    <Icon name="pin" size={14} />
                    {complaint.location}
                  </span>
                </td>

                <td>
                  <span className="table-priority">
                    <PriorityBadge score={complaint.priorityScore} />
                    <small>
                      {complaint.priorityScore == null
                        ? "Not scored"
                        : `${complaint.priorityScore}/100`}
                    </small>
                  </span>
                </td>

                <td>
                  <StatusBadge status={complaint.status} />
                </td>

                <td>{complaint.submittedAt}</td>

                <td>
                  <button
                    className="row-action"
                    type="button"
                    onClick={() => onViewDetails(complaint.id)}
                    aria-label={`View details for ${complaint.id}`}
                  >
                    ···
                  </button>
                </td>
              </tr>
            ))}

            {filteredComplaints.length === 0 && (
              <tr>
                <td className="table-empty" colSpan="8">
                  {complaints.length === 0
                    ? "No complaints found yet. Submit a report to get started."
                    : "No complaints match these filters. Try changing or clearing your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IncidentDetails({
  complaint,
  complaints,
  clusters,
  onStatusChange,
  onTeamChange,
  onBack,
}) {
  if (!complaint) {
    return (
      <section className="panel">
        <h2>Incident not found</h2>
        <button
          className="button button-secondary"
          type="button"
          onClick={onBack}
        >
          Go back
        </button>
      </section>
    );
  }

  const cluster = clusters.find((item) =>
    item.complaintIds?.includes(complaint.id),
  );

  const relatedComplaints = cluster
    ? complaints.filter(
        (item) =>
          item.id !== complaint.id && cluster.complaintIds.includes(item.id),
      )
    : [];

  return (
    <section className="detail-layout">
      <div className="panel detail-main">
        <button
          className="text-button detail-back"
          type="button"
          onClick={onBack}
        >
          ← Back to complaints
        </button>

        <div className="detail-title-row">
          <div>
            <p className="eyebrow">
              {complaint.id} · REPORTED {complaint.submittedAt}
            </p>
            <h2>{complaint.title}</h2>
          </div>
          <PriorityBadge score={complaint.priorityScore} />
        </div>

        <p className="detail-description">{complaint.description}</p>

        <dl className="detail-facts">
          <div>
            <dt>Category</dt>
            <dd>{complaint.category}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{complaint.location}</dd>
          </div>
          <div>
            <dt>Coordinates</dt>
            <dd>
              {complaint.coordinates?.latitude ?? "Not provided"},{" "}
              {complaint.coordinates?.longitude ?? "Not provided"}
            </dd>
          </div>
          <div>
            <dt>Severity</dt>
            <dd>{complaint.severity || "Not provided"}</dd>
          </div>
          <div>
            <dt>Priority score</dt>
            <dd>
              {complaint.priorityScore == null
                ? "Not scored"
                : `${complaint.priorityScore} / 100`}
            </dd>
          </div>
          <div>
            <dt>Assigned team</dt>
            <dd>{complaint.assignedTeam || "Not assigned"}</dd>
          </div>
        </dl>

        {complaint.imageUrl && (
          <div className="detail-section">
            <h3>Attached photo</h3>
            <a href={complaint.imageUrl} target="_blank" rel="noreferrer">
              View uploaded image
            </a>
          </div>
        )}

        <div className="detail-section">
          <h3>Priority explanation</h3>
          <p>
            {complaint.priorityExplanation ||
              "No explanation provided by the backend."}
          </p>

          {complaint.priorityFactors.length > 0 && (
            <ul>
              {complaint.priorityFactors.map((factor, index) => (
                <li key={`${factor}-${index}`}>{String(factor)}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="detail-section">
          <h3>Recommended action</h3>
          <p>{complaint.recommendedAction || "No recommendation provided."}</p>
        </div>

        <div className="detail-section">
          <h3>ML analysis</h3>
          <p>
            Recommended department:{" "}
            {complaint.recommendedDepartment || "Not provided"}
          </p>
          <p>
            Possible duplicate matches: {complaint.duplicateCandidates.length}
          </p>
        </div>

        <div className="detail-section">
          <h3>Related reports</h3>
          {relatedComplaints.length > 0 ? (
            <ul>
              {relatedComplaints.map((item) => (
                <li key={item.id}>
                  {item.id} · {item.title}
                </li>
              ))}
            </ul>
          ) : (
            <p>No linked reports available for this incident.</p>
          )}
        </div>

        {complaint.imageFileName && (
          <p className="demo-note">
            Uploaded attachment: {complaint.imageFileName}
          </p>
        )}
      </div>

      <aside className="panel detail-controls">
        <h3>Incident controls</h3>

        <label className="form-field">
          <span>Current status</span>
          <select
            value={complaint.status}
            onChange={(event) =>
              onStatusChange(complaint.id, event.target.value)
            }
          >
            {complaintStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Assigned team</span>
          <select
            value={complaint.assignedTeam || ""}
            onChange={(event) => onTeamChange(complaint.id, event.target.value)}
          >
            <option value="">Unassigned</option>
            {teams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </label>

        <StatusBadge status={complaint.status} />

        <p className="demo-note">
          Status and team changes are local to this page. They are not saved to
          the database because no update request is connected here.
        </p>
      </aside>
    </section>
  );
}

function InsightItem({ icon, tone, title, description, onReview }) {
  return (
    <article className="insight-item">
      <span className={`insight-icon insight-${tone}`}>
        <Icon name={icon} />
      </span>

      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <button className="text-button" type="button" onClick={onReview}>
        Review
        <Icon name="arrow" size={14} />
      </button>
    </article>
  );
}

function Insights({ complaints, onReview }) {
  const total = complaints.length;

  const resolved = complaints.filter((item) =>
    isResolvedStatus(item.status),
  ).length;

  const pending = complaints.filter((item) =>
    isPendingStatus(item.status),
  ).length;

  const categoryCounts = complaints.reduce((counts, item) => {
    const category = item.category || "Other";
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});

  const topCategory = Object.entries(categoryCounts).sort(
    (a, b) => b[1] - a[1],
  )[0];

  const locationCounts = complaints.reduce((counts, item) => {
    const location = String(item.location || "").trim();

    if (location && location.toLowerCase() !== "location not provided") {
      const key = location.toLowerCase();

      if (!counts[key]) {
        counts[key] = { label: location, count: 0 };
      }

      counts[key].count += 1;
    }

    return counts;
  }, {});

  const repeatedLocation = Object.values(locationCounts)
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count)[0];

  const scoredComplaints = complaints
    .filter(
      (item) =>
        item.priorityScore != null &&
        Number.isFinite(Number(item.priorityScore)),
    )
    .sort((a, b) => Number(b.priorityScore) - Number(a.priorityScore));

  const highestPriority = scoredComplaints[0];

  const duplicateReports = complaints.filter(
    (item) => item.duplicateCandidates.length > 0,
  ).length;

  const departmentCounts = complaints.reduce((counts, item) => {
    const department = item.recommendedDepartment;

    if (department) {
      counts[department] = (counts[department] || 0) + 1;
    }

    return counts;
  }, {});

  const topDepartment = Object.entries(departmentCounts).sort(
    (a, b) => b[1] - a[1],
  )[0];

  const insights = [];

  if (total > 0 && topCategory) {
    insights.push({
      title: "Most reported issue",
      description: `${topCategory[0]} appears in ${topCategory[1]} of ${total} loaded complaints.`,
      icon: "layers",
      tone: "blue",
    });
  }

  if (total > 0) {
    const resolutionRate = Math.round((resolved / total) * 100);

    insights.push({
      title: "Resolution overview",
      description: `${resolved} resolved or closed, ${pending} still open. Resolution rate: ${resolutionRate}%.`,
      icon: "check",
      tone: "green",
    });
  }

  if (repeatedLocation) {
    insights.push({
      title: "Recurring location",
      description: `${repeatedLocation.label} appears in ${repeatedLocation.count} reports. Review the location for recurring issues.`,
      icon: "pin",
      tone: "amber",
    });
  }

  if (highestPriority) {
    insights.push({
      title: "Priority alert",
      description: `${highestPriority.title} has a saved priority score of ${highestPriority.priorityScore}/100. ${
        highestPriority.priorityExplanation ||
        highestPriority.recommendedAction ||
        "Review the report to decide the next response."
      }`,
      icon: "sparkle",
      tone: "orange",
    });
  }

  if (topDepartment) {
    insights.push({
      title: "Department recommendation trend",
      description: `${topDepartment[0]} is recommended for ${topDepartment[1]} loaded complaints, based on department fields returned by the backend.`,
      icon: "layers",
      tone: "blue",
    });
  }

  if (duplicateReports > 0) {
    insights.push({
      title: "Possible duplicate reports",
      description: `The backend returned possible duplicate matches for ${duplicateReports} complaints. Review the matches before treating them as confirmed duplicates.`,
      icon: "layers",
      tone: "amber",
    });
  }

  return (
    <section className="panel insights-panel">
      <SectionHeading
        eyebrow="LIVE COMPLAINT DATA · SAVED ML RESULTS"
        title="Civic intelligence insights"
        action="Review insights"
        onAction={onReview}
      />

      {insights.length > 0 ? (
        <div className="insight-list">
          {insights.map((insight) => (
            <InsightItem key={insight.title} {...insight} onReview={onReview} />
          ))}
        </div>
      ) : (
        <p className="empty-state">
          No insights are available yet. Submit a complaint to start building
          live analytics.
        </p>
      )}

      <p className="demo-note">
        Complaint patterns are calculated from loaded records. AI-related
        insights appear only when the backend returns corresponding analysis
        fields. These results do not independently confirm duplicates or
        geographic hotspots.
      </p>
    </section>
  );
}

function Analytics({ complaints, onViewDetails }) {
  const total = complaints.length;

  const resolved = complaints.filter((item) =>
    isResolvedStatus(item.status),
  ).length;

  const pending = complaints.filter((item) =>
    isPendingStatus(item.status),
  ).length;

  const scored = complaints.filter((item) => item.priorityScore != null);

  const highPriority = scored.filter((item) => item.priorityScore >= 80);

  const categoriesByCount = Object.entries(
    complaints.reduce((counts, item) => {
      const category = item.category || "Other";
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const maxCategoryCount = Math.max(
    1,
    ...categoriesByCount.map(([, count]) => count),
  );

  const statuses = Object.entries(
    complaints.reduce((counts, item) => {
      const status = item.status || "Reported";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const averagePriority = scored.length
    ? Math.round(
        scored.reduce((sum, item) => sum + item.priorityScore, 0) /
          scored.length,
      )
    : null;

  return (
    <div className="analytics-view">
      <section className="metrics-grid" aria-label="Analytics summary">
        <SummaryCard
          label="Total Complaints"
          value={total}
          note="Loaded records"
          tone="navy"
          icon="clipboard"
          onClick={() => {}}
        />
        <SummaryCard
          label="Open Issues"
          value={pending}
          note="Not resolved or closed"
          tone="teal"
          icon="clock"
          onClick={() => {}}
        />
        <SummaryCard
          label="High Priority"
          value={highPriority.length}
          note="Score 80 or above"
          tone="orange"
          icon="layers"
          onClick={() => {}}
        />
        <SummaryCard
          label="Resolution Rate"
          value={`${total ? Math.round((resolved / total) * 100) : 0}%`}
          note={`${resolved} resolved or closed`}
          tone="green"
          icon="check"
          onClick={() => {}}
        />
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="REAL COMPLAINT RECORDS"
          title="Category distribution"
        />

        {categoriesByCount.length === 0 ? (
          <p className="empty-state">No category data available yet.</p>
        ) : (
          <div className="insight-list">
            {categoriesByCount.map(([category, count]) => (
              <div className="insight-item" key={category}>
                <span
                  className={`insight-icon insight-${categoryColors[category] || "blue"}`}
                >
                  <Icon name="layers" />
                </span>
                <div>
                  <h3>{category}</h3>
                  <p>
                    {count} complaint{count === 1 ? "" : "s"} ·{" "}
                    {Math.round((count / total) * 100)}% of loaded reports
                  </p>
                  <div
                    style={{
                      height: "6px",
                      width: "100%",
                      marginTop: "8px",
                      overflow: "hidden",
                      borderRadius: "99px",
                      background: "var(--border-color, #e5e7eb)",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(count / maxCategoryCount) * 100}%`,
                        borderRadius: "99px",
                        background: "var(--accent-color, #0f766e)",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="WORKLOAD BREAKDOWN"
          title="Status distribution"
        />

        {statuses.length === 0 ? (
          <p className="empty-state">No status data available yet.</p>
        ) : (
          <div className="insight-list">
            {statuses.map(([status, count]) => (
              <div className="insight-item" key={status}>
                <span className="insight-icon insight-blue">
                  <Icon name="clipboard" />
                </span>
                <div>
                  <h3>{status}</h3>
                  <p>
                    {count} complaint{count === 1 ? "" : "s"} ·{" "}
                    {Math.round((count / total) * 100)}% of loaded reports
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <SectionHeading
          eyebrow="BACKEND-PROVIDED SCORES"
          title="Priority analysis"
        />

        <div className="detail-facts">
          <div>
            <dt>Scored complaints</dt>
            <dd>
              {scored.length} / {total}
            </dd>
          </div>
          <div>
            <dt>Average saved score</dt>
            <dd>
              {averagePriority == null
                ? "Not available"
                : `${averagePriority}/100`}
            </dd>
          </div>
          <div>
            <dt>High-priority complaints</dt>
            <dd>{highPriority.length}</dd>
          </div>
        </div>

        {highPriority.length > 0 ? (
          <div className="priority-list">
            {[...highPriority]
              .sort((a, b) => b.priorityScore - a.priorityScore)
              .slice(0, 5)
              .map((item) => (
                <article className="priority-item" key={item.id}>
                  <div className="priority-content">
                    <div className="priority-title-row">
                      <h3>{item.title}</h3>
                      <span className="score">
                        {item.priorityScore}
                        <small>/100</small>
                      </span>
                    </div>
                    <p>
                      {item.priorityExplanation || "No explanation provided."}
                    </p>
                  </div>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => onViewDetails(item.id)}
                  >
                    View details
                  </button>
                </article>
              ))}
          </div>
        ) : (
          <p className="empty-state">
            No high-priority scores are available in the loaded records.
          </p>
        )}

        <p className="demo-note">
          These analytics describe the records returned by the API. They do not
          imply that a separate ML clustering or hotspot algorithm ran.
        </p>
      </section>
    </div>
  );
}

function Settings() {
  return (
    <section className="panel settings-panel">
      <span className="metric-icon icon-teal">
        <Icon name="settings" />
      </span>
      <h2>Settings</h2>
      <p>Administrative preferences can be added here in a future iteration.</p>
    </section>
  );
}

function HomePage() {
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(true);
  const [complaintsError, setComplaintsError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [recommendations, setRecommendations] = useState(
    initialResourceRecommendations,
  );

  const [activeSection, setActiveSection] = useState("Dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  const [filters, setFilters] = useState({
    category: "",
    priority: "",
    status: "",
  });

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedComplaintId, setSelectedComplaintId] = useState("");
  const [previousSection, setPreviousSection] = useState("Dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const clusters = initialClusters;

  useEffect(() => {
    const controller = new AbortController();

    async function loadComplaints() {
      setComplaintsLoading(true);
      setComplaintsError("");

      try {
        const response = await fetch("/api/complaints", {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
          if (response.status === 401 || response.status === 403) {
            throw new Error("Session expired. Please log in again.");
          }

          throw new Error(
            data.message || `Unable to load complaints (${response.status}).`,
          );
        }

        const records =
          data.complaints ??
          data.data?.complaints ??
          data.data ??
          data.results ??
          data.reports;

        if (!Array.isArray(records)) {
          throw new Error(
            "Unexpected API response. Check the GET /api/complaints response format.",
          );
        }

        setComplaints(records.map((record) => normalizeComplaint(record)));
      } catch (error) {
        if (error.name !== "AbortError") {
          setComplaintsError(
            error.message || "Something went wrong while loading complaints.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setComplaintsLoading(false);
        }
      }
    }

    loadComplaints();

    return () => controller.abort();
  }, [refreshKey]);

  const selectedComplaint = complaints.find(
    (complaint) => complaint.id === selectedComplaintId,
  );

  const notificationCount = complaints.filter((complaint) =>
    ["reported", "under review"].includes(
      String(complaint.status || "").toLowerCase(),
    ),
  ).length;

  const today = new Intl.DateTimeFormat("en", {
    dateStyle: "full",
  }).format(new Date());

  const descriptions = useMemo(
    () => ({
      Dashboard:
        "Monitor civic issues, understand priorities, and coordinate resolutions.",
      "All Complaints":
        "Review, search, and manage reports submitted by your community.",
      "Incident Clusters":
        "Explore predefined groups of related reports and suggested actions.",
      "Issue Map": "Explore incident locations and recurring hotspots.",
      "Resource Allocation":
        "Coordinate recommended field teams and equipment.",
      Analytics:
        "Understand complaint categories, priority scores, and resolution progress.",
      Settings: "Manage dashboard preferences.",
    }),
    [],
  );

  function openDetails(complaintId) {
    setPreviousSection(activeSection);
    setSelectedComplaintId(complaintId);
    setActiveSection("Incident Details");
    setSuccessMessage("");
  }

  function openComplaints(nextFilters = {}) {
    setFilters({ category: "", priority: "", status: "", ...nextFilters });
    setActiveSection("All Complaints");
    setShowComplaintForm(false);
    setSuccessMessage("");
  }

  function addComplaint(values) {
    const saved = values.serverComplaint || {};

    const complaint = normalizeComplaint(saved, {
      id: `local-${Date.now()}`,
      title: values.title,
      description: values.description,
      category: values.category,
      location: values.location,
      severity: values.severity,
      status: "Reported",
      imageFileName: values.imageFileName || "",
    });

    setComplaints((current) => [
      complaint,
      ...current.filter((item) => item.id !== complaint.id),
    ]);

    setShowComplaintForm(false);
    setActiveSection("Dashboard");
    setSuccessMessage(`Complaint ${complaint.id} submitted successfully.`);
    setSelectedComplaintId(complaint.id);
  }

  function updateStatus(complaintId, status) {
    setComplaints((current) =>
      current.map((complaint) =>
        complaint.id === complaintId ? { ...complaint, status } : complaint,
      ),
    );
  }

  function updateAssignedTeam(complaintId, team) {
    setComplaints((current) =>
      current.map((complaint) =>
        complaint.id === complaintId
          ? { ...complaint, assignedTeam: team }
          : complaint,
      ),
    );

    setRecommendations((current) =>
      current.map((item) =>
        item.incidentId === complaintId
          ? {
              ...item,
              recommendedTeam: team,
              assignmentStatus: team ? "Assigned" : "Suggested",
            }
          : item,
      ),
    );
  }

  function navigate(section) {
    setActiveSection(section);
    setShowComplaintForm(false);
    setSuccessMessage("");
  }

  function requestReportForm() {
    setSuccessMessage("");
    setShowComplaintForm(true);
  }

  function renderSection() {
    if (activeSection === "Incident Details") {
      return (
        <IncidentDetails
          complaint={selectedComplaint}
          complaints={complaints}
          clusters={clusters}
          onStatusChange={updateStatus}
          onTeamChange={updateAssignedTeam}
          onBack={() => setActiveSection(previousSection)}
        />
      );
    }

    if (activeSection === "All Complaints") {
      return (
        <ComplaintsTable
          complaints={complaints}
          searchQuery={searchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          onViewDetails={openDetails}
          onViewAll={() =>
            setFilters({ category: "", priority: "", status: "" })
          }
        />
      );
    }

    if (activeSection === "Incident Clusters") return null;
    if (activeSection === "Issue Map") return null;
    if (activeSection === "Resource Allocation") return null;

    if (activeSection === "Analytics") {
      return <Analytics complaints={complaints} onViewDetails={openDetails} />;
    }

    if (activeSection === "Settings") return <Settings />;

    return (
      <>
        <SummaryCards complaints={complaints} onMetricClick={openComplaints} />

        <div className="dashboard-columns">
          <PriorityIssues
            complaints={complaints}
            onViewDetails={openDetails}
            onViewAll={() => openComplaints()}
          />

          <Insights
            complaints={complaints}
            onReview={() => navigate("Analytics")}
          />
        </div>

        <ComplaintsTable
          complaints={complaints}
          searchQuery={searchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          onViewDetails={openDetails}
          onViewAll={() => openComplaints()}
        />
      </>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeSection={activeSection}
        onNavigate={navigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        complaintCount={complaints.length}
      />

      <div className="workspace">
        <Header
          activeSection={activeSection}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onReport={requestReportForm}
          notificationsOpen={notificationsOpen}
          onToggleNotifications={() => setNotificationsOpen((value) => !value)}
          notificationCount={notificationCount}
        />

        <main className="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">CIVIC OPERATIONS / OVERVIEW</p>

              <h1>
                {activeSection === "Dashboard"
                  ? "Civic Intelligence Dashboard"
                  : activeSection}
              </h1>

              <p>
                {descriptions[activeSection] ||
                  "Review incident information and coordinate the response."}
              </p>
            </div>

            <span className="date-label">
              <Icon name="clock" size={16} />
              {today}
            </span>
          </div>

          {successMessage && (
            <div className="success-banner" role="status">
              <Icon name="check" />
              {successMessage}

              <button
                type="button"
                onClick={() => setSuccessMessage("")}
                aria-label="Dismiss success message"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}

          {complaintsLoading && (
            <div className="demo-note" role="status">
              <Icon name="clock" size={16} />
              Loading complaints from the server...
            </div>
          )}

          {complaintsError && (
            <div className="panel" role="alert">
              <h2>Could not load complaints</h2>
              <p>{complaintsError}</p>

              <button
                className="button button-secondary"
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {!complaintsLoading && !complaintsError && renderSection()}
        </main>
      </div>

      {showComplaintForm && (
        <ComplaintForm
          onSubmit={addComplaint}
          onCancel={() => setShowComplaintForm(false)}
        />
      )}
    </div>
  );
}

export default HomePage;
