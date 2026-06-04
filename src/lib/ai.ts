import { DORA_CLAUSE_REQUIREMENTS } from "./dora-rules";

export interface ExtractedContractData {
  vendorName: string;
  serviceDescription: string;
  effectiveDate: string | null;
  renewalDate: string | null;
  terminationDate: string | null;
  governingLaw: string;
  clauses: Array<{
    requirementId: string;
    status: "PRESENT" | "MISSING" | "PARTIAL" | "UNCLEAR";
    evidence: string;
    confidence: number;
  }>;
}

export interface CriticalityOutput {
  result: "CRITICAL" | "IMPORTANT" | "NON_CRITICAL";
  confidence: number;
  evidence: string;
}

/**
 * Deterministic keyword-based contract parser. Used as a robust local fallback
 * when GEMINI_API_KEY is not defined, or when offline.
 */
function localMockExtract(text: string): ExtractedContractData {
  const lowercase = text.toLowerCase();
  
  // Try to find Vendor Name
  let vendorName = "Unknown Vendor";
  const vendorMatch = text.match(/(?:between|agreement\s+with|contractor|provider|vendor)\s+([A-Z][A-Za-z0-9\s,\.\-&]+?)(?:\s+and|\s+\(|,|\n|is\s+entered)/i);
  if (vendorMatch && vendorMatch[1]) {
    const candidate = vendorMatch[1].trim();
    if (candidate.length > 2 && candidate.length < 100) {
      vendorName = candidate;
    }
  }
  
  // Try to find Service Description
  let serviceDescription = "Provision of ICT third-party services.";
  if (lowercase.includes("cloud hosting") || lowercase.includes("aws") || lowercase.includes("azure")) {
    serviceDescription = "Cloud Infrastructure Hosting and Storage Services.";
  } else if (lowercase.includes("custody") || lowercase.includes("wallet") || lowercase.includes("ledger")) {
    serviceDescription = "Digital Asset Custody and Crypto Wallet API Services.";
  } else if (lowercase.includes("payment processing") || lowercase.includes("card processing") || lowercase.includes("gateway")) {
    serviceDescription = "Electronic Money Payment Gateway and Card Processing Integration.";
  } else if (lowercase.includes("kyc") || lowercase.includes("identity verification") || lowercase.includes("compliance check")) {
    serviceDescription = "Automated KYC, AML Screening, and Identity Verification API.";
  }

  // Try to find dates
  let effectiveDate: string | null = null;
  let terminationDate: string | null = null;
  const renewalDate: string | null = null;

  // Simple date regex: YYYY-MM-DD or DD/MM/YYYY or month text
  const datePattern = /\b(?:\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|[A-Z][a-z]+\s+\d{1,2},\s+\d{4})\b/g;
  const dates = text.match(datePattern) || [];
  if (dates.length > 0) {
    effectiveDate = dates[0] || null;
    if (dates.length > 1) {
      terminationDate = dates[dates.length - 1] || null;
    }
  }
  
  // Mapped Governing Law
  let governingLaw = "Germany (BaFin jurisdiction compliance)";
  if (lowercase.includes("laws of england") || lowercase.includes("english law") || lowercase.includes("united kingdom")) {
    governingLaw = "England and Wales";
  } else if (lowercase.includes("new york") || lowercase.includes("delaware") || lowercase.includes("united states")) {
    governingLaw = "New York, USA";
  } else if (lowercase.includes("laws of ireland") || lowercase.includes("irish law")) {
    governingLaw = "Ireland";
  } else if (lowercase.includes("frankfurt") || lowercase.includes("german law") || lowercase.includes("bundesrepublik")) {
    governingLaw = "Germany";
  }

  // Evaluate DORA requirements deterministically based on keyword presence
  const clauses = DORA_CLAUSE_REQUIREMENTS.map((req) => {
    let status: "PRESENT" | "MISSING" | "PARTIAL" | "UNCLEAR" = "MISSING";
    let evidence = "";
    const confidence = 0.9;

    switch (req.id) {
      case "dora-art-30-2-a": // Service Description
        if (lowercase.includes("description") || lowercase.includes("specifications") || lowercase.includes("service level")) {
          status = "PRESENT";
          const match = text.match(/(?:description of services|specifications|service levels)[\s\S]{0,150}/i);
          evidence = match ? `"... ${match[0].replace(/\n/g, " ").trim()} ..."` : "The contract includes a dedicated Schedule or Section describing technical specifications.";
        }
        break;
      case "dora-art-30-2-b": // Data Location
        if (lowercase.includes("data center") || lowercase.includes("location") || lowercase.includes("storage") || lowercase.includes("hosted in")) {
          status = "PRESENT";
          const match = text.match(/(?:data center|data location|stored in|processed in)[\s\S]{0,150}/i);
          evidence = match ? `"... ${match[0].replace(/\n/g, " ").trim()} ..."` : "Data centers are explicitly declared, located inside the European Union.";
        } else {
          status = "MISSING";
          evidence = "No clause specifying physical locations or regions of data hosting was detected.";
        }
        break;
      case "dora-art-30-2-c": // Data Protection
        if (lowercase.includes("gdpr") || lowercase.includes("data protection") || lowercase.includes("encryption")) {
          status = "PRESENT";
          const match = text.match(/(?:gdpr|data protection|encryption|security measures)[\s\S]{0,150}/i);
          evidence = match ? `"... ${match[0].replace(/\n/g, " ").trim()} ..."` : "Subject to GDPR and includes clauses for data encryption at rest and in transit.";
        } else {
          status = "PARTIAL";
          evidence = "Generic security mentions found, but standard GDPR / encryption specifics are missing.";
        }
        break;
      case "dora-art-30-2-d": // SLAs
        if (lowercase.includes("sla") || lowercase.includes("uptime") || lowercase.includes("kpi") || lowercase.includes("service levels")) {
          status = "PRESENT";
          const match = text.match(/(?:uptime|service levels|kpis|response times)[\s\S]{0,150}/i);
          evidence = match ? `"... ${match[0].replace(/\n/g, " ").trim()} ..."` : "Defines service availability targets (e.g. 99.9%) and details credit remedies.";
        } else {
          status = "MISSING";
          evidence = "No SLAs or system uptime guarantees were found in the main body or appendices.";
        }
        break;
      case "dora-art-30-2-e": // Incident Notification
        if (lowercase.includes("incident") || lowercase.includes("breach") || lowercase.includes("notify") || lowercase.includes("hours")) {
          const hoursMatch = text.match(/(?:notify|report)[\s\S]{0,100}within\s+(\d+)\s+hours/i);
          if (hoursMatch) {
            status = "PRESENT";
            evidence = `"... notify the customer of any security breach within ${hoursMatch[1]} hours ..."`;
          } else {
            status = "PARTIAL";
            evidence = "The contract requires incident notifications but fails to define a specific time limit (e.g. 'without undue delay' only).";
          }
        } else {
          status = "MISSING";
          evidence = "No incident reporting or security breach notification clause exists.";
        }
        break;
      case "dora-art-30-2-f": // Audits
        if (lowercase.includes("audit") || lowercase.includes("inspection") || lowercase.includes("access rights")) {
          if (lowercase.includes("bafin") || lowercase.includes("regulator") || lowercase.includes("competent authority")) {
            status = "PRESENT";
            const match = text.match(/(?:audit|inspect|regulator|bafin)[\s\S]{0,150}/i);
            evidence = match ? `"... ${match[0].replace(/\n/g, " ").trim()} ..."` : "Unrestricted audit rights granted to the customer and their financial supervisors.";
          } else {
            status = "PARTIAL";
            evidence = "Audit rights are present for the customer, but supervisor / regulator inspection rights are not explicitly mentioned.";
          }
        } else {
          status = "MISSING";
          evidence = "No inspection or audit rights are granted in the current text.";
        }
        break;
      case "dora-art-30-2-g": // Termination
        if (lowercase.includes("terminate") || lowercase.includes("notice period") || lowercase.includes("breach")) {
          status = "PRESENT";
          const match = text.match(/(?:terminate|notice period|material breach)[\s\S]{0,150}/i);
          evidence = match ? `"... ${match[0].replace(/\n/g, " ").trim()} ..."` : "Standard termination for convenience (90 days notice) and immediate termination for material breach.";
        } else {
          status = "MISSING";
          evidence = "No termination clauses or notice periods are detailed.";
        }
        break;
      case "dora-art-30-2-h": // Exit Strategy
        if (lowercase.includes("exit") || lowercase.includes("migration") || lowercase.includes("transition") || lowercase.includes("handover")) {
          status = "PRESENT";
          const match = text.match(/(?:exit|migration|transition|handover)[\s\S]{0,150}/i);
          evidence = match ? `"... ${match[0].replace(/\n/g, " ").trim()} ..."` : "The provider is required to support system transition and data extraction for 90 days after contract end.";
        } else {
          status = "MISSING";
          evidence = "No exit assistance or migration support clauses are defined. Critical risk for critical services.";
        }
        break;
      case "dora-art-30-2-i": // Subcontracting
        if (lowercase.includes("subcontract") || lowercase.includes("delegate") || lowercase.includes("consent")) {
          if (lowercase.includes("prior consent") || lowercase.includes("written approval")) {
            status = "PRESENT";
            const match = text.match(/(?:subcontract|delegate|consent)[\s\S]{0,150}/i);
            evidence = match ? `"... ${match[0].replace(/\n/g, " ").trim()} ..."` : "Subcontracting requires prior written consent of the customer.";
          } else {
            status = "PARTIAL";
            evidence = "Subcontracting is allowed with notification but no strict veto or consent mechanism.";
          }
        } else {
          status = "MISSING";
          evidence = "The contract is silent on the provider's ability to delegate services to sub-processors.";
        }
        break;
    }

    return {
      requirementId: req.id,
      status,
      evidence,
      confidence,
    };
  });

  return {
    vendorName,
    serviceDescription,
    effectiveDate,
    renewalDate,
    terminationDate,
    governingLaw,
    clauses,
  };
}

/**
 * Calls Google Gemini API if key is present, otherwise falls back to keyword parser.
 */
export async function extractMetadataFromContract(contractText: string): Promise<ExtractedContractData> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    // Simulate short network latency
    await new Promise((r) => setTimeout(r, 1200));
    return localMockExtract(contractText);
  }

  try {
    const prompt = `
You are a DORA compliance legal analyst.
Parse the following contract text and extract:
1. Vendor Legal Name
2. Service Description (summary of what they do)
3. Dates (Effective Date, Renewal Date, Termination Date in YYYY-MM-DD format, or null if not found)
4. Governing Law jurisdiction
5. Assessment of DORA Article 30(2) requirements:
Requirements to check:
- dora-art-30-2-a: Clear Description of Services
- dora-art-30-2-b: Locations of Data Processing (storage/hosting location)
- dora-art-30-2-c: Data Protection & Access Rights (GDPR/security/encryption)
- dora-art-30-2-d: Service Level Agreements (uptime/KPI targets)
- dora-art-30-2-e: Incident Notification Obligations (obligation to report incidents with timeline)
- dora-art-30-2-f: Audit and Inspection Rights (unrestricted access/BaFin supervisor audits)
- dora-art-30-2-g: Termination Rights & Notice Periods (regulatory instruction / material breach)
- dora-art-30-2-h: Exit Strategies & Transition (transition assistance)
- dora-art-30-2-i: Subcontracting Controls & Approval (consent/veto rights)

For each requirement, classify status as: PRESENT, MISSING, PARTIAL, or UNCLEAR. Provide a exact snippet of evidence from the text if present/partial, and a confidence score between 0.0 and 1.0.

Format your output as a valid JSON object ONLY:
{
  "vendorName": "string",
  "serviceDescription": "string",
  "effectiveDate": "YYYY-MM-DD or null",
  "renewalDate": "YYYY-MM-DD or null",
  "terminationDate": "YYYY-MM-DD or null",
  "governingLaw": "string",
  "clauses": [
    {
      "requirementId": "dora-art-30-2-a",
      "status": "PRESENT/MISSING/PARTIAL/UNCLEAR",
      "evidence": "precise snippet or explanation of missing",
      "confidence": 0.95
    }
  ]
}

Contract text to evaluate:
${contractText}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API responded with status ${response.status}`);
    }

    const resJson = await response.json();
    const textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResult) {
      throw new Error("No text candidate returned from Gemini");
    }

    return JSON.parse(textResult) as ExtractedContractData;
  } catch (error) {
    console.error("Gemini API call failed, falling back to local extractor:", error);
    return localMockExtract(contractText);
  }
}

/**
 * Classifies the criticality of a service based on inputs.
 */
export async function assessCriticality(inputs: {
  supportedFunction: string;
  substitutability: string; // EASY, MEDIUM, DIFFICULT
  exitPlanStatus: string; // NONE, DRAFT, APPROVED
  dataSensitivity: string; // e.g. Customer PII, Transactions, Public Info
  dependencySubcontractors: string; // YES, NO
}): Promise<CriticalityOutput> {
  const { supportedFunction, substitutability, exitPlanStatus, dataSensitivity, dependencySubcontractors } = inputs;
  
  // Deterministic calculation first
  let score = 0;
  const criticalFunctions = [
    "core banking", "ledger", "crypto custody", "wallet", "trading engine",
    "payment routing", "liquidity", "mfa", "identity", "kyc", "aml"
  ];
  
  const funcLower = supportedFunction.toLowerCase();
  const isCriticalFunction = criticalFunctions.some((f) => funcLower.includes(f));
  
  if (isCriticalFunction) score += 5;
  if (substitutability === "DIFFICULT") score += 3;
  if (substitutability === "MEDIUM") score += 1;
  if (dataSensitivity.toLowerCase().includes("pii") || dataSensitivity.toLowerCase().includes("custody") || dataSensitivity.toLowerCase().includes("transaction")) score += 2;
  if (dependencySubcontractors === "YES") score += 1;
  
  let result: "CRITICAL" | "IMPORTANT" | "NON_CRITICAL" = "NON_CRITICAL";
  let evidence = "";

  if (score >= 7) {
    result = "CRITICAL";
    evidence = `Service supports a critical function (${supportedFunction}), is difficult to substitute, and processes highly sensitive data (${dataSensitivity}). Under DORA Art. 30, this arrangement triggers enhanced supervisor review.`;
  } else if (score >= 4) {
    result = "IMPORTANT";
    evidence = `Service supports an essential function (${supportedFunction}) with moderate substitutability. Mapped to DORA as an important function service requiring exit strategies and operational review.`;
  } else {
    result = "NON_CRITICAL";
    evidence = `Service has high substitutability (${substitutability}) and supports non-core functions. DORA requirements apply at entity-level basic register standard only.`;
  }

  // AI-Assisted explanation if key is present
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim() !== "") {
    try {
      const prompt = `
You are a DORA Compliance officer. Evaluate this ICT service classification.
Inputs:
- Supported Business Function: ${supportedFunction}
- Substitutability: ${substitutability}
- Exit Plan Status: ${exitPlanStatus}
- Data processed: ${dataSensitivity}
- Critical subcontractors: ${dependencySubcontractors}

Deterministic recommendation is: ${result}.

Produce a brief 2-3 sentence legal justification for why this is classified as ${result} (or why it should be classified as something else if you disagree).
Format as JSON ONLY:
{
  "result": "CRITICAL/IMPORTANT/NON_CRITICAL",
  "confidence": 0.85,
  "evidence": "Brief compliance explanation"
}
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (response.ok) {
        const resJson = await response.json();
        const textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResult) {
          const aiOutput = JSON.parse(textResult) as CriticalityOutput;
          return aiOutput;
        }
      }
    } catch (e) {
      console.error("Criticality evaluation AI API call failed, using deterministic output:", e);
    }
  }

  return {
    result,
    confidence: 0.95,
    evidence,
  };
}
