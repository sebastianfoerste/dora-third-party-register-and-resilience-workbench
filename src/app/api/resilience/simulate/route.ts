import { NextResponse } from "next/server";
import { buildExitPlanRehearsalCreateInput } from "@/lib/exit-plan-rehearsal";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const history = await prisma.simulationRun.findMany({
      orderBy: { testedAt: "desc" },
      take: 10,
    });
    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("GET simulation runs error:", error);
    return NextResponse.json({ error: "Failed to load simulation history" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scenarioKey, serviceId } = body;

    if (!scenarioKey || !serviceId) {
      return NextResponse.json({ error: "Scenario and Service are required." }, { status: 400 });
    }

    // Load full service graph: vendor, contracts with findings, exit plans, subcontractors, incidents, resilience tests
    const service = await prisma.iCTService.findUnique({
      where: { id: serviceId },
      include: {
        vendor: {
          include: {
            contracts: {
              include: {
                clauseFindings: {
                  include: {
                    requirement: true,
                  },
                },
              },
            },
          },
        },
        exitPlan: true,
        subcontractors: true,
        incidents: {
          where: { status: "ACTIVE" },
        },
        resilienceTests: {
          orderBy: { testDate: "desc" },
          take: 1,
        },
      },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

    // Load active policy rules to check context
    const policyList = await prisma.policySetting.findMany();
    const enforceEEA = policyList.find(p => p.key === "enforce_eea_data_residency")?.value === "true";

    let survivability = 100;
    const timeline: Array<{ time: string; event: string; status: "success" | "warning" | "error" | "info" }> = [];

    timeline.push({
      time: "00:00",
      event: `Initiated stress simulation '${scenarioKey.replace(/_/g, " ").toUpperCase()}' for service '${service.supportedFunction}' provided by '${service.vendor.legalName}'.`,
      status: "info"
    });

    // 1. Check Exit Plan
    if (service.exitPlan && service.exitPlan.status === "APPROVED") {
      timeline.push({
        time: "00:10",
        event: `Exit Plan checked: Approved strategy '${service.exitPlan.title}' is ready. Continuity migration to '${service.exitPlan.alternativeVendor || "Internal Systems"}' is validated.`,
        status: "success"
      });
    } else {
      survivability -= 30;
      timeline.push({
        time: "00:10",
        event: service.exitPlan 
          ? `Exit Plan checked: Draft plan exists but is NOT approved. Continuity risks identified.` 
          : `Exit Plan checked: No Exit Plan is defined for this service. High-severity DORA Article 30(2)(h) compliance gap!`,
        status: "error"
      });
    }

    // 2. Check SLA and Incident Clause Findings
    const contract = service.vendor.contracts[0];
    const slaFinding = contract?.clauseFindings.find(f => f.requirement.regulatoryBasis === "DORA Art. 30(2)(d)");
    const incidentFinding = contract?.clauseFindings.find(f => f.requirement.regulatoryBasis === "DORA Art. 30(2)(e)");

    if (!slaFinding || slaFinding.status === "MISSING" || slaFinding.status === "PARTIAL" || !incidentFinding || incidentFinding.status === "MISSING" || incidentFinding.status === "PARTIAL") {
      survivability -= 20;
      timeline.push({
        time: "00:20",
        event: `Contract Audit: Contract lacks mandatory DORA service level or incident reporting provisions, impeding communication response protocols.`,
        status: "error"
      });
    } else {
      timeline.push({
        time: "00:20",
        event: `Contract Audit: SLA obligations and incident notifications are legally documented. Uptime guarantees are verified.`,
        status: "success"
      });
    }

    // 3. Subcontractors & Country Residency
    const nonEEASubcontractor = service.subcontractors.find(s => 
      !["DE", "FR", "IE", "NL", "IT", "ES", "SE", "FI", "AT", "BE", "LU"].includes(s.country)
    );

    if (nonEEASubcontractor) {
      if (enforceEEA) {
        survivability -= 15;
        timeline.push({
          time: "00:30",
          event: `Supply Chain Audit: Subcontractor '${nonEEASubcontractor.name}' operates in non-EEA jurisdiction (${nonEEASubcontractor.country}). This violates the strict EEA Residency Policy.`,
          status: "error"
        });
      } else {
        timeline.push({
          time: "00:30",
          event: `Supply Chain Audit: Subcontractor '${nonEEASubcontractor.name}' operates in non-EEA jurisdiction (${nonEEASubcontractor.country}). Tracked under warning registry.`,
          status: "warning"
        });
      }
    } else if (service.subcontractors.length > 0) {
      timeline.push({
        time: "00:30",
        event: `Supply Chain Audit: Checked ${service.subcontractors.length} subcontractor dependencies. All operate within compliant EEA borders.`,
        status: "success"
      });
    } else {
      timeline.push({
        time: "00:30",
        event: `Supply Chain Audit: No subcontractors registered. Zero cascade concentration exposure.`,
        status: "success"
      });
    }

    // 4. Check Active Incident Logs
    if (service.incidents.length > 0) {
      survivability -= 20;
      timeline.push({
        time: "00:40",
        event: `System Status: Identified ${service.incidents.length} unresolved outage incidents on this service. Current performance is severely degraded.`,
        status: "error"
      });
    } else {
      timeline.push({
        time: "00:40",
        event: `System Status: Clean record. No active incident outages reported.`,
        status: "success"
      });
    }

    // 5. Check Resilience Tests
    const lastTest = service.resilienceTests[0];
    if (!lastTest) {
      survivability -= 15;
      timeline.push({
        time: "00:50",
        event: `Resilience Testing: No history of vulnerability scans, DR exercises, or TLPT found. Continuous verification score lowered.`,
        status: "warning"
      });
    } else if (lastTest.status === "FAILED") {
      survivability -= 15;
      timeline.push({
        time: "00:50",
        event: `Resilience Testing: Last test executed on ${new Date(lastTest.testDate).toLocaleDateString()} FAILED. Vulnerabilities remain open.`,
        status: "error"
      });
    } else {
      timeline.push({
        time: "00:50",
        event: `Resilience Testing: Verified successful '${lastTest.testType}' test passed on ${new Date(lastTest.testDate).toLocaleDateString()}.`,
        status: "success"
      });
    }

    // Bound survivability score
    survivability = Math.max(10, Math.min(100, survivability));
    const status = survivability >= 60 ? "COMPLETED" : "FAILED";

    timeline.push({
      time: "01:00",
      event: `Simulation completed. Final Resilience Survivability Rating: ${survivability}%. Status: ${status}.`,
      status: survivability >= 60 ? "success" : "error"
    });

    // Create Simulation Run log
    const run = await prisma.simulationRun.create({
      data: {
        scenarioName: `${scenarioKey.replace(/_/g, " ").toUpperCase()} Drill - ${service.supportedFunction}`,
        status,
        survivability,
        timelineLog: JSON.stringify(timeline),
      },
    });

    const rehearsal = await prisma.exitPlanRehearsal.create({
      data: buildExitPlanRehearsalCreateInput({
        serviceId,
        scenarioType: scenarioKey,
        assumptions: {
          enforceEEA,
          activeIncidentCount: service.incidents.length,
          subcontractorCount: service.subcontractors.length,
          latestResilienceTestStatus: lastTest?.status ?? null,
        },
        outcome: {
          simulationRunId: run.id,
          timelineEventCount: timeline.length,
          status,
        },
        survivabilityScore: survivability,
        status,
      }),
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        actor: "Risk Operations Simulator",
        action: "RUN_RESILIENCE_SIMULATION",
        object: `SimulationRun:${run.id}`,
        afterSnapshot: JSON.stringify({
          run,
          serviceId,
          exitPlanRehearsal: {
            id: rehearsal.id,
            digest: rehearsal.digest,
            status: rehearsal.status,
          },
        }),
      },
    });

    return NextResponse.json({ success: true, run, rehearsal });
  } catch (error: unknown) {
    console.error("POST run simulation error:", error);
    return NextResponse.json({ error: "Failed to run scenario simulation" }, { status: 500 });
  }
}
