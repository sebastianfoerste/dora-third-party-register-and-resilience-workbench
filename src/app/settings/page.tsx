"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    enforce_eea_data_residency: "true",
    enforce_eu_governing_law: "true",
    enforce_exit_plan_for_critical_services: "true",
    sla_max_downtime_minutes: "120",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.success && data.settings) {
          setSettings(data.settings);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("✓ Policy settings successfully updated and all register entries re-validated.");
      } else {
        setMessage("❌ Failed to update settings: " + data.error);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Network error saving policy parameters.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div className="page-header" style={{ marginBottom: "2rem" }}>
        <h1 className="page-title">Policy & Risk Settings</h1>
        <p className="page-subtitle">
          Configure institutional risk thresholds and compliance rules. Changes dynamically adjust registry validations and health scores.
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: "1rem",
            borderRadius: "var(--radius-sm)",
            backgroundColor: message.startsWith("✓") ? "rgba(20, 184, 166, 0.08)" : "rgba(239, 68, 68, 0.08)",
            border: message.startsWith("✓") ? "1px solid rgba(20, 184, 166, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
            color: message.startsWith("✓") ? "var(--color-brand)" : "var(--color-error)",
            fontSize: "0.85rem",
            fontWeight: 500,
            marginBottom: "1.5rem",
          }}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="card" style={{ display: "flex", flexDirection: "column", gap: "1.75rem", padding: "2rem" }}>
        <h2 style={{ fontSize: "1.3rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem", margin: 0 }}>
          DORA Validation Rules
        </h2>

        {/* 1. EEA Data Residency */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "2rem" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.25rem 0" }}>Enforce EEA Data Residency</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0, lineHeight: "1.4" }}>
              When enabled, any mapped services hosting or processing data outside the EEA (such as the US, UK, or Israel) will flag a High-Severity Risk alert on the compliance dashboard.
            </p>
          </div>
          <select
            className="form-control"
            style={{ width: "130px", flexShrink: 0 }}
            value={settings.enforce_eea_data_residency}
            onChange={(e) => handleChange("enforce_eea_data_residency", e.target.value)}
          >
            <option value="true">Enforced</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        <hr style={{ border: "0.5px solid var(--border-color)", margin: 0, opacity: 0.5 }} />

        {/* 2. EU Governing Law */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "2rem" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.25rem 0" }}>Enforce EU Governing Law</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0, lineHeight: "1.4" }}>
              Strictly verify that governing laws specified in contracts fall under EU/EEA jurisdictions. Non-compliant agreements (e.g. governed by New York or English law) are marked as high-severity risks.
            </p>
          </div>
          <select
            className="form-control"
            style={{ width: "130px", flexShrink: 0 }}
            value={settings.enforce_eu_governing_law}
            onChange={(e) => handleChange("enforce_eu_governing_law", e.target.value)}
          >
            <option value="true">Enforced</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        <hr style={{ border: "0.5px solid var(--border-color)", margin: 0, opacity: 0.5 }} />

        {/* 3. Exit Plan Requirement */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "2rem" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.25rem 0" }}>Enforce Approved Exit Plans</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0, lineHeight: "1.4" }}>
              Require that all services classified as Critical or Important have an approved exit and transition strategy. Exit plans in draft or unassigned states will trigger a compliance gap warning.
            </p>
          </div>
          <select
            className="form-control"
            style={{ width: "130px", flexShrink: 0 }}
            value={settings.enforce_exit_plan_for_critical_services}
            onChange={(e) => handleChange("enforce_exit_plan_for_critical_services", e.target.value)}
          >
            <option value="true">Enforced</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        <hr style={{ border: "0.5px solid var(--border-color)", margin: 0, opacity: 0.5 }} />

        {/* 4. SLA Cumulative Downtime Threshold */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "2rem" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.25rem 0" }}>SLA Downtime Limit (Minutes)</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0, lineHeight: "1.4" }}>
              Define the maximum allowable cumulative outage downtime in minutes for any ICT service. Exceeding this threshold triggers high-risk SLA warnings in the cockpit dashboard.
            </p>
          </div>
          <input
            type="number"
            className="form-control"
            style={{ width: "130px", flexShrink: 0 }}
            min="0"
            value={settings.sla_max_downtime_minutes || "120"}
            onChange={(e) => handleChange("sla_max_downtime_minutes", e.target.value)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: "0.6rem 2rem" }}>
            {saving ? "Saving Policy Rules..." : "Save Policy Config"}
          </button>
        </div>
      </form>
    </div>
  );
}
