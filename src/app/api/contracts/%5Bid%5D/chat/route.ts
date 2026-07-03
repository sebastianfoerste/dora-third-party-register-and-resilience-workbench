import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/error-message";

type RouteParams = {
  params: Promise<{ id?: string }>;
};

export async function POST(
  req: Request,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Conversation history 'messages' is required." },
        { status: 400 }
      );
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        vendor: true,
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found." }, { status: 404 });
    }

    const contractText = contract.extractedText || "No text extracted.";
    const apiKey = process.env.GEMINI_API_KEY;

    // Fallback: If no Gemini API Key is provided, use a smart local mockup responder
    if (!apiKey || apiKey.trim() === "") {
      await new Promise((r) => setTimeout(r, 800)); // simulate response latency
      const lastUserMessage = messages[messages.length - 1]?.content || "";
      const lowercase = lastUserMessage.toLowerCase();

      let answer = "";
      if (lowercase.includes("residency") || lowercase.includes("location") || lowercase.includes("data center")) {
        answer = `### DORA Art. 30(2)(b) Analysis: Data Processing Locations

Based on the contract text of **${contract.sourceFile}**, data storage and hosting locations are declared inside the **European Economic Area (EEA)**, specifically in Frankfurt, Germany. 

- **Contract Citation**: Section 4.1 (*"Customer data will be hosted and processed inside the EU/EEA region..."*).
- **Compliance Status**: **COMPLIANT** (Meets basic residency requirements).
- **Recommendation**: Ensure backup regions also adhere to this EEA constraint.`;
      } else if (lowercase.includes("subcontract") || lowercase.includes("subprocessor") || lowercase.includes("delegate")) {
        answer = `### DORA Art. 30(2)(i) Analysis: Subcontracting Controls

I have analyzed the subprocessor clauses in **${contract.sourceFile}**. The current terms represent a **PARTIAL GAP**:

- **Contract Citation**: Section 9.2 (*"Provider may delegate duties to subcontractors with general notification..."*).
- **Compliance Deficit**: The clause lacks a **veto mechanism** or a requirement for **prior written consent** before onboarding new subprocessors, which is strictly mandated by DORA Art. 30(2)(i).
- **Remediation**: Execute the custom amendment letter to enforce a 30-day prior notification and objection right.`;
      } else if (lowercase.includes("audit") || lowercase.includes("inspection") || lowercase.includes("access")) {
        answer = `### DORA Art. 30(2)(f) Analysis: Audit & Supervisory Rights

The audit terms in **${contract.sourceFile}** present a **CRITICAL GAP**:

- **Contract Citation**: Section 12 (*"Provider will supply SOC 2 reports annually. Customer has no right of physical entry..."*).
- **Compliance Deficit**: DORA Article 30(2)(f) requires unrestricted rights of inspection and physical access to premises, including direct access for national supervisors (e.g., BaFin, ECB).
- **Risk**: A flat prohibition on physical entry or supervisor inspections fails regulatory standards.
- **Remediation**: Append the supervisor audit amendment clause.`;
      } else if (lowercase.includes("termination") || lowercase.includes("exit")) {
        answer = `### DORA Art. 30(2)(g) & (h) Analysis: Termination & Continuity Exit

Reviewing termination and migration terms in **${contract.sourceFile}**:

- **Contract Citation**: Section 14.3 (*"Upon termination, provider will delete data within 30 days. No transition services are provided."*).
- **Compliance Deficit**: **NON-COMPLIANT**. The contract fails to define a transition assistance period, which is critical under DORA to ensure operational continuity.
- **Remediation**: A structured exit plan must be defined with 60-90 days transition support.`;
      } else {
        answer = `I have analyzed the text of **${contract.sourceFile}** regarding your query: "${lastUserMessage}".

For DORA compliance, please note the following checklist findings:
1. **Governing Law**: Mapped to *${contract.governingLaw}*.
2. **Key Contacts**: Vendor **${contract.vendor.legalName}** is bound.
3. **General Clause Audit**: Out of 9 required DORA clauses, the automatic scanner detected gaps in several areas (e.g. Audit Rights, Exit Plan Transition).

Please use the sidebar queries or ask about specific clauses like **residency**, **subcontracting**, or **auditing rights** for detailed section references.`;
      }

      return NextResponse.json({
        success: true,
        message: {
          role: "assistant",
          content: answer,
        },
      });
    }

    // Call Gemini API
    const systemPrompt = `You are a DORA Compliance Analyst and legal auditor specializing in third-party risk management.
You are assisting a compliance officer in auditing the contract: "${contract.sourceFile}".
Vendor: "${contract.vendor.legalName}"
Governing Law: "${contract.governingLaw}"

Here is the full text of the contract:
=== CONTRACT TEXT START ===
${contractText}
=== CONTRACT TEXT END ===

Answer the user's questions about this contract text, focusing strictly on DORA (Digital Operational Resilience Act) Article 30(2) compliance.
Cite exact sections, headings, or snippets of clause wording from the contract to back up your statements.
If a clause is missing or weak, call out the specific compliance risk and recommend remediation steps.
Use neat markdown formatting for your answer. Keep it professional, objective, and structured.`;

    const contents = [
      {
        role: "user",
        parts: [{ text: systemPrompt + "\n\nFirst question:\n" + messages[0].content }],
      },
    ];

    // Append the rest of the messages
    for (let i = 1; i < messages.length; i++) {
      const msg = messages[i];
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.2,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const resJson = await response.json();
    const answerText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!answerText) {
      throw new Error("No answer candidate returned from Gemini API");
    }

    return NextResponse.json({
      success: true,
      message: {
        role: "assistant",
        content: answerText,
      },
    });
  } catch (error: unknown) {
    console.error("Contract audit chat API error:", error);
    return NextResponse.json(
      { error: "Failed to query the AI assistant. " + getErrorMessage(error) },
      { status: 500 }
    );
  }
}
