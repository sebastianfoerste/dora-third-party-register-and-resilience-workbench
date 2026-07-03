"use client";

import { useEffect, useState } from "react";

interface ROIMetrics {
  vendorsCount: number;
  contractsCount: number;
  openGapsCount: number;
  resolvedGapsCount: number;
  compliantCount: number;
  hoursSaved: number;
  costSavedEur: number;
  activeDailyExposureEur: number;
  maxDailyFinePenaltyEur: number;
  riskReductionRate: number;
  assumptions: {
    hourlyRateEur: number;
    dailyGlobalTurnoverEur: number;
  };
}

export default function ROIDashboard() {
  const [metrics, setMetrics] = useState<ROIMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Interactive Calculator State
  const [sliderTurnover, setSliderTurnover] = useState(365000000); // Default €365M annual turnover
  const [sliderGaps, setSliderGaps] = useState(2);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/exports/roi");
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
        setSliderGaps(data.metrics.openGapsCount);
      }
    } catch (err) {
      console.error("Failed to fetch ROI metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-error)" }}>
        Failed to load compliance ROI metrics.
      </div>
    );
  }

  // Interactive calculations
  const calcDailyTurnover = sliderTurnover / 365;
  const calcDailyPenaltyPerGap = calcDailyTurnover * 0.01; // 1% of daily global turnover
  const calcTotalDailyExposure = sliderGaps * calcDailyPenaltyPerGap;

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="page-title">Board Compliance ROI Dashboard</h1>
          <p className="page-subtitle">
            Financial analytics demonstrating manual labor cost reductions and regulatory penalty risk mitigation under DORA guidelines.
          </p>
        </div>
        <a href="/exports" className="btn btn-secondary">
          &larr; Back to Export Center
        </a>
      </div>

      {/* Grid of Key Metrics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
        
        {/* Card 1: Operational Cost Savings */}
        <div className="card" style={{ borderTop: "3px solid var(--color-brand)" }}>
          <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 0.5rem 0" }}>
            Operational Cost Savings
          </h3>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
            €{metrics.costSavedEur.toLocaleString()}
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
            Saved <strong>{metrics.hoursSaved} audit hours</strong> by replacing manual contract reviews with AI-assisted extraction and automated checks across {metrics.contractsCount} contracts.
          </p>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem", marginTop: "1rem" }}>
            Based on CCO & legal rate: <strong>€{metrics.assumptions.hourlyRateEur}/hr</strong>
          </div>
        </div>

        {/* Card 2: Active Fine Exposure */}
        <div className="card" style={{ borderTop: metrics.openGapsCount > 0 ? "3px solid var(--color-error)" : "3px solid var(--color-brand)" }}>
          <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 0.5rem 0" }}>
            Active Daily Fine Exposure
          </h3>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: metrics.openGapsCount > 0 ? "var(--color-error)" : "var(--color-brand)", marginBottom: "0.5rem" }}>
            €{metrics.activeDailyExposureEur.toLocaleString()}/day
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
            Estimated regulatory penalty risk from <strong>{metrics.openGapsCount} unpatched compliance gaps</strong> across registered service contracts.
          </p>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem", marginTop: "1rem" }}>
            Max oversight penalty: <strong>1% of daily group turnover</strong>
          </div>
        </div>

        {/* Card 3: Risk Reduction Rate */}
        <div className="card" style={{ borderTop: "3px solid var(--color-brand)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 0.5rem 0" }}>
              Resilience Risk Reduction
            </h3>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--color-brand)", marginBottom: "0.5rem" }}>
              {metrics.riskReductionRate}%
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
              Percentage of identified regulatory gaps successfully mitigated via remediation tasks and approved exit plans.
            </p>
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem", marginTop: "1rem" }}>
            Gaps Resolved: <strong>{metrics.resolvedGapsCount}</strong> &middot; Open: <strong>{metrics.openGapsCount}</strong>
          </div>
        </div>

      </div>

      {/* Main split dashboard section */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "2rem", alignItems: "start" }}>
        
        {/* Left Side: Calculations and Audit Details */}
        <div className="card">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "1.25rem" }}>Compliance ROI Breakdown & Calculations</h2>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                <th style={{ padding: "0.75rem 0.5rem", fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Metric Parameter</th>
                <th style={{ padding: "0.75rem 0.5rem", fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", textAlign: "right" }}>Value</th>
                <th style={{ padding: "0.75rem 0.5rem", fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", textAlign: "right" }}>Financial Basis</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Registered Vendors</td>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", textAlign: "right" }}>{metrics.vendorsCount}</td>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "right" }}>-</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Active Service Contracts</td>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", textAlign: "right" }}>{metrics.contractsCount}</td>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "right" }}>€{metrics.contractsCount * 40 * 150} Manual Basis</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Compliant Contract Clauses</td>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", textAlign: "right" }}>{metrics.compliantCount}</td>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", color: "var(--color-brand)", textAlign: "right" }}>Risk Cleared</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Resolved/Remediated Gaps</td>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", textAlign: "right" }}>{metrics.resolvedGapsCount}</td>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", color: "var(--color-brand)", textAlign: "right" }}>-€{metrics.resolvedGapsCount * metrics.maxDailyFinePenaltyEur}/day Fine Avoided</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>Open Gaps Remaining</td>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", color: "var(--color-error)", textAlign: "right" }}>{metrics.openGapsCount}</td>
                <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.85rem", color: "var(--color-error)", textAlign: "right" }}>€{metrics.activeDailyExposureEur}/day Active Penalty Risk</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1rem", lineHeight: "1.4" }}>
            * Operational savings are derived from DORA requirements: Article 30 requires comprehensive contract mapping. Manual audits take an average of 40 hours per contract, compared to 2 hours of platform review using our automated validator.
          </p>
        </div>

        {/* Right Side: Interactive Projection Simulator */}
        <div className="card" style={{ borderLeft: "4px solid var(--color-brand)" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Interactive Board Risk Simulator</h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
            Adjust group financial parameters and open finding counts to dynamically project non-compliance fine exposures.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            
            {/* Slider 1: Annual Turnover */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Annual Group Turnover</span>
                <strong style={{ color: "var(--color-brand)" }}>€{(sliderTurnover / 1000000).toFixed(0)}M</strong>
              </label>
              <input
                type="range"
                min="50000000"
                max="1000000000"
                step="10000000"
                value={sliderTurnover}
                onChange={(e) => setSliderTurnover(parseInt(e.target.value, 10))}
                style={{ width: "100%", accentColor: "var(--color-brand)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                <span>€50M (CASP Limit)</span>
                <span>€1B (Enterprise)</span>
              </div>
            </div>

            {/* Slider 2: Open Gaps */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Simulated Open Gaps</span>
                <strong style={{ color: "var(--color-brand)" }}>{sliderGaps} Gaps</strong>
              </label>
              <input
                type="range"
                min="0"
                max="15"
                step="1"
                value={sliderGaps}
                onChange={(e) => setSliderGaps(parseInt(e.target.value, 10))}
                style={{ width: "100%", accentColor: "var(--color-brand)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                <span>0 Gaps (Full Compliance)</span>
                <span>15 Gaps (High Risk)</span>
              </div>
            </div>

            {/* Results Output Block */}
            <div
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                padding: "1rem",
                marginTop: "0.5rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <span>Simulated Daily Turnover:</span>
                <strong>€{Math.round(calcDailyTurnover).toLocaleString()}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <span>1% Penalty Limit per Gap/Day:</span>
                <strong style={{ color: "var(--color-brand)" }}>€{Math.round(calcDailyPenaltyPerGap).toLocaleString()}</strong>
              </div>
              
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  paddingTop: "0.5rem",
                  marginTop: "0.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>Projected Daily Exposure:</span>
                <strong
                  style={{
                    fontSize: "1.1rem",
                    color: calcTotalDailyExposure > 0 ? "var(--color-error)" : "var(--color-brand)"
                  }}
                >
                  €{Math.round(calcTotalDailyExposure).toLocaleString()}
                </strong>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
