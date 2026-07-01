import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
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

const pageClass = `
  relative grid min-h-screen place-items-center overflow-hidden bg-[#050505] px-5 py-10 text-white
  bg-[radial-gradient(circle_at_50%_-10%,rgba(201,162,74,0.12),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(111,78,30,0.1),transparent_28%),#050505]
  before:pointer-events-none before:fixed before:inset-0 before:content-['']
  before:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]
  before:bg-[size:58px_58px]
  before:[mask-image:radial-gradient(circle_at_center,black,transparent_78%)]
`;

const cardClass =
  "relative z-[1] w-full max-w-[520px] rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.24)]";

const iconWrapClass =
  "mx-auto grid h-14 w-14 place-items-center rounded-[1.1rem] border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] shadow-[0_14px_36px_rgba(0,0,0,0.18)]";

const fieldClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#d6bf76]/60";

const primaryButtonClass =
  "inline-flex h-10 w-full items-center justify-center rounded-full border border-[#d6bf76]/25 bg-[#d6bf76]/[0.12] px-4 text-sm font-extrabold text-[#f4e7b0] no-underline transition hover:-translate-y-px hover:bg-[#d6bf76]/[0.18] hover:text-white active:translate-y-0 active:scale-[0.98]";

const secondaryLinkClass =
  "rounded-full px-3 py-2 text-sm font-bold text-white/45 no-underline transition hover:text-white/75";

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

function BackgroundGlows() {
  return (
    <>
      <div className="pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]" />
    </>
  );
}

function SunIcon() {
  return (
    <div className={iconWrapClass} aria-hidden="true">
      <svg viewBox="0 0 80 80" className="h-9 w-9">
        <defs>
          <linearGradient
            id="onboardingSunGradient"
            x1="16"
            y1="10"
            x2="66"
            y2="70"
          >
            <stop offset="0%" stopColor="#fff7ad" />
            <stop offset="45%" stopColor="#d6bf76" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        <path
          d="M40 7V17M40 63V73M7 40H17M63 40H73M16.5 16.5L23.5 23.5M56.5 56.5L63.5 63.5M63.5 16.5L56.5 23.5M23.5 56.5L16.5 63.5"
          stroke="#f4e7b0"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <circle cx="40" cy="40" r="22" fill="url(#onboardingSunGradient)" />
      </svg>
    </div>
  );
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
    case "email-missing":
      return "SunGrid could not find an email on your account.";
    case "database":
      return "SunGrid could not reach the database. Please try again.";
    default:
      return null;
  }
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

async function getSessionProfile(): Promise<SessionProfile> {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect("/sign-in");
  }

  const email = getPrimaryEmail(clerkUser);

  if (!email) {
    redirect("/onboarding?error=email-missing");
  }

  return {
    clerkId: userId,
    email,
    name: getDisplayName(clerkUser),
    imageUrl: clerkUser.imageUrl ?? null,
  };
}

function OnboardingUnavailable() {
  return (
    <main className={pageClass}>
      <BackgroundGlows />

      <section className={cardClass}>
        <SunIcon />

        <p className="m-0 mt-4 text-center text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
          Workspace setup unavailable
        </p>

        <h1 className="m-0 mt-2 text-center text-[25px] font-extrabold tracking-[-0.04em] text-white md:text-[28px]">
          SunGrid could not load onboarding.
        </h1>

        <p className="mx-auto mt-2 max-w-md text-center text-sm leading-6 text-white/45">
          The app could not reach the workspace database in time. Try again
          after the dev server or database wakes up.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link href="/onboarding" className={primaryButtonClass}>
            Try again
          </Link>

          <Link href="/demo" className={secondaryLinkClass}>
            View as guest
          </Link>

          <Link href="/" className={secondaryLinkClass}>
            Home
          </Link>
        </div>
      </section>
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
          select: {
            id: true,
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
    <main className={pageClass}>
      <BackgroundGlows />

      <section className={cardClass}>
        <SunIcon />

        <p className="m-0 mt-4 text-center text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
          Workspace setup
        </p>

        <h1 className="m-0 mt-2 text-center text-[25px] font-extrabold tracking-[-0.04em] text-white md:text-[28px]">
          Create your workspace
        </h1>

        <p className="mx-auto mt-2 max-w-md text-center text-sm leading-6 text-white/45">
          Name your workspace to start managing projects, issues, sprints,
          reports, and team activity.
        </p>

        {errorMessage ? (
          <div className="mt-4 rounded-[1.2rem] border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-bold leading-6 text-red-100">
            {errorMessage}
          </div>
        ) : null}

        <form action={createWorkspace} className="mt-5 grid gap-4">
          <div>
            <label
              htmlFor="workspaceName"
              className="block text-sm font-bold text-white/70"
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
              className={fieldClass}
            />

            <p className="m-0 mt-2 text-xs text-white/35">
              You can rename this later from workspace settings.
            </p>
          </div>

          <button type="submit" className={primaryButtonClass}>
            Create workspace
          </button>
        </form>

        <div className="mt-4 flex justify-center gap-2">
          <Link href="/demo" className={secondaryLinkClass}>
            View as guest
          </Link>

          <Link href="/" className={secondaryLinkClass}>
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}