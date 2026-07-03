"use client";

import { useEffect, useState } from "react";

interface Service {
  id: string;
  supportedFunction: string;
  vendor: {
    legalName: string;
  };
}

interface Incident {
  id: string;
  serviceId: string;
  title: string;
  severity: "MINOR" | "MAJOR" | "CRITICAL";
  description: string;
  incidentDate: string;
  downtimeMinutes: number;
  status: "ACTIVE" | "RESOLVED";
  remediationAction: string | null;
  service: Service;
}

type IncidentSeverity = Incident["severity"];
type IncidentStatus = Incident["status"];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form State
  const [editId, setEditId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<"MINOR" | "MAJOR" | "CRITICAL">("MINOR");
  const [description, setDescription] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [downtimeMinutes, setDowntimeMinutes] = useState(0);
  const [status, setStatus] = useState<"ACTIVE" | "RESOLVED">("ACTIVE");
  const [remediationAction, setRemediationAction] = useState("");

  const loadData = async () => {
    try {
      const res = await fetch("/api/incidents");
      const data = await res.json();
      if (data.success) {
        setIncidents(data.incidents);
        setServices(data.services);
      }
    } catch (err) {
      console.error("Failed to load incidents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenNewForm = () => {
    setEditId(null);
    setServiceId(services[0]?.id || "");
    setTitle("");
    setSeverity("MINOR");
    setDescription("");
    setIncidentDate(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:MM
    setDowntimeMinutes(0);
    setStatus("ACTIVE");
    setRemediationAction("");
    setShowForm(true);
    setMessage(null);
  };

  const handleOpenEditForm = (inc: Incident) => {
    setEditId(inc.id);
    setServiceId(inc.serviceId);
    setTitle(inc.title);
    setSeverity(inc.severity);
    setDescription(inc.description);
    setIncidentDate(new Date(inc.incidentDate).toISOString().slice(0, 16));
    setDowntimeMinutes(inc.downtimeMinutes);
    setStatus(inc.status);
    setRemediationAction(inc.remediationAction || "");
    setShowForm(true);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editId,
          serviceId,
          title,
          severity,
          description,
          incidentDate: new Date(incidentDate).toISOString(),
          downtimeMinutes,
          status,
          remediationAction: remediationAction || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage(editId ? "✓ Incident report successfully updated." : "✓ New service outage incident logged.");
        await loadData();
        setShowForm(false);
      } else {
        setMessage("❌ Failed to save incident: " + data.error);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Network error saving incident log.");
    } finally {
      setSaving(false);
    }
  };

  // Stats calculation
  const totalIncidents = incidents.length;
  const activeIncidents = incidents.filter((i) => i.status === "ACTIVE").length;
  const totalDowntime = incidents.reduce((sum, i) => sum + i.downtimeMinutes, 0);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="page-title">Operational Outage & Incident Log</h1>
          <p className="page-subtitle">
            Log and review operational ICT outages, track restoration timelines, and document remediation audits under DORA Article 17.
          </p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={handleOpenNewForm}>
            + Log Incident
          </button>
        )}
      </div>

      {message && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "4px",
            backgroundColor: message.startsWith("✓") ? "rgba(20, 184, 166, 0.08)" : "rgba(239, 68, 68, 0.08)",
            border: message.startsWith("✓") ? "1px solid rgba(20, 184, 166, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)",
            color: message.startsWith("✓") ? "var(--color-brand)" : "var(--color-error)",
            fontSize: "0.85rem",
            fontWeight: 500,
            marginBottom: "1.5rem",
          }}
        >
          {message}
        </div>
      )}

      {/* Grid containing Form OR Stats + List */}
      {showForm ? (
        <div className="card" style={{ maxWidth: "700px", margin: "0 auto" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <h2 style={{ fontSize: "1.2rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem", margin: 0 }}>
              {editId ? "Update Incident Manifest" : "Log Service Outage / Incident"}
            </h2>

            <div className="form-group">
              <label className="form-label">Affected ICT Service</label>
              <select
                className="form-control"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.vendor.legalName} &mdash; {s.supportedFunction}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Incident Headline / Title</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="e.g. Primary DB node replication lag spikes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Incident Start Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  required
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Total Downtime (Minutes)</label>
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  value={downtimeMinutes}
                  onChange={(e) => setDowntimeMinutes(parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Incident Severity</label>
                <select
                  className="form-control"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                >
                  <option value="MINOR">MINOR (Local latency / no SLA breach)</option>
                  <option value="MAJOR">MAJOR (Degraded performance / SLA warning)</option>
                  <option value="CRITICAL">CRITICAL (Total service outage / ledger frozen)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Resolution Status</label>
                <select
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                >
                  <option value="ACTIVE">ACTIVE / INVESTIGATING</option>
                  <option value="RESOLVED">RESOLVED / STABLE</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Outage Details & Diagnosis</label>
              <textarea
                className="form-control"
                style={{ minHeight: "100px", fontFamily: "inherit" }}
                required
                placeholder="Detail the technical parameters of the failure, error codes, and immediate operational impact."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Remediation Action & Resolution Log</label>
              <textarea
                className="form-control"
                style={{ minHeight: "80px", fontFamily: "inherit" }}
                placeholder="Enter actions taken to resolve, root-cause fixes, or post-incident review tasks."
                value={remediationAction}
                onChange={(e) => setRemediationAction(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Incident Report"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Stats Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase" }}>Total Outages logged</span>
                <strong style={{ fontSize: "2rem", fontWeight: 700 }}>{totalIncidents}</strong>
              </div>
              <span className="badge warning" style={{ padding: "0.4rem 0.6rem" }}>SLA Audited</span>
            </div>

            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase" }}>Active Incidents</span>
                <strong style={{ fontSize: "2rem", fontWeight: 700, color: activeIncidents > 0 ? "var(--color-error)" : "var(--color-brand)" }}>
                  {activeIncidents}
                </strong>
              </div>
              {activeIncidents > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="pulse-red" />
                  <span style={{ fontSize: "0.7rem", color: "var(--color-error)", fontWeight: 700, textTransform: "uppercase" }}>ACTIVE OUTAGE</span>
                </div>
              ) : (
                <span className="badge success">All Systems Nominal</span>
              )}
            </div>

            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase" }}>Accumulated Downtime</span>
                <strong style={{ fontSize: "2rem", fontWeight: 700 }}>{totalDowntime} <span style={{ fontSize: "0.95rem", fontWeight: 500, color: "var(--text-muted)" }}>min</span></strong>
              </div>
              <span className="badge non-critical">SLA Target &gt;99.9%</span>
            </div>
          </div>

          {/* List of Incidents */}
          <div className="card">
            <h2 style={{ fontSize: "1.2rem", marginBottom: "1.25rem" }}>Timeline & Incident Logs</h2>
            {incidents.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                No incident logs found. All systems are nominal.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {incidents.map((inc) => {
                  let sevClass = "badge info";
                  if (inc.severity === "CRITICAL") sevClass = "badge danger";
                  else if (inc.severity === "MAJOR") sevClass = "badge warning";

                  return (
                    <div
                      key={inc.id}
                      style={{
                        padding: "1.25rem",
                        borderRadius: "6px",
                        backgroundColor: inc.status === "ACTIVE" ? "rgba(239, 68, 68, 0.03)" : "rgba(22, 28, 41, 0.2)",
                        border: inc.status === "ACTIVE" ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid var(--border-color)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                            <span className={sevClass} style={{ fontSize: "0.65rem", fontWeight: 700 }}>{inc.severity}</span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {new Date(inc.incidentDate).toLocaleString()}
                            </span>
                            {inc.status === "ACTIVE" && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: "var(--color-error)", fontWeight: 700 }}>
                                <span className="pulse-red" style={{ width: "6px", height: "6px" }} />
                                LIVE OUTAGE
                              </span>
                            )}
                          </div>
                          <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)", marginTop: "0.4rem" }}>
                            {inc.title}
                          </h3>
                          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                            Service: <strong>{inc.service.supportedFunction}</strong> &middot; Provider: <strong>{inc.service.vendor.legalName}</strong>
                          </p>
                        </div>

                        <button
                          className="btn btn-secondary"
                          onClick={() => handleOpenEditForm(inc)}
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                        >
                          {inc.status === "ACTIVE" ? "Resolve Outage" : "Edit / Review"}
                        </button>
                      </div>

                      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0, lineHeight: "1.4" }}>
                        {inc.description}
                      </p>

                      {inc.remediationAction && (
                        <div style={{ backgroundColor: "rgba(0,0,0,0.12)", padding: "0.6rem 0.8rem", borderRadius: "4px", fontSize: "0.8rem", color: "var(--text-muted)", borderLeft: "2px solid var(--color-brand)" }}>
                          <strong>Remediation / Resolution:</strong> {inc.remediationAction}
                        </div>
                      )}

                      {inc.downtimeMinutes > 0 && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Final Downtime: <strong>{inc.downtimeMinutes} Minutes</strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
      
      {/* Dynamic pulsing CSS in header or layout */}
      <style jsx global>{`
        .pulse-red {
          width: 8px;
          height: 8px;
          background: var(--color-error);
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
      `}</style>
    </div>
  );
}
