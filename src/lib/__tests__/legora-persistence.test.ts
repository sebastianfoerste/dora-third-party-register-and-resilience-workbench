import { describe, expect, it } from "vitest";

import { parseChangeDecisionValue } from "@/lib/legora-persistence";

describe("Legora persistence helpers", () => {
  it("splits a change decision at the final colon", () => {
    expect(parseChangeDecisionValue("change:doc-master-services:audit_rights:accepted")).toEqual({
      changeId: "change:doc-master-services:audit_rights",
      decision: "accepted",
    });
  });

  it("rejects malformed decisions", () => {
    expect(() => parseChangeDecisionValue("accepted")).toThrow("malformed");
    expect(() => parseChangeDecisionValue("change:item:pending")).toThrow("Invalid");
  });
});
