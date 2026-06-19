import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATABASE_TIMEOUT_MS = 6000;
const MAX_WORKSPACE_NAME_LENGTH = 80;

type OnboardingPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

type SessionProfile = {
  clerkId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
};

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Database request timed out."));
      }, timeoutMs);
    }),
  ]);
}

function createSlug(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return slug || "workspace";
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "workspace-name-required":
      return "Workspace name is required.";
    case "workspace-name-too-long":
      return `Workspace name must be ${MAX_WORKSPACE_NAME_LENGTH} characters or fewer.`;
    case "database":
      return "SunGrid could not reach the database. Please try again.";
    default:
      return null;
  }
}

function getClaimString(
  claims: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = claims[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

async function getSessionProfile(): Promise<SessionProfile> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const claims = (sessionClaims || {}) as Record<string, unknown>;

  const realEmail = getClaimString(claims, [
    "email",
    "primary_email",
    "email_address",
    "primary_email_address",
  ]);

  const firstName = getClaimString(claims, ["first_name", "given_name"]);
  const lastName = getClaimString(claims, ["last_name", "family_name"]);
  const claimName = getClaimString(claims, ["name", "full_name", "username"]);

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const imageUrl = getClaimString(claims, [
    "image_url",
    "picture",
    "avatar_url",
  ]);

  return {
    clerkId: userId,
    email: realEmail || `pending-${userId.slice(-8)}@sungrid.local`,
    name: fullName || claimName || null,
    imageUrl,
  };
}

function OnboardingUnavailable() {
  return (
    <main className="min-h-screen bg-[#050505] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-3xl shadow-[0_0_45px_rgba(251,191,36,0.22)]">
          ☀️
        </div>

        <p className="mb-3 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-200">
          Workspace setup temporarily unavailable
        </p>

        <h1 className="text-4xl font-black tracking-tight">
          SunGrid could not load onboarding.
        </h1>

        <p className="mt-5 max-w-md text-base leading-7 text-white/60">
          The app could not reach the workspace database in time. Try again
          after the dev server or database wakes up.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/onboarding"
            className="rounded-full bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 px-6 py-3 font-black text-black shadow-[0_18px_45px_rgba(251,191,36,0.25)]"
          >
            Try Again
          </Link>

          <Link
            href="/demo"
            className="rounded-full border border-white/15 px-6 py-3 font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            View as Guest
          </Link>

          <Link
            href="/"
            className="rounded-full border border-white/15 px-6 py-3 font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

async function createWorkspace(formData: FormData) {
  "use server";

  const sessionProfile = await getSessionProfile();

  const workspaceName = String(formData.get("workspaceName") || "").trim();

  if (!workspaceName) {
    redirect("/onboarding?error=workspace-name-required");
  }

  if (workspaceName.length > MAX_WORKSPACE_NAME_LENGTH) {
    redirect("/onboarding?error=workspace-name-too-long");
  }

  let workspaceId: string | null = null;

  try {
    const result = await withTimeout(
      prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: {
            clerkId: sessionProfile.clerkId,
          },
          update: {
            email: sessionProfile.email,
            name: sessionProfile.name,
            imageUrl: sessionProfile.imageUrl,
          },
          create: {
            clerkId: sessionProfile.clerkId,
            email: sessionProfile.email,
            name: sessionProfile.name,
            imageUrl: sessionProfile.imageUrl,
          },
        });

        const existingMembership = await tx.membership.findFirst({
          where: {
            userId: user.id,
          },
          orderBy: {
            createdAt: "asc",
          },
          select: {
            workspaceId: true,
          },
        });

        if (existingMembership) {
          return {
            workspaceId: existingMembership.workspaceId,
          };
        }

        const baseSlug = createSlug(workspaceName);
        let slug = baseSlug;

        for (let counter = 2; counter <= 50; counter++) {
          const existingWorkspace = await tx.workspace.findUnique({
            where: {
              slug,
            },
            select: {
              id: true,
            },
          });

          if (!existingWorkspace) {
            break;
          }

          slug = `${baseSlug}-${counter}`;
        }

        const finalSlugAlreadyExists = await tx.workspace.findUnique({
          where: {
            slug,
          },
          select: {
            id: true,
          },
        });

        if (finalSlugAlreadyExists) {
          slug = `${baseSlug}-${Date.now().toString(36)}`;
        }

        const createdWorkspace = await tx.workspace.create({
          data: {
            name: workspaceName,
            slug,
            memberships: {
              create: {
                userId: user.id,
                role: "OWNER",
              },
            },
          },
          select: {
            id: true,
          },
        });

        return {
          workspaceId: createdWorkspace.id,
        };
      }),
      DATABASE_TIMEOUT_MS,
    );

    workspaceId = result.workspaceId;
  } catch (error) {
    console.error("Onboarding workspace creation failed:", error);
    redirect("/onboarding?error=database");
  }

  if (!workspaceId) {
    redirect("/onboarding?error=database");
  }

  redirect(`/dashboard/${workspaceId}`);
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const sessionProfile = await getSessionProfile();

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = getErrorMessage(resolvedSearchParams.error);

  try {
    const existingUser = await withTimeout(
      prisma.user.findUnique({
        where: {
          clerkId: sessionProfile.clerkId,
        },
        include: {
          memberships: {
            orderBy: {
              createdAt: "asc",
            },
            select: {
              workspaceId: true,
            },
          },
        },
      }),
      DATABASE_TIMEOUT_MS,
    );

    const existingMembership = existingUser?.memberships[0];

    if (existingMembership) {
      redirect(`/dashboard/${existingMembership.workspaceId}`);
    }
  } catch (error) {
    console.error("Onboarding database load failed:", error);
    return <OnboardingUnavailable />;
  }

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-3xl shadow-[0_0_45px_rgba(251,191,36,0.22)]">
          ☀️
        </div>

        <section className="w-full rounded-[2rem] border border-white/12 bg-white/[0.06] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <p className="mb-3 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-sm font-bold text-amber-200">
            Workspace setup
          </p>

          <h1 className="text-center text-3xl font-black tracking-tight">
            Create your workspace
          </h1>

          <p className="mt-3 text-center text-sm leading-6 text-white/55">
            Name your workspace to start managing projects, issues, sprints,
            reports, and team activity.
          </p>

          {errorMessage ? (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold leading-6 text-red-100">
              {errorMessage}
            </div>
          ) : null}

          <form action={createWorkspace} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="workspaceName"
                className="block text-sm font-bold text-white/75"
              >
                Workspace name
              </label>

              <input
                id="workspaceName"
                name="workspaceName"
                type="text"
                placeholder="Example: SunGrid Product Team"
                required
                maxLength={MAX_WORKSPACE_NAME_LENGTH}
                autoFocus
                className="mt-2 w-full rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-300/60 focus:ring-4 focus:ring-amber-400/10"
              />

              <p className="mt-2 text-xs text-white/35">
                You can rename this later from workspace settings.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 px-5 py-3 text-sm font-black text-black shadow-[0_18px_45px_rgba(251,191,36,0.25)] transition hover:translate-y-[-1px] hover:shadow-[0_22px_55px_rgba(251,191,36,0.32)]"
            >
              Create workspace
            </button>
          </form>

          <div className="mt-6 flex justify-center gap-4 text-sm">
            <Link
              href="/demo"
              className="font-bold text-white/50 transition hover:text-white"
            >
              View as Guest
            </Link>

            <Link
              href="/"
              className="font-bold text-white/50 transition hover:text-white"
            >
              Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}