import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "Missing CRON_SECRET" },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const deletedWorkspaces = await prisma.workspace.deleteMany({
    where: {
      isGuest: true,
      expiresAt: {
        lt: now,
      },
    },
  });

  const deletedUsers = await prisma.user.deleteMany({
    where: {
      isGuest: true,
      memberships: {
        none: {},
      },
    },
  });

  return NextResponse.json({
    ok: true,
    deletedWorkspaces: deletedWorkspaces.count,
    deletedUsers: deletedUsers.count,
    checkedAt: now.toISOString(),
  });
}