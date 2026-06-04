"use client";

import React, { useState, useEffect } from "react";

interface IntegrationSetting {
  id: string;
  systemType: "GRC" | "PROCUREMENT" | "DMS" | "IAM";
  name: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  endpointUrl: string | null;
  authConfig: string | null;
  lastSyncedAt: string | null;
}

interface SyncLog {
  id: string;
  systemType: string;
  action: string;
  status: string;
  details: string | null;
  recordsCount: number;
  timestamp: string;
}

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<IntegrationSetting[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingType, setSyncingType] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states mapping by systemType
  const [forms, setForms] = useState<Record<string, { endpointUrl: string; clientId: string; secretToken: string; folderId?: string; issuerUrl?: string }>>({
    GRC: { endpointUrl: "", clientId: "", secretToken: "" },
    PROCUREMENT: { endpointUrl: "", clientId: "", secretToken: "" },
    DMS: { endpointUrl: "", clientId: "", secretToken: "", folderId: "" },
    IAM: { endpointUrl: "", clientId: "", secretToken: "", issuerUrl: "" }
  });

  const fetchData = async () => {
    try {
      const res = await fetch("/api/integrations");
      if (!res.ok) throw new Error("Failed to load integrations settings");
      const data = await res.json();
      setSettings(data.settings);
      setLogs(data.logs);

      // Populate forms
      const newForms = { ...forms };
      data.settings.forEach((s: IntegrationSetting) => {
        let auth = { clientId: "", secretToken: "", folderId: "", issuerUrl: "" };
        try {
          if (s.authConfig) auth = JSON.parse(s.authConfig);
        } catch (_) {}

        newForms[s.systemType] = {
          endpointUrl: s.endpointUrl || "",
          clientId: auth.clientId || "",
          secretToken: auth.secretToken || "",
          folderId: auth.folderId || "",
          issuerUrl: auth.issuerUrl || "",
        };
      });
      setForms(newForms);
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Failed to load page data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFormChange = (systemType: string, field: string, value: string) => {
    setForms(prev => ({
      ...prev,
      [systemType]: {
        ...prev[systemType],
        [field]: value
      }
    }));
  };

  const saveConfig = async (s: IntegrationSetting) => {
    try {
      const form = forms[s.systemType];
      const authConfig = JSON.stringify({
        clientId: form.clientId,
        secretToken: form.secretToken,
        folderId: form.folderId,
        issuerUrl: form.issuerUrl,
        groupMapping: s.systemType === "IAM" ? [
          { group: "Okta-DORA-CCO", role: "Compliance Lead" },
          { group: "Okta-DORA-Auditors", role: "Auditor" }
        ] : undefined
      });

      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: s.id,
          systemType: s.systemType,
          name: s.name,
          endpointUrl: form.endpointUrl,
          authConfig,
          status: s.status // Keep existing status or disconnect
        }),
      });

      if (!res.ok) throw new Error("Failed to save configuration");
      setAlertMsg({ type: "success", text: `Successfully updated config for ${s.name}.` });
      fetchData();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Failed to save configuration" });
    }
  };

  const testConnection = async (s: IntegrationSetting) => {
    setTestingId(s.id);
    setAlertMsg(null);
    try {
      const form = forms[s.systemType];
      const authConfig = JSON.stringify({
        clientId: form.clientId,
        secretToken: form.secretToken,
        folderId: form.folderId,
        issuerUrl: form.issuerUrl
      });

      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: s.id,
          systemType: s.systemType,
          name: s.name,
          endpointUrl: form.endpointUrl,
          authConfig,
          action: "TEST_CONNECTION"
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection test failed");

      if (data.success) {
        setAlertMsg({ type: "success", text: `Connection to ${s.name} established successfully!` });
      } else {
        setAlertMsg({ type: "error", text: `Connection check failed: ${data.log?.details}` });
      }
      fetchData();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Connection test error" });
    } finally {
      setTestingId(null);
    }
  };

  const triggerForceSync = async (systemType: string) => {
    setSyncingType(systemType);
    setAlertMsg(null);
    try {
      const endpoint = `/api/integrations/${systemType.toLowerCase()}`;
      const body: any = {};

      if (systemType === "IAM") {
        body.action = "SYNC_GROUPS";
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync execution failed.");

      setAlertMsg({
        type: "success",
        text: `Manual sync completed. Records updated: ${data.recordsSyncedCount || data.userCount || data.filesSynced?.length || 0}.`
      });
      fetchData();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Synchronization failed" });
    } finally {
      setSyncingType(null);
    }
  };

  // Mock simulated incoming webhook trigger from Coupa/Ironclad
  const triggerProcurementMockWebhook = async () => {
    setSyncingType("PROCUREMENT_WEBHOOK");
    setAlertMsg(null);
    try {
      const mockPayload = {
        vendorName: "Datadog Germany GmbH",
        vendorCountry: "DE",
        lei: "549300HJKO92V46L1992",
        serviceDescription: "Critical cloud application logs monitoring, dashboard dashboards, and container SLA tracking.",
        supportedFunction: "Real-time Operations Monitoring & Log Collection",
        dataProcessed: "Infrastructure Metadata, System Health Logs, Core Balancing Performance Metrics",
        location: "Frankfurt (DE)",
        subcontractingStatus: "NO",
        substitutability: "MEDIUM",
        governingLaw: "Germany",
        sourceFile: "Datadog_SLA_Execution_Draft_2026.pdf",
        effectiveDate: "2026-05-20",
        renewalDate: "2027-05-20",
        criticality: "IMPORTANT"
      };

      const res = await fetch("/api/integrations/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockPayload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Webhook trigger failed.");

      setAlertMsg({
        type: "success",
        text: `Webhook received! Imported new vendor 'Datadog Germany GmbH' and service automatically. Generated Register Entry #${data.registerEntryId}.`
      });
      fetchData();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Webhook trigger failed" });
    } finally {
      setSyncingType(null);
    }
  };

  if (loading) {
    return <div className="loading-container">Loading integrations control console...</div>;
  }

  return (
    <div className="integrations-container">
      <div className="integrations-header">
        <h1>Regulatory Integrations Hub</h1>
        <p>Map DORA compliance registers and automated outreach reviews to external enterprise platforms.</p>
      </div>

      {alertMsg && (
        <div className={`alert-box ${alertMsg.type}`}>
          <div className="alert-icon">{alertMsg.type === "success" ? "✓" : "⚠"}</div>
          <div className="alert-content">{alertMsg.text}</div>
          <button className="alert-close" onClick={() => setAlertMsg(null)}>×</button>
        </div>
      )}

      <div className="integrations-grid">
        {settings.map((s) => {
          const form = forms[s.systemType] || { endpointUrl: "", clientId: "", secretToken: "", folderId: "", issuerUrl: "" };
          const isConnected = s.status === "CONNECTED";
          const isError = s.status === "ERROR";

          return (
            <div key={s.id} className="integration-card">
              <div className="card-top">
                <div>
                  <h2 className="system-title">{s.name}</h2>
                  <span className="system-type-badge">{s.systemType}</span>
                </div>
                <div className={`status-pill ${s.status.toLowerCase()}`}>
                  <span className="status-dot"></span>
                  {s.status}
                </div>
              </div>

              <div className="card-body">
                <div className="input-group">
                  <label>API Endpoint URL</label>
                  <input
                    type="text"
                    value={form.endpointUrl}
                    onChange={(e) => handleFormChange(s.systemType, "endpointUrl", e.target.value)}
                    placeholder="https://api.externalplatform.com/v1"
                    disabled={s.systemType === "PROCUREMENT"} // Webhook is incoming read-only
                  />
                  {s.systemType === "PROCUREMENT" && (
                    <small className="help-text">Incoming webhook endpoint managed by workbench listener.</small>
                  )}
                </div>

                {s.systemType === "DMS" && (
                  <div className="input-group">
                    <label>Target Folder ID</label>
                    <input
                      type="text"
                      value={form.folderId}
                      onChange={(e) => handleFormChange(s.systemType, "folderId", e.target.value)}
                      placeholder="e.g. google_drive_folder_hash_id"
                    />
                  </div>
                )}

                <div className="form-row">
                  <div className="input-group half">
                    <label>Client ID / Issuer</label>
                    <input
                      type="text"
                      value={form.clientId}
                      onChange={(e) => handleFormChange(s.systemType, "clientId", e.target.value)}
                      placeholder="OAuth client identifier"
                    />
                  </div>

                  <div className="input-group half">
                    <label>Secret Token / Key</label>
                    <input
                      type="password"
                      value={form.secretToken}
                      onChange={(e) => handleFormChange(s.systemType, "secretToken", e.target.value)}
                      placeholder="••••••••••••••••"
                    />
                  </div>
                </div>

                {s.lastSyncedAt && (
                  <div className="sync-timestamp">
                    Last Synced: {new Date(s.lastSyncedAt).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="card-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => saveConfig(s)}
                >
                  Save Config
                </button>
                
                <button
                  className="btn btn-secondary"
                  onClick={() => testConnection(s)}
                  disabled={testingId === s.id}
                >
                  {testingId === s.id ? "Testing..." : "Test Connection"}
                </button>

                {s.systemType !== "PROCUREMENT" ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => triggerForceSync(s.systemType)}
                    disabled={!isConnected || syncingType === s.systemType}
                  >
                    {syncingType === s.systemType ? "Syncing..." : `Sync Now`}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={triggerProcurementMockWebhook}
                    disabled={!isConnected || syncingType === "PROCUREMENT_WEBHOOK"}
                  >
                    {syncingType === "PROCUREMENT_WEBHOOK" ? "Triggering..." : "Simulate Webhook"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sync-logs-section">
        <h2>Integration Sync Log</h2>
        <div className="table-responsive">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>System</th>
                <th>Action</th>
                <th>Records Mapped</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                    No sync operation events recorded yet. Configure and trigger integrations above.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.timestamp).toLocaleString()}</td>
                    <td><span className="system-type-badge">{l.systemType}</span></td>
                    <td><strong>{l.action}</strong></td>
                    <td>{l.recordsCount}</td>
                    <td>
                      <span className={`badge ${l.status.toLowerCase()}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="log-detail-cell">{l.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .integrations-container {
          padding: 2.5rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        .integrations-header {
          margin-bottom: 2rem;
        }
        .integrations-header h1 {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 2.2rem;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }
        .integrations-header p {
          color: var(--text-muted);
          font-size: 1.1rem;
        }
        .integrations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
          gap: 2rem;
          margin-bottom: 3rem;
        }
        .integration-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .integration-card:hover {
          border-color: var(--color-brand);
          box-shadow: 0 4px 24px rgba(0, 229, 255, 0.1);
        }
        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 1rem;
        }
        .system-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 1.4rem;
          color: var(--text-primary);
          margin: 0 0 0.25rem 0;
        }
        .system-type-badge {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 0.75rem;
          font-family: monospace;
          color: var(--text-muted);
        }
        .status-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid transparent;
        }
        .status-pill.disconnected {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
          border-color: rgba(255, 255, 255, 0.1);
        }
        .status-pill.connected {
          background: rgba(0, 229, 255, 0.08);
          color: var(--color-brand);
          border-color: rgba(0, 229, 255, 0.25);
        }
        .status-pill.error {
          background: rgba(255, 0, 85, 0.08);
          color: var(--color-error);
          border-color: rgba(255, 0, 85, 0.25);
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          display: inline-block;
        }
        .status-pill.connected .status-dot {
          box-shadow: 0 0 8px var(--color-brand);
          animation: pulse 1.8s infinite alternate;
        }
        .card-body {
          margin-bottom: 1.5rem;
          flex-grow: 1;
        }
        .input-group {
          margin-bottom: 1rem;
        }
        .input-group label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .input-group input {
          width: 100%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 0.6rem 0.8rem;
          color: var(--text-primary);
          font-size: 0.9rem;
          transition: border-color 0.2s, background-color 0.2s;
        }
        .input-group input:focus {
          outline: none;
          border-color: var(--color-brand);
          background: rgba(255, 255, 255, 0.05);
        }
        .input-group input:disabled {
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.01);
          border-color: rgba(255, 255, 255, 0.05);
          cursor: not-allowed;
        }
        .form-row {
          display: flex;
          gap: 1rem;
        }
        .input-group.half {
          width: 50%;
        }
        .help-text {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 4px;
          display: block;
        }
        .sync-timestamp {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-style: italic;
          margin-top: 0.5rem;
        }
        .card-actions {
          display: flex;
          gap: 0.75rem;
          border-top: 1px solid var(--border-color);
          padding-top: 1.2rem;
        }
        .btn {
          padding: 0.6rem 1rem;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
          border: 1px solid transparent;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-primary {
          background: var(--color-brand);
          color: #080c16;
        }
        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--border-color);
          color: var(--text-primary);
        }
        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--color-brand);
        }
        .alert-box {
          background: rgba(0, 229, 255, 0.08);
          border: 1px solid rgba(0, 229, 255, 0.2);
          border-radius: 6px;
          padding: 1rem;
          margin-bottom: 2rem;
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-primary);
        }
        .alert-box.error {
          background: rgba(255, 0, 85, 0.08);
          border-color: rgba(255, 0, 85, 0.2);
        }
        .alert-icon {
          font-size: 1.2rem;
          font-weight: bold;
        }
        .alert-box.success .alert-icon {
          color: var(--color-brand);
        }
        .alert-box.error .alert-icon {
          color: #ff0055;
        }
        .alert-content {
          flex-grow: 1;
          font-size: 0.9rem;
        }
        .alert-close {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 1.2rem;
          cursor: pointer;
          padding: 0 4px;
        }
        .sync-logs-section {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 1.5rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        }
        .sync-logs-section h2 {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 1.5rem;
          color: var(--text-primary);
          margin-bottom: 1.5rem;
        }
        .table-responsive {
          overflow-x: auto;
        }
        .logs-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
          color: var(--text-primary);
        }
        .logs-table th, .logs-table td {
          padding: 0.8rem 1rem;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
        }
        .logs-table th {
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        .badge {
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
        }
        .badge.success {
          background: rgba(0, 229, 255, 0.1);
          color: var(--color-brand);
          border: 1px solid rgba(0, 229, 255, 0.2);
        }
        .badge.failed {
          background: rgba(255, 0, 85, 0.1);
          color: #ff0055;
          border: 1px solid rgba(255, 0, 85, 0.2);
        }
        .log-detail-cell {
          color: var(--text-muted);
          font-family: monospace;
          max-width: 400px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .loading-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
          color: var(--text-muted);
          font-size: 1.2rem;
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
