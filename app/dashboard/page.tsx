import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import styles from "./dashboard-status.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATABASE_TIMEOUT_MS = 8000;

type DashboardUser = {
  memberships: {
    workspaceId: string;
  }[];
};

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("DATABASE_TIMEOUT"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function SunIcon() {
  return (
    <div className={styles.iconWrap} aria-hidden="true">
      <svg viewBox="0 0 80 80" className={styles.icon}>
        <defs>
          <linearGradient
            id="dashboardSunGradient"
            x1="16"
            y1="10"
            x2="66"
            y2="70"
          >
            <stop offset="0%" stopColor="#FFF7AD" />
            <stop offset="45%" stopColor="#FDBA33" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
        </defs>

        <path
          d="M40 7V17M40 63V73M7 40H17M63 40H73M16.5 16.5L23.5 23.5M56.5 56.5L63.5 63.5M63.5 16.5L56.5 23.5M23.5 56.5L16.5 63.5"
          stroke="#FDE68A"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <circle cx="40" cy="40" r="22" fill="url(#dashboardSunGradient)" />
      </svg>
    </div>
  );
}

function DashboardUnavailable() {
  return (
    <main className={styles.page}>
      <div className={styles.glowOne} />
      <div className={styles.glowTwo} />

      <section className={styles.card}>
        <SunIcon />

        <p className={styles.badge}>Connection issue</p>

        <h1 className={styles.title}>Workspace could not load</h1>

        <p className={styles.subtitle}>
          SunGrid could not connect to the workspace database right now.
        </p>

        <div className={styles.actions}>
          <Link href="/dashboard" className={styles.primaryButton}>
            Try Again
          </Link>

          <Link href="/demo" className={styles.secondaryButton}>
            View as Guest
          </Link>

          <Link href="/" className={styles.textLink}>
            Back Home
          </Link>
        </div>
      </section>
    </main>
  );
}

function getPrimaryEmail(
  clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
) {
  return (
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null
  );
}

function getDisplayName(
  clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
) {
  const fullName = [clerkUser.firstName, clerkUser.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || clerkUser.username || null;
}

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  let clerkUser: Awaited<ReturnType<typeof currentUser>> | null = null;

  try {
    clerkUser = await currentUser();
  } catch {
    redirect("/onboarding");
  }

  if (!clerkUser) {
    redirect("/sign-in");
  }

  const primaryEmail = getPrimaryEmail(clerkUser);

  if (!primaryEmail) {
    redirect("/onboarding?error=email-missing");
  }

  let user: DashboardUser | null = null;

  try {
    user = await withTimeout(
      prisma.$transaction(async (tx) => {
        const existingUserByClerkId = await tx.user.findUnique({
          where: {
            clerkId: userId,
          },
          select: {
            id: true,
            memberships: {
              orderBy: {
                createdAt: "asc",
              },
              select: {
                workspaceId: true,
              },
            },
          },
        });

        if (existingUserByClerkId) {
          return existingUserByClerkId;
        }

        const existingUserByEmail = await tx.user.findUnique({
          where: {
            email: primaryEmail,
          },
          select: {
            id: true,
            memberships: {
              orderBy: {
                createdAt: "asc",
              },
              select: {
                workspaceId: true,
              },
            },
          },
        });

        if (existingUserByEmail) {
          return await tx.user.update({
            where: {
              id: existingUserByEmail.id,
            },
            data: {
              clerkId: userId,
              email: primaryEmail,
              name: getDisplayName(clerkUser),
              imageUrl: clerkUser.imageUrl ?? null,
            },
            select: {
              memberships: {
                orderBy: {
                  createdAt: "asc",
                },
                select: {
                  workspaceId: true,
                },
              },
            },
          });
        }

        return null;
      }),
      DATABASE_TIMEOUT_MS,
    );
  } catch {
    console.warn("Dashboard database connection unavailable.");
    return <DashboardUnavailable />;
  }

  const firstMembership = user?.memberships[0] ?? null;

  if (!firstMembership) {
    redirect("/onboarding");
  }

  redirect(`/dashboard/${firstMembership.workspaceId}`);
}