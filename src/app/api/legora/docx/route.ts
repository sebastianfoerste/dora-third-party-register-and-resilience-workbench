import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { renderReviewedDocx, type DocumentChangeSet } from "@/lib/legora-workspace";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const source = form.get("source");
    const changeSetPayload = form.get("changeSet");
    if (!(source instanceof File)) {
      return NextResponse.json({ error: "source DOCX is required" }, { status: 400 });
    }
    const bytes = new Uint8Array(await source.arrayBuffer());
    if (typeof changeSetPayload !== "string") {
      const changesPayload = form.get("changes");
      if (typeof changesPayload !== "string") {
        return NextResponse.json({ error: "changes are required to prepare a reviewed import" }, { status: 400 });
      }
      return NextResponse.json({
        schema: "document.change-set.v1",
        sourceDigest: createHash("sha256").update(bytes).digest("hex"),
        playbookVersion: Number(form.get("playbookVersion") ?? 1),
        changes: JSON.parse(changesPayload),
        sourcePreserved: true,
        exportAllowed: false,
      });
    }
    const changeSet = JSON.parse(changeSetPayload) as DocumentChangeSet;
    if (createHash("sha256").update(bytes).digest("hex") !== changeSet.sourceDigest) {
      return NextResponse.json({ error: "source DOCX digest mismatch" }, { status: 409 });
    }
    const output = await renderReviewedDocx({ source: bytes, changeSet });
    return new Response(Buffer.from(output), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": "attachment; filename=reviewed-dora-contract.docx",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DOCX export failed" },
      { status: 400 },
    );
  }
}
