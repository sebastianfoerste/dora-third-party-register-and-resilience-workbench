import { NextResponse } from "next/server";

import {
  loadPersistedLegoraWorkspace,
  mutatePersistedReview,
  ReviewConflictError,
} from "@/lib/legora-persistence";

export async function GET() {
  return NextResponse.json(await loadPersistedLegoraWorkspace());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(await mutatePersistedReview(body));
  } catch (error) {
    const status = error instanceof ReviewConflictError ? 409 : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid review mutation" },
      { status },
    );
  }
}
