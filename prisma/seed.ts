import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const DORA_REQUIREMENTS = [
  {
    regulatoryBasis: "DORA Art. 30(2)(a)",
    requirementName: "Clear Description of Services",
    applicability: "ALL_ICT",
    expectedPattern: "description of functions, service levels, and specifications",
    severity: "MEDIUM",
    description: "The contract must contain a clear description of all functions and service levels to be provided by the ICT third-party service provider."
  },
  {
    regulatoryBasis: "DORA Art. 30(2)(b)",
    requirementName: "Locations of Data Processing",
    applicability: "ALL_ICT",
    expectedPattern: "location of data storage, processing, and data centers",
    severity: "HIGH",
    description: "The contract must specify the regions, countries, or data center locations where the ICT services are provided and where data is to be processed."
  },
  {
    regulatoryBasis: "DORA Art. 30(2)(c)",
    requirementName: "Data Protection & Access Rights",
    applicability: "ALL_ICT",
    expectedPattern: "personal data protection, access controls, encryption, integrity",
    severity: "HIGH",
    description: "The contract must contain provisions on data protection, encryption, security logs, and access permissions in line with GDPR and DORA security standards."
  },
  {
    regulatoryBasis: "DORA Art. 30(2)(d)",
    requirementName: "Service Level Agreements (SLAs)",
    applicability: "ALL_ICT",
    expectedPattern: "performance metrics, target service levels, monitoring, response times",
    severity: "MEDIUM",
    description: "The contract must define clear target service levels (KPIs), reporting frequency, and financial/operational remedies for service breaches."
  },
  {
    regulatoryBasis: "DORA Art. 30(2)(e)",
    requirementName: "Incident Notification Obligations",
    applicability: "ALL_ICT",
    expectedPattern: "reporting of security incidents, breach notification timelines, assistance",
    severity: "HIGH",
    description: "The provider must be contractually obligated to assist the financial entity during ICT incidents and report any security incident without undue delay (ideally within 4-24 hours)."
  },
  {
    regulatoryBasis: "DORA Art. 30(2)(f)",
    requirementName: "Audit and Inspection Rights",
    applicability: "ALL_ICT",
    expectedPattern: "unrestricted access, physical audits, third-party certification, BaFin access",
    severity: "HIGH",
    description: "The contract must grant the financial entity and its competent supervisors (like BaFin) unrestricted rights of access, inspection, and audit to the provider's systems and sites."
  },
  {
    regulatoryBasis: "DORA Art. 30(2)(g)",
    requirementName: "Termination Rights & Notice Periods",
    applicability: "ALL_ICT",
    expectedPattern: "termination for material breach, regulatory instruction, minimum notice",
    severity: "HIGH",
    description: "The contract must specify termination rights, allowing the financial entity to terminate for material breaches, regulatory orders, or insolvency, with appropriate notice periods."
  },
  {
    regulatoryBasis: "DORA Art. 30(2)(h)",
    requirementName: "Exit Strategies & Transition",
    applicability: "CRITICAL_ONLY",
    expectedPattern: "exit plan, migration assistance, continuity of services, data handover",
    severity: "HIGH",
    description: "For critical functions, the contract must establish an exit plan and obligate the provider to assist in migrating data/services to another provider or in-house without disruption."
  },
  {
    regulatoryBasis: "DORA Art. 30(2)(i)",
    requirementName: "Subcontracting Controls & Approval",
    applicability: "ALL_ICT",
    expectedPattern: "prior written consent, notification of sub-processors, liability, right to object",
    severity: "MEDIUM",
    description: "The contract must state whether subcontracting is permitted and require prior written consent or notification with veto rights before a critical sub-processor is appointed."
  }
];

const MOCK_CONTRACT_1 = `
CLOUD HOSTING SERVICES AGREEMENT
This Cloud Hosting Agreement (the "Agreement") is entered into as of May 12, 2025, by and between Bitpanda Custody GmbH ("Customer"), having its registered office in Frankfurt, Germany, and Amazon Web Services EMEA SARL ("Provider"), registered in Luxembourg.

1. Services: Provider shall provide Cloud Infrastructure Hosting Services, including virtual computing (EC2) and database storage (RDS), in accordance with the Service Level Agreement in Exhibit B.
2. Data Center Location: All Customer data stored by the Provider under this Agreement shall be stored and processed exclusively in the AWS EU-Central-1 Region (Frankfurt, Germany) data centers.
3. Data Protection: Provider complies with the General Data Protection Regulation (GDPR). All data is encrypted at rest using AES-256 and in transit using TLS 1.3. Unrestricted data access controls are in place.
4. Uptime SLA: Provider guarantees a monthly uptime service level of 99.99%. If uptime falls below this, Customer is eligible for service credits as defined in Exhibit B.
5. Incident Notification: Provider shall notify Customer of any confirmed security incident or data breach without undue delay, and in any event within twelve (12) hours after becoming aware of the incident.
6. Audit Rights: Customer, its internal auditors, and the Federal Financial Supervisory Authority (BaFin) shall have the right to audit and inspect Provider's systems and data centers on reasonable notice to verify compliance with regulatory requirements.
7. Termination: Either party may terminate this agreement for convenience upon ninety (90) days written notice. Customer may terminate immediately for material breach, or upon written instruction of its supervisor (BaFin).
8. Exit and Transition Assistance: Upon termination, Provider will cooperate to migrate Customer data and services to another provider or in-house within 90 days.
9. Subcontracting: Provider shall not delegate or subcontract the core hosting services to any third-party without prior written consent of the Customer.

This Agreement shall be governed by and construed in accordance with the laws of the Federal Republic of Germany.
`;

const MOCK_CONTRACT_2 = `
GHOST AGENT API LICENSE AGREEMENT
This License Agreement is entered into on June 1, 2025, between Solaris SE ("Customer"), Berlin, Germany, and Fireblocks Ltd ("Provider"), Tel Aviv, Israel.

1. Description of Services: Provider grants Customer a non-exclusive license to access the Fireblocks Wallet API for the purpose of initiating digital asset transactions.
2. Governing Law: This Agreement is governed by the laws of New York, USA.
3. SLAs: The Wallet API uptime is targeted at 99.9%. No credit terms are defined for failure.
4. Security: Provider utilizes multi-party computation (MPC) to secure keys.
5. Subcontracting: Provider may use sub-processors at its discretion, without notifying Customer.
`;

async function main() {
  console.log("Cleaning up database...");
  await prisma.auditLog.deleteMany();
  await prisma.remediationTask.deleteMany();
  await prisma.clauseFinding.deleteMany();
  await prisma.registerEntry.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.iCTService.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.legalEntity.deleteMany();
  await prisma.clauseRequirement.deleteMany();
  await prisma.subcontractor.deleteMany();
  await prisma.exitPlan.deleteMany();
  await prisma.incidentLog.deleteMany();
  await prisma.policySetting.deleteMany();

  console.log("Seeding DORA requirements...");
  const createdReqs = [];
  for (const r of DORA_REQUIREMENTS) {
    const dbReq = await prisma.clauseRequirement.create({
      data: r,
    });
    createdReqs.push(dbReq);
  }

  console.log("Seeding Legal Entities...");
  const bp = await prisma.legalEntity.create({
    data: {
      name: "Bitpanda Custody GmbH",
      lei: "529900X7V34HUX8L8R44",
      jurisdiction: "DE",
      regulatedStatus: true,
      licenceType: "CASP",
      competentAuthority: "BaFin",
    },
  });

  const sol = await prisma.legalEntity.create({
    data: {
      name: "Solaris SE",
      lei: "391200Z9E92M8V2R9L11",
      jurisdiction: "DE",
      regulatedStatus: true,
      licenceType: "EMI",
      competentAuthority: "BaFin",
    },
  });

  console.log("Seeding Vendors...");
  const aws = await prisma.vendor.create({
    data: {
      legalName: "Amazon Web Services EMEA SARL",
      groupName: "Amazon",
      country: "LU",
      lei: "5493006MGQQ3QG8L9081",
      serviceCategories: "Cloud, Infrastructure, Storage",
      concentrationTags: "Cloud Provider, Critical Infrastructure",
    },
  });

  const fb = await prisma.vendor.create({
    data: {
      legalName: "Fireblocks Ltd",
      groupName: "Fireblocks Group",
      country: "IL",
      lei: "", // Missing LEI to trigger warning
      serviceCategories: "Crypto Custody, Wallet APIs",
      concentrationTags: "SaaS, Blockchain Infrastructure",
    },
  });

  const sumsub = await prisma.vendor.create({
    data: {
      legalName: "Sum & Substance Ltd",
      groupName: "Sumsub",
      country: "GB",
      lei: "213800K1D2B9N8W7G455",
      serviceCategories: "KYC/AML Identity Verification",
      concentrationTags: "SaaS, Compliance Utility",
    },
  });

  console.log("Seeding Services...");
  const awsService = await prisma.iCTService.create({
    data: {
      vendorId: aws.id,
      legalEntityId: bp.id,
      serviceDescription: "AWS EC2 and RDS cloud hosting environment running Bitpanda transaction ledger.",
      supportedFunction: "Core Transaction Ledger and Account Balancing",
      dataProcessed: "Customer PII, Wallet Keys, Transaction Records",
      location: "Frankfurt (DE) Region Central-1",
      subcontractingStatus: "NO",
      substitutability: "DIFFICULT",
      exitPlanStatus: "APPROVED",
    },
  });

  const fbService = await prisma.iCTService.create({
    data: {
      vendorId: fb.id,
      legalEntityId: sol.id,
      serviceDescription: "Fireblocks API integrations for customer multi-party computation wallets.",
      supportedFunction: "Crypto Asset Custody Key Management",
      dataProcessed: "Wallet Keys, Crypto Transaction Metadata",
      location: "Global AWS Cloud (IL/US Regions)",
      subcontractingStatus: "YES",
      subcontractorDetails: "", // Empty to trigger warning
      substitutability: "DIFFICULT",
      exitPlanStatus: "NONE", // triggers critical warning
    },
  });

  const ssService = await prisma.iCTService.create({
    data: {
      vendorId: sumsub.id,
      legalEntityId: bp.id,
      serviceDescription: "KYC identity checks for onboarding Bitpanda retail customers.",
      supportedFunction: "Customer Onboarding Compliance Verification",
      dataProcessed: "Passports, Selfies, Address Verification Docs",
      location: "London, UK",
      subcontractingStatus: "NO",
      substitutability: "EASY",
      exitPlanStatus: "DRAFT",
    },
  });

  console.log("Seeding Contracts...");
  const c1 = await prisma.contract.create({
    data: {
      vendorId: aws.id,
      legalEntityId: bp.id,
      sourceFile: "AWS_Bitpanda_Hosting_2025.pdf",
      effectiveDate: new Date("2025-05-12"),
      renewalDate: new Date("2026-05-12"),
      terminationDate: new Date("2026-08-12"), // Imminent expiry (less than 90 days from May 20, 2026)
      governingLaw: "Germany",
      extractedText: MOCK_CONTRACT_1,
      provenanceMap: JSON.stringify({}),
    },
  });

  const c2 = await prisma.contract.create({
    data: {
      vendorId: fb.id,
      legalEntityId: sol.id,
      sourceFile: "Fireblocks_Solaris_API_Licence.docx",
      effectiveDate: new Date("2025-06-01"),
      renewalDate: null,
      terminationDate: null,
      governingLaw: "New York, USA",
      extractedText: MOCK_CONTRACT_2,
      provenanceMap: JSON.stringify({}),
    },
  });

  console.log("Seeding Criticality Assessments...");
  await prisma.criticalityAssessment.create({
    data: {
      serviceId: awsService.id,
      function: "Core Transaction Ledger and Account Balancing",
      scoringInputs: JSON.stringify({ substitutability: "DIFFICULT", customerImpact: "CRITICAL" }),
      result: "CRITICAL",
      confidence: 0.98,
      reviewer: "Compliance Lead",
      status: "APPROVED",
      evidence: "Service supports the core database storing retail balances. Outage freezes operations immediately.",
    },
  });

  await prisma.criticalityAssessment.create({
    data: {
      serviceId: fbService.id,
      function: "Crypto Asset Custody Key Management",
      scoringInputs: JSON.stringify({ substitutability: "DIFFICULT", customerImpact: "CRITICAL" }),
      result: "CRITICAL",
      confidence: 0.92,
      reviewer: null,
      status: "PENDING", // Needs review
      evidence: "Handles multi-party custody secrets. Ambiguity in subcontractor notifications requires lead assessment.",
    },
  });

  console.log("Seeding Clause Findings...");
  // Set up present clause findings for contract 1
  for (const req of createdReqs) {
    let status: "PRESENT" | "MISSING" | "PARTIAL" | "UNCLEAR" = "PRESENT";
    let evidence = `Extracted clause covering DORA requirements for ${req.requirementName}.`;
    
    if (req.regulatoryBasis.includes("30(2)(e)")) {
      evidence = `"... notify the customer of any security breach within 12 hours ..."`;
    } else if (req.regulatoryBasis.includes("30(2)(f)")) {
      evidence = `"... Customer and supervisor (BaFin) shall have the right to audit and inspect ..."`;
    }

    await prisma.clauseFinding.create({
      data: {
        contractId: c1.id,
        requirementId: req.id,
        status,
        extractedEvidence: evidence,
        confidence: 0.95,
        reviewerDecision: "APPROVED",
      },
    });
  }

  // Set up findings for contract 2 (has many gaps!)
  for (const req of createdReqs) {
    let status: "PRESENT" | "MISSING" | "PARTIAL" | "UNCLEAR" = "MISSING";
    let evidence = "";
    
    if (req.regulatoryBasis.includes("30(2)(a)")) {
      status = "PRESENT";
      evidence = `"... license to access the Fireblocks Wallet API ..."`;
    } else if (req.regulatoryBasis.includes("30(2)(g)")) {
      status = "PARTIAL";
      evidence = `"... Standard license renewal and cancellation terms apply ..."`;
    } else if (req.regulatoryBasis.includes("30(2)(i)")) {
      status = "MISSING";
      evidence = "No prior consent or veto controls found regarding sub-processors.";
    }

    const finding = await prisma.clauseFinding.create({
      data: {
        contractId: c2.id,
        requirementId: req.id,
        status,
        extractedEvidence: evidence || null,
        confidence: 0.88,
        reviewerDecision: null, // Needs review
      },
    });

    if (status === "MISSING" && req.severity === "HIGH") {
      // Create a remediation task
      await prisma.remediationTask.create({
        data: {
          findingId: finding.id,
          title: `Remediate missing contract clause: ${req.requirementName}`,
          description: `The clause requirement under ${req.regulatoryBasis} (${req.requirementName}) was assessed as MISSING for Fireblocks Ltd. Audit rights and transition clauses must be added before production.`,
          owner: "legal-reviewer@solaris.se",
          dueDate: new Date("2026-07-01"),
          severity: "HIGH",
          status: "OPEN",
        },
      });
    }
  }

  console.log("Seeding Register Entries...");
  // Register entry 1 (Valid)
  const re1 = await prisma.registerEntry.create({
    data: {
      legalEntityId: bp.id,
      vendorId: aws.id,
      serviceId: awsService.id,
      contractId: c1.id,
      criticality: "CRITICAL",
      mandatoryFields: JSON.stringify(["legalEntityName", "vendorName", "serviceDescription", "criticality", "lei"]),
      validationStatus: "VALID",
      lastReviewedAt: new Date("2026-01-15T00:00:00Z"),
      nextReviewDue: new Date("2027-01-15T00:00:00Z"),
    },
  });

  // Register entry 2 (Warning due to missing exit plan on critical service, missing LEI, USA governing law)
  const re2 = await prisma.registerEntry.create({
    data: {
      legalEntityId: sol.id,
      vendorId: fb.id,
      serviceId: fbService.id,
      contractId: c2.id,
      criticality: "CRITICAL",
      mandatoryFields: JSON.stringify(["legalEntityName", "vendorName", "serviceDescription", "criticality"]),
      validationStatus: "INVALID",
      validationErrors: JSON.stringify([
        "Critical service supporting 'Crypto Asset Custody Key Management' has no Exit Plan.",
        "Vendor (Fireblocks Ltd) lacks an LEI.",
        "Governing law is outside the EU (New York, USA).",
        "Multiple critical clause requirements are missing (Audit rights, Incident reports, Exit strategy)."
      ]),
      lastReviewedAt: new Date("2025-03-01T00:00:00Z"),
      nextReviewDue: new Date("2026-03-01T00:00:00Z"), // Overdue!
    },
  });

  console.log("Seeding Review Cycles...");
  await prisma.reviewCycle.create({
    data: {
      registerEntryId: re1.id,
      reviewedAt: new Date("2026-01-15T09:00:00Z"),
      reviewer: "Audrey CCO",
      notes: "Full annual compliance sign-off. Governing law, Exit plan, and AWS resilience verification complete.",
      status: "COMPLETED",
    },
  });

  console.log("Seeding Resilience Tests...");
  await prisma.resilienceTest.create({
    data: {
      serviceId: awsService.id,
      testType: "PENETRATION_TEST",
      testDate: new Date("2025-11-12T00:00:00Z"),
      status: "PASSED",
      findingsCount: 0,
      evidenceSummary: "External penetration test of AWS hosting environment. Zero high or critical severity vulnerabilities found.",
      nextScheduledDate: new Date("2026-11-12T00:00:00Z"),
    },
  });

  await prisma.resilienceTest.create({
    data: {
      serviceId: awsService.id,
      testType: "SCENARIO_DR",
      testDate: new Date("2026-02-15T00:00:00Z"),
      status: "PASSED",
      findingsCount: 1,
      evidenceSummary: "Disaster Recovery drill simulating region failure. Successfully failed over core transaction database to backup Equinix nodes in 12 minutes.",
      nextScheduledDate: new Date("2027-02-15T00:00:00Z"),
    },
  });

  await prisma.resilienceTest.create({
    data: {
      serviceId: fbService.id,
      testType: "VULNERABILITY_ASSESSMENT",
      testDate: new Date("2026-05-10T10:00:00Z"),
      status: "FAILED",
      findingsCount: 3,
      evidenceSummary: "Quarterly vulnerability assessment. Identified 3 high-severity open CVEs in the API routing gateway that allow potential session manipulation. Remediation is in progress.",
      nextScheduledDate: new Date("2026-08-10T00:00:00Z"),
    },
  });

  console.log("Seeding Subcontractors...");
  await prisma.subcontractor.create({
    data: {
      serviceId: fbService.id,
      name: "Cloudflare Inc",
      lei: "549300V5T1J3Z5K9L182",
      country: "US",
      serviceDescription: "Edge DDoS protection and CDN services",
      criticality: "CRITICAL",
      location: "Global Edge Nodes (Anycast)",
    },
  });

  console.log("Seeding Exit Plans...");
  await prisma.exitPlan.create({
    data: {
      serviceId: awsService.id,
      title: "Exit Strategy - Bitpanda Core Ledger Migration",
      strategy: "Primary fallback is replication to secondary private cloud hosting in Frankfurt (Equinix FR2). Continuous block replication of SQL databases is validated bi-annually. Expected cut-over time is under 4 hours.",
      testedDate: new Date("2026-02-15"),
      alternativeVendor: "Equinix Germany GmbH",
      status: "APPROVED",
      reviewer: "Chief Resilience Officer",
    },
  });

  console.log("Seeding Incidents...");
  // Resolved incident
  await prisma.incidentLog.create({
    data: {
      serviceId: awsService.id,
      title: "AWS EC2 Instance Degradation - EU-Central-1",
      severity: "MINOR",
      description: "A minor hardware degradation affected the primary database instance. Failover completed automatically within 45 seconds.",
      incidentDate: new Date("2026-04-10T14:30:00Z"),
      downtimeMinutes: 1,
      status: "RESOLVED",
      remediationAction: "AWS replaced the underlying hardware node. Automated failover confirmed working.",
    },
  });

  // Active outage incident
  await prisma.incidentLog.create({
    data: {
      serviceId: fbService.id,
      title: "Fireblocks API Connection Timed Out",
      severity: "MAJOR",
      description: "Latency spike in European gateway routing led to multiple failed API calls for wallet key operations.",
      incidentDate: new Date("2026-05-19T22:15:00Z"),
      downtimeMinutes: 35,
      status: "ACTIVE",
      remediationAction: "Fireblocks engineering is investigating routing issues. Solaris SE team has routed secondary calls through US gateway.",
    },
  });

  console.log("Seeding Policy Settings...");
  await prisma.policySetting.create({
    data: {
      key: "enforce_eea_data_residency",
      value: "true",
      description: "Reduce compliance score if data storage or processing locations are outside the European Economic Area (EEA).",
    },
  });

  await prisma.policySetting.create({
    data: {
      key: "enforce_eu_governing_law",
      value: "true",
      description: "Flag contracts whose governing law is outside EU/EEA jurisdictions.",
    },
  });

  await prisma.policySetting.create({
    data: {
      key: "enforce_exit_plan_for_critical_services",
      value: "true",
      description: "Enforce that critical or important functions must have a validated, approved exit plan.",
    },
  });

  console.log("Audit Logs...");
  await prisma.auditLog.create({
    data: {
      actor: "System Initializer",
      action: "SEED_DATABASE",
      object: "Database",
      afterSnapshot: "Successfully created default register entries, requirements, mock contracts, and active resilience data.",
    },
  });

  console.log("Seeding Integration Settings...");
  await prisma.integrationSetting.create({
    data: {
      systemType: "GRC",
      name: "OneTrust GRC",
      status: "DISCONNECTED",
      endpointUrl: "https://api.onetrust.com/api/v1/grc",
      authConfig: JSON.stringify({ clientId: "onetrust_oauth_client", scope: "grc.read grc.write" }),
    },
  });

  await prisma.integrationSetting.create({
    data: {
      systemType: "PROCUREMENT",
      name: "Ironclad CLM",
      status: "DISCONNECTED",
      endpointUrl: "https://api.ironcladapp.com/public/v1",
      authConfig: JSON.stringify({ webhookUrl: "http://localhost:3000/api/integrations/procurement" }),
    },
  });

  await prisma.integrationSetting.create({
    data: {
      systemType: "DMS",
      name: "Google Drive Folder Sync",
      status: "DISCONNECTED",
      endpointUrl: "https://www.googleapis.com/drive/v3/files",
      authConfig: JSON.stringify({ folderId: "dora_register_exports" }),
    },
  });

  await prisma.integrationSetting.create({
    data: {
      systemType: "IAM",
      name: "Okta IDP Mappings",
      status: "DISCONNECTED",
      endpointUrl: "https://okta.solaris-group.com",
      authConfig: JSON.stringify({
        groupMapping: [
          { group: "Okta-DORA-CCO", role: "Compliance Lead" },
          { group: "Okta-DORA-Auditors", role: "Auditor" }
        ]
      }),
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
