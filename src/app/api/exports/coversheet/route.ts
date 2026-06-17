import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeRegisterCriticality, validateRegisterEntry } from "@/lib/validators";

export const revalidate = 0; // Fresh metrics for every export

export async function GET(_req: Request) {
  try {
    const legalEntities = await prisma.legalEntity.findMany();
    const vendors = await prisma.vendor.findMany();
    const entries = await prisma.registerEntry.findMany({
      include: {
        legalEntity: true,
        vendor: true,
        service: true,
        contract: {
          include: {
            clauseFindings: {
              include: { requirement: true },
            },
          },
        },
      },
    });

    // Compute Metrics
    let totalScore = 0;
    let criticalCount = 0;
    let totalGaps = 0;

    for (const entry of entries) {
      const findingsMapped = entry.contract
        ? entry.contract.clauseFindings.map((f) => ({
            requirementId: f.requirementId,
            requirementName: f.requirement.requirementName,
            status: f.status,
            severity: f.requirement.severity,
          }))
        : [];

      const valResult = validateRegisterEntry({
        legalEntity: entry.legalEntity,
        vendor: entry.vendor,
        service: entry.service,
        contract: entry.contract,
        findings: findingsMapped,
        criticality: normalizeRegisterCriticality(entry.criticality),
      });

      totalScore += valResult.score;
      if (entry.criticality === "CRITICAL" || entry.criticality === "IMPORTANT") {
        criticalCount++;
      }
      totalGaps += findingsMapped.filter((f) => f.status === "MISSING").length;
    }

    const averageCompleteness = entries.length > 0 ? Math.round(totalScore / entries.length) : 0;

    // HHI Concentration
    const serviceCountsByVendor: Record<string, number> = {};
    let totalServicesCount = 0;
    entries.forEach((e) => {
      if (e.vendorId) {
        serviceCountsByVendor[e.vendorId] = (serviceCountsByVendor[e.vendorId] || 0) + 1;
        totalServicesCount++;
      }
    });

    let hhi = 0;
    const vendorShares: Array<{ name: string; count: number; share: number }> = [];
    if (totalServicesCount > 0) {
      Object.entries(serviceCountsByVendor).forEach(([vendorId, count]) => {
        const share = (count / totalServicesCount) * 100;
        hhi += share * share;
        const vendorName = entries.find((e) => e.vendorId === vendorId)?.vendor.legalName || "Unknown Vendor";
        vendorShares.push({ name: vendorName, count, share: Math.round(share) });
      });
    }
    hhi = Math.round(hhi);

    let hhiCategory = "Diversified (Low Risk)";
    if (hhi > 2500) {
      hhiCategory = "Highly Concentrated (High Risk)";
    } else if (hhi >= 1500) {
      hhiCategory = "Moderately Concentrated (Medium Risk)";
    }

    const formattedDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Render print-friendly HTML
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DORA Register Cover Sheet</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      line-height: 1.5;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
    }
    header {
      border-bottom: 3px solid #111827;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 10px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .subtitle {
      font-size: 14px;
      color: #4b5563;
      margin: 0;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 30px;
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 15px;
      border-radius: 6px;
    }
    .meta-item span {
      display: block;
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      font-weight: 600;
    }
    .meta-item strong {
      font-size: 15px;
    }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 15px;
      text-align: center;
    }
    .stat-card span {
      display: block;
      font-size: 12px;
      color: #6b7280;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .stat-card strong {
      font-size: 28px;
      color: #111827;
    }
    h2 {
      font-size: 18px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th, td {
      text-align: left;
      padding: 10px;
      font-size: 14px;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background-color: #f3f4f6;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 4px;
    }
    .badge-critical { background: #fef2f2; color: #991b1b; border: 1px solid #fee2e2; }
    .badge-important { background: #fffbeb; color: #92400e; border: 1px solid #fef3c7; }
    .badge-noncritical { background: #f0fdf4; color: #166534; border: 1px solid #dcfce7; }
    .signature-area {
      margin-top: 50px;
      border-top: 2px dashed #d1d5db;
      padding-top: 30px;
      page-break-inside: avoid;
    }
    .sig-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 40px;
      margin-top: 40px;
    }
    .sig-line {
      border-bottom: 1px solid #111827;
      height: 40px;
    }
    @media print {
      body {
        margin: 20px auto;
        font-size: 12px;
      }
      .no-print {
        display: none;
      }
      .meta-grid {
        background-color: transparent !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 16px; background-color: #111827; color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">
      Print / Save as PDF
    </button>
  </div>

  <header>
    <h1>DORA ICT Third-Party Register</h1>
    <p class="subtitle">Supervisory Pre-Flight Cover Sheet & Compliance Manifest (Article 30)</p>
  </header>

  <div class="meta-grid">
    <div class="meta-item">
      <span>Reporting Institution Scope</span>
      <strong>${legalEntities.map(l => l.name).join(", ") || "No Entities Set"}</strong>
    </div>
    <div class="meta-item">
      <span>Regulatory Authority</span>
      <strong>BaFin (Wedge Focus: DE / Germany)</strong>
    </div>
    <div class="meta-item">
      <span>Date Compiled</span>
      <strong>${formattedDate}</strong>
    </div>
    <div class="meta-item">
      <span>Data Schema Version</span>
      <strong>ESMA DORA Level-2 Final Draft</strong>
    </div>
  </div>

  <div class="stats-row">
    <div class="stat-card">
      <span>Register Completeness</span>
      <strong>${averageCompleteness}%</strong>
    </div>
    <div class="stat-card">
      <span>Active ICT Vendors</span>
      <strong>${vendors.length}</strong>
    </div>
    <div class="stat-card">
      <span>Critical Services</span>
      <strong>${criticalCount}</strong>
    </div>
    <div class="stat-card">
      <span>Unresolved Gaps</span>
      <strong>${totalGaps}</strong>
    </div>
  </div>

  <h2>Systemic Vendor Concentration (HHI Index)</h2>
  <p style="font-size: 14px; margin-bottom: 10px;">
    The computed Herfindahl-Hirschman Index is <strong>${hhi}</strong> (${hhiCategory}).
  </p>
  <table>
    <thead>
      <tr>
        <th>Vendor Name</th>
        <th>Services Supported</th>
        <th>Market Share in Registry</th>
      </tr>
    </thead>
    <tbody>
      ${vendorShares.sort((a,b) => b.count - a.count).map(vs => `
        <tr>
          <td><strong>${vs.name}</strong></td>
          <td>${vs.count} service${vs.count > 1 ? "s" : ""}</td>
          <td>${vs.share}%</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <h2>ICT Services Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Supported Function</th>
        <th>Vendor</th>
        <th>Criticality</th>
        <th>DORA Score</th>
      </tr>
    </thead>
    <tbody>
      ${entries.map(e => `
        <tr>
          <td>${e.service.supportedFunction}</td>
          <td>${e.vendor.legalName}</td>
          <td>
            <span class="badge ${
              e.criticality === "CRITICAL"
                ? "badge-critical"
                : e.criticality === "IMPORTANT"
                ? "badge-important"
                : "badge-noncritical"
            }">
              ${e.criticality}
            </span>
          </td>
          <td><strong>${
            // Fast inline recalculation check
            validateRegisterEntry({
              legalEntity: e.legalEntity,
              vendor: e.vendor,
              service: e.service,
              contract: e.contract,
              findings: e.contract ? e.contract.clauseFindings.map(cf => ({ requirementId: cf.requirementId, requirementName: cf.requirement.requirementName, status: cf.status, severity: cf.requirement.severity })) : [],
              criticality: normalizeRegisterCriticality(e.criticality)
            }).score
          }%</strong></td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="signature-area">
    <p style="font-size: 14px; font-weight: 600;">
      Certification Statement:
    </p>
    <p style="font-size: 13px; color: #4b5563; line-height: 1.4;">
      I hereby certify that this register has been reviewed and accurately reflects the current contractual arrangements with ICT third-party service providers. All identified critical and important functions are mapped, contract requirements under DORA Article 30 have been analyzed, and current remediation actions have been initiated where necessary.
    </p>

    <div class="sig-row">
      <div>
        <div class="sig-line"></div>
        <p style="font-size: 12px; margin-top: 5px; color: #4b5563;">
          Chief Compliance Officer (CCO) Signature
        </p>
      </div>
      <div>
        <div class="sig-line"></div>
        <p style="font-size: 12px; margin-top: 5px; color: #4b5563;">
          Date
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    return new Response(htmlContent, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error: unknown) {
    console.error("Coversheet export error:", error);
    return NextResponse.json({ error: "Server error generating cover sheet" }, { status: 500 });
  }
}
