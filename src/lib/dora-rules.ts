export interface DORAClauseRequirement {
  id: string;
  regulatoryBasis: string;
  requirementName: string;
  applicability: "ALL_ICT" | "CRITICAL_ONLY";
  expectedPattern: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
}

export const DORA_CLAUSE_REQUIREMENTS: DORAClauseRequirement[] = [
  {
    id: "dora-art-30-2-a",
    regulatoryBasis: "DORA Art. 30(2)(a)",
    requirementName: "Clear Description of Services",
    applicability: "ALL_ICT",
    expectedPattern: "description of functions, service levels, and specifications",
    severity: "MEDIUM",
    description: "The contract must contain a clear description of all functions and service levels to be provided by the ICT third-party service provider."
  },
  {
    id: "dora-art-30-2-b",
    regulatoryBasis: "DORA Art. 30(2)(b)",
    requirementName: "Locations of Data Processing",
    applicability: "ALL_ICT",
    expectedPattern: "location of data storage, processing, and data centers",
    severity: "HIGH",
    description: "The contract must specify the regions, countries, or data center locations where the ICT services are provided and where data is to be processed."
  },
  {
    id: "dora-art-30-2-c",
    regulatoryBasis: "DORA Art. 30(2)(c)",
    requirementName: "Data Protection & Access Rights",
    applicability: "ALL_ICT",
    expectedPattern: "personal data protection, access controls, encryption, integrity",
    severity: "HIGH",
    description: "The contract must contain provisions on data protection, encryption, security logs, and access permissions in line with GDPR and DORA security standards."
  },
  {
    id: "dora-art-30-2-d",
    regulatoryBasis: "DORA Art. 30(2)(d)",
    requirementName: "Service Level Agreements (SLAs)",
    applicability: "ALL_ICT",
    expectedPattern: "performance metrics, target service levels, monitoring, response times",
    severity: "MEDIUM",
    description: "The contract must define clear target service levels (KPIs), reporting frequency, and financial/operational remedies for service breaches."
  },
  {
    id: "dora-art-30-2-e",
    regulatoryBasis: "DORA Art. 30(2)(e)",
    requirementName: "Incident Notification Obligations",
    applicability: "ALL_ICT",
    expectedPattern: "reporting of security incidents, breach notification timelines, assistance",
    severity: "HIGH",
    description: "The provider must be contractually obligated to assist the financial entity during ICT incidents and report any security incident without undue delay (ideally within 4-24 hours)."
  },
  {
    id: "dora-art-30-2-f",
    regulatoryBasis: "DORA Art. 30(2)(f)",
    requirementName: "Audit and Inspection Rights",
    applicability: "ALL_ICT",
    expectedPattern: "unrestricted access, physical audits, third-party certification, BaFin access",
    severity: "HIGH",
    description: "The contract must grant the financial entity and its competent supervisors (like BaFin) unrestricted rights of access, inspection, and audit to the provider's systems and sites."
  },
  {
    id: "dora-art-30-2-g",
    regulatoryBasis: "DORA Art. 30(2)(g)",
    requirementName: "Termination Rights & Notice Periods",
    applicability: "ALL_ICT",
    expectedPattern: "termination for material breach, regulatory instruction, minimum notice",
    severity: "HIGH",
    description: "The contract must specify termination rights, allowing the financial entity to terminate for material breaches, regulatory orders, or insolvency, with appropriate notice periods."
  },
  {
    id: "dora-art-30-2-h",
    regulatoryBasis: "DORA Art. 30(2)(h)",
    requirementName: "Exit Strategies & Transition",
    applicability: "CRITICAL_ONLY",
    expectedPattern: "exit plan, migration assistance, continuity of services, data handover",
    severity: "HIGH",
    description: "For critical functions, the contract must establish an exit plan and obligate the provider to assist in migrating data/services to another provider or in-house without disruption."
  },
  {
    id: "dora-art-30-2-i",
    regulatoryBasis: "DORA Art. 30(2)(i)",
    requirementName: "Subcontracting Controls & Approval",
    applicability: "ALL_ICT",
    expectedPattern: "prior written consent, notification of sub-processors, liability, right to object",
    severity: "MEDIUM",
    description: "The contract must state whether subcontracting is permitted and require prior written consent or notification with veto rights before a critical sub-processor is appointed."
  }
];
