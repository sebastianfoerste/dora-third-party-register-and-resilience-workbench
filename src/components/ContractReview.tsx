"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ContractEvidenceMap } from "@/lib/contract-evidence-map";

interface FindingItem {
  id: string;
  requirementId: string;
  status: string;
  extractedEvidence: string | null;
  confidence: number;
  reviewerDecision: string | null;
  reviewerComments: string | null;
  requirement: {
    regulatoryBasis: string;
    requirementName: string;
    severity: string;
    description: string;
  };
}

interface ContractDetail {
  id: string;
  sourceFile: string;
  effectiveDate: string | Date | null;
  terminationDate: string | Date | null;
  governingLaw: string;
  extractedText: string | null;
  vendor: { legalName: string; lei: string | null };
  legalEntity: { name: string };
  clauseFindings: FindingItem[];
}

type FindingStatus = "PRESENT" | "MISSING" | "PARTIAL" | "UNCLEAR";

function normalizeFindingStatus(value: string): FindingStatus {
  return value === "PRESENT" || value === "MISSING" || value === "PARTIAL" || value === "UNCLEAR"
    ? value
    : "UNCLEAR";
}

interface Props {
  contract: ContractDetail;
  evidenceMap?: ContractEvidenceMap;
}

export default function ContractReview({ contract, evidenceMap }: Props) {
  const router = useRouter();
  const [findings, setFindings] = useState<FindingItem[]>(contract.clauseFindings);
  const [editingFindingId, setEditingFindingId] = useState<string | null>(null);

  // AI Chat States
  const [activeTab, setActiveTab] = useState<"ocr" | "chat">("ocr");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [sendingChat, setSendingChat] = useState(false);

  const suggestedQueries = [
    "Verify data residency and locations under Art. 30(2)(b)",
    "Check whether subcontracting requires prior written approval (Art. 30(2)(i))",
    "Is there an unrestricted right of inspection and supervisor audit? (Art. 30(2)(f))",
    "Does the termination clause allow emergency termination? (Art. 30(2)(g))",
  ];

  const handleSendChat = async (messageText = chatInput) => {
    if (!messageText.trim() || sendingChat) return;

    const newMessages = [...chatMessages, { role: "user" as const, content: messageText }];
    setChatMessages(newMessages);
    setChatInput("");
    setSendingChat(true);

    try {
      const response = await fetch(`/api/contracts/${contract.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const res = await response.json();
      if (res.success && res.message) {
        setChatMessages((prev) => [...prev, res.message]);
      } else {
        alert(res.error || "Failed to receive response from AI agent.");
      }
    } catch (err) {
      console.error(err);
      alert("Error sending message to contract auditor.");
    } finally {
      setSendingChat(false);
    }
  };

  const handleSendSuggested = (query: string) => {
    handleSendChat(query);
  };

  // Override Form States
  const [overrideStatus, setOverrideStatus] = useState<FindingStatus>("PRESENT");
  const [overrideDecision, setOverrideDecision] = useState<string>("OVERRIDDEN");
  const [overrideComments, setOverrideComments] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const startEdit = (finding: FindingItem) => {
    setEditingFindingId(finding.id);
    setOverrideStatus(normalizeFindingStatus(finding.status));
    setOverrideDecision(finding.reviewerDecision || "OVERRIDDEN");
    setOverrideComments(finding.reviewerComments || "");
  };

  const handleSaveReview = async (findingId: string) => {
    setUpdatingId(findingId);
    try {
      const response = await fetch(`/api/findings/${findingId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: overrideStatus,
          reviewerDecision: overrideDecision,
          reviewerComments: overrideComments,
        }),
      });

      const res = await response.json();
      if (res.success) {
        // Update local state
        setFindings((prev) =>
          prev.map((f) => (f.id === findingId ? { ...f, ...res.finding } : f))
        );
        setEditingFindingId(null);
        router.refresh();
      } else {
        alert(res.error || "Failed to save human review.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save human review.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Score calculations
  const presentCount = findings.filter((f) => f.status === "PRESENT").length;
  const compliancePct = findings.length > 0 ? Math.round((presentCount / findings.length) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
            <Link href="/contracts" style={{ color: "var(--color-brand)", textDecoration: "none" }}>Contracts</Link>
            <span>/</span>
            <span>{contract.sourceFile}</span>
          </div>
          <h1 className="page-title">{contract.sourceFile}</h1>
          <p className="page-subtitle">
            Vendor: <strong>{contract.vendor.legalName}</strong> | Entity: <strong>{contract.legalEntity.name}</strong>
          </p>
        </div>

        {/* Contract Compliance Gauge */}
        <div className="card" style={{ padding: "0.85rem 1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
              Contract Compliance Score
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-display)", color: compliancePct > 80 ? "var(--color-brand)" : compliancePct > 50 ? "var(--color-warning)" : "var(--color-error)" }}>
              {compliancePct}%
            </div>
          </div>
          <div style={{ width: "80px", height: "8px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ width: `${compliancePct}%`, height: "100%", backgroundColor: compliancePct > 80 ? "var(--color-brand)" : compliancePct > 50 ? "var(--color-warning)" : "var(--color-error)" }} />
          </div>
        </div>
      </div>

      {evidenceMap && (
        <section className="card" style={{ marginBottom: "1.25rem", padding: "1rem 1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", marginBottom: "0.85rem" }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
                Contract Evidence Map
              </div>
              <h2 style={{ fontSize: "1rem", marginTop: "0.2rem", color: "var(--text-primary)" }}>
                Metadata-only proof surface
              </h2>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: "760px" }}>
                {evidenceMap.reviewNotice}
              </p>
            </div>
            <div style={{ textAlign: "right", minWidth: "210px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Digest
              </div>
              <code style={{ fontSize: "0.72rem", color: "var(--color-brand)", wordBreak: "break-all" }}>
                {evidenceMap.digest.slice(0, 24)}
              </code>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "0.9rem" }}>
            <div style={{ border: "1px solid var(--border-color)", borderRadius: "6px", padding: "0.75rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Mapped Findings</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{evidenceMap.entries.length}</div>
            </div>
            <div style={{ border: "1px solid var(--border-color)", borderRadius: "6px", padding: "0.75rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Blockers</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: evidenceMap.blockers.length ? "var(--color-error)" : "var(--color-brand)" }}>
                {evidenceMap.blockers.length}
              </div>
            </div>
            <div style={{ border: "1px solid var(--border-color)", borderRadius: "6px", padding: "0.75rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Warnings</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: evidenceMap.warnings.length ? "var(--color-warning)" : "var(--color-brand)" }}>
                {evidenceMap.warnings.length}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.5rem" }}>
            {evidenceMap.entries.slice(0, 6).map((entry) => (
              <div
                key={entry.findingId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(180px, 1.2fr) 120px minmax(180px, 1fr)",
                  gap: "0.75rem",
                  alignItems: "center",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  paddingTop: "0.55rem",
                  fontSize: "0.76rem",
                }}
              >
                <div>
                  <strong style={{ color: "var(--text-primary)" }}>{entry.requirementName}</strong>
                  <div style={{ color: "var(--text-muted)" }}>{entry.regulatoryBasis}</div>
                </div>
                <span className={`badge ${entry.evidenceState === "linked" ? "success" : entry.evidenceState === "needs_review" ? "warning" : "danger"}`}>
                  {entry.evidenceState}
                </span>
                <code style={{ color: "var(--text-secondary)", wordBreak: "break-word" }}>
                  {entry.sourceReference}
                </code>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "0.85rem" }}>
            <Link href={`/api/contracts/${contract.id}/evidence-map`} className="btn btn-secondary" style={{ fontSize: "0.78rem", padding: "0.4rem 0.7rem" }}>
              Open evidence map JSON
            </Link>
          </div>
        </section>
      )}

      <div className="split-pane">
        
        {/* Left Pane: Text Preview & Chat Assistant Tabs */}
        <div className="pane-left" style={{ display: "flex", flexDirection: "column", height: "fit-content", minHeight: "650px" }}>
          
          {/* Tab Selector */}
          <div style={{ display: "flex", gap: "1rem", borderBottom: "1px solid var(--border-color)", marginBottom: "1.25rem", paddingBottom: "0.5rem" }}>
            <button
              onClick={() => setActiveTab("ocr")}
              style={{
                background: "none",
                border: "none",
                color: activeTab === "ocr" ? "var(--color-brand)" : "var(--text-secondary)",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
                paddingBottom: "0.25rem",
                borderBottom: activeTab === "ocr" ? "2px solid var(--color-brand)" : "2px solid transparent",
                transition: "all 0.2s ease",
              }}
            >
              📄 Extracted Text (OCR Preview)
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              style={{
                background: "none",
                border: "none",
                color: activeTab === "chat" ? "var(--color-brand)" : "var(--text-secondary)",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
                paddingBottom: "0.25rem",
                borderBottom: activeTab === "chat" ? "2px solid var(--color-brand)" : "2px solid transparent",
                transition: "all 0.2s ease",
              }}
            >
              🤖 Interactive AI Auditor Chat
            </button>
          </div>

          {activeTab === "ocr" ? (
            <div style={{ flex: 1, overflowY: "auto", whiteSpace: "pre-wrap", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.6", maxHeight: "600px", paddingRight: "0.5rem" }}>
              {contract.extractedText || "No text content has been processed for this contract."}
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minHeight: "550px" }}>
              
              <div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                  Ask Gemini questions or check specific compliance sections with quick prompts below.
                </p>

                {/* Chat Suggestion Pills */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
                  {suggestedQueries.map((query, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendSuggested(query)}
                      disabled={sendingChat}
                      style={{
                        fontSize: "0.75rem",
                        backgroundColor: "rgba(20, 184, 166, 0.03)",
                        border: "1px solid rgba(20, 184, 166, 0.12)",
                        borderRadius: "6px",
                        padding: "0.45rem 0.75rem",
                        color: "var(--color-brand)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(20, 184, 166, 0.08)";
                        e.currentTarget.style.borderColor = "rgba(20, 184, 166, 0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(20, 184, 166, 0.03)";
                        e.currentTarget.style.borderColor = "rgba(20, 184, 166, 0.12)";
                      }}
                    >
                      💡 {query}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Message Logs */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                  padding: "1rem",
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                  marginBottom: "1rem",
                  minHeight: "280px",
                  maxHeight: "350px"
                }}
              >
                {chatMessages.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "0.8rem", padding: "2rem", textAlign: "center", flex: 1 }}>
                    <span>Audit Assistant ready. Choose a quick query above or enter a custom prompt.</span>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      style={{
                        alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        backgroundColor: msg.role === "user" ? "rgba(20, 184, 166, 0.08)" : "rgba(255,255,255,0.03)",
                        border: msg.role === "user" ? "1px solid rgba(20, 184, 166, 0.25)" : "1px solid var(--border-color)",
                        borderRadius: "6px",
                        padding: "0.6rem 0.85rem",
                      }}
                    >
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, color: msg.role === "user" ? "var(--color-brand)" : "var(--text-secondary)", marginBottom: "0.25rem", textTransform: "uppercase" }}>
                        {msg.role === "user" ? "Compliance Officer" : "AI Auditor Agent"}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-primary)",
                          lineHeight: "1.45",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                {sendingChat && (
                  <div style={{ alignSelf: "flex-start", padding: "0.3rem 0.85rem" }}>
                    <div className="spinner" style={{ width: "1rem", height: "1rem" }} />
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ask about audit rights, termination clauses, governing law..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendChat();
                  }}
                  disabled={sendingChat}
                  style={{ flex: 1, fontSize: "0.85rem" }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleSendChat()}
                  disabled={sendingChat || !chatInput.trim()}
                  style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                >
                  Send
                </button>
              </div>

            </div>
          )}
        </div>

        {/* Right Pane: Requirements Checklist */}
        <div className="pane-right">
          <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
            DORA Article 30(2) Clause Findings ({findings.length})
          </div>

          {findings.map((f) => {
            const isEditing = editingFindingId === f.id;
            const isUpdating = updatingId === f.id;

            return (
              <div
                key={f.id}
                className="card"
                style={{
                  padding: "1rem 1.25rem",
                  backgroundColor: "rgba(30, 38, 56, 0.3)",
                  borderLeft: `4px solid ${
                    f.status === "PRESENT"
                      ? "var(--color-brand)"
                      : f.status === "PARTIAL"
                      ? "var(--color-warning)"
                      : "var(--color-error)"
                  }`,
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-brand)", textTransform: "uppercase" }}>
                      {f.requirement.regulatoryBasis}
                    </span>
                    <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", marginTop: "0.1rem" }}>
                      {f.requirement.requirementName}
                    </h4>
                  </div>
                  <span className={`badge ${
                    f.status === "PRESENT"
                      ? "success"
                      : f.status === "PARTIAL"
                      ? "warning"
                      : "danger"
                  }`}>
                    {f.status}
                  </span>
                </div>

                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                  {f.requirement.description}
                </p>

                {/* Evidence Box */}
                {f.extractedEvidence ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", backgroundColor: "rgba(0,0,0,0.2)", padding: "0.6rem 0.85rem", borderLeft: "2px solid rgba(255,255,255,0.15)", borderRadius: "2px", marginBottom: "0.75rem", fontStyle: "italic" }}>
                    &ldquo;{f.extractedEvidence}&rdquo;
                  </div>
                ) : (
                  <div style={{ fontSize: "0.8rem", color: "var(--color-error)", backgroundColor: "rgba(239, 68, 68, 0.03)", padding: "0.5rem 0.75rem", borderRadius: "2px", marginBottom: "0.75rem" }}>
                    ⚠️ No matching clause language detected by AI scanner.
                  </div>
                )}

                {/* Review Decsion Meta */}
                {f.reviewerDecision && (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem", display: "flex", gap: "0.35rem", alignItems: "center" }}>
                    <span className="dot success" style={{ width: "6px", height: "6px" }} />
                    <span>Reviewed: <strong>{f.reviewerDecision}</strong></span>
                    {f.reviewerComments && <span>&middot; &ldquo;{f.reviewerComments}&rdquo;</span>}
                  </div>
                )}

                {/* Action Buttons */}
                {!isEditing ? (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => startEdit(f)}
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", borderRadius: "4px" }}
                    >
                      Audit / Override
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Manual Compliance Status</label>
                        <select
                          className="form-control"
                          value={overrideStatus}
                          onChange={(e) => setOverrideStatus(e.target.value as FindingStatus)}
                          style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                        >
                          <option value="PRESENT">PRESENT (Compliant)</option>
                          <option value="MISSING">MISSING (Gap)</option>
                          <option value="PARTIAL">PARTIAL</option>
                          <option value="UNCLEAR">UNCLEAR</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.75rem" }}>Audit Decision</label>
                        <select
                          className="form-control"
                          value={overrideDecision}
                          onChange={(e) => setOverrideDecision(e.target.value)}
                          style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                        >
                          <option value="APPROVED">APPROVED (Confirm AI)</option>
                          <option value="OVERRIDDEN">OVERRIDDEN (Manual Adjust)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.75rem" }}>Compliance Comments / Context</label>
                      <input
                        type="text"
                        placeholder="e.g. Verified data hosting audit right in Annex A"
                        className="form-control"
                        value={overrideComments}
                        onChange={(e) => setOverrideComments(e.target.value)}
                        style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setEditingFindingId(null)}
                        disabled={isUpdating}
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSaveReview(f.id)}
                        disabled={isUpdating}
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                      >
                        {isUpdating ? "Saving..." : "Save Findings"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
