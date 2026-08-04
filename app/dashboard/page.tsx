import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { retryAsync } from "@/lib/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GUEST_COOKIE_NAME = "sungrid_guest_user_id";

export default async function DashboardEntryPage() {
  const { userId } = await auth();

  if (userId) {
    const user = await retryAsync(
      () =>
        prisma.user.findUnique({
          where: {
            clerkId: userId,
          },
          select: {
            memberships: {
              orderBy: {
                createdAt: "asc",
              },
              take: 1,
              select: {
                workspaceId: true,
              },
            },
          },
        }),
      {
        retries: 3,
        delayMs: 700,
        label: "Dashboard Clerk user lookup",
      },
    );

    const workspaceId = user?.memberships[0]?.workspaceId;

    if (workspaceId) {
      redirect(`/dashboard/${workspaceId}`);
    }

    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const guestUserId = cookieStore.get(GUEST_COOKIE_NAME)?.value?.trim();

  if (!guestUserId) {
    redirect("/");
  }

  const guestUser = await retryAsync(
    () =>
      prisma.user.findFirst({
        where: {
          id: guestUserId,
          isGuest: true,
        },
        select: {
          memberships: {
            where: {
              workspace: {
                isGuest: true,
                expiresAt: {
                  gt: new Date(),
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
            take: 1,
            select: {
              workspaceId: true,
            },
          },
        },
      }),
    {
      retries: 3,
      delayMs: 700,
      label: "Dashboard guest lookup",
    },
  );

  const workspaceId = guestUser?.memberships[0]?.workspaceId;

  if (workspaceId) {
    redirect(`/dashboard/${workspaceId}`);
  }

  redirect("/?guest=expired");
}
