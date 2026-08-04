import { randomUUID } from "node:crypto";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { retryAsync } from "@/lib/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WORKSPACE_NAME_LENGTH = 80;

type OnboardingPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

type SessionProfile = {
  clerkId: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
};

const pageClass = `
  relative grid min-h-dvh place-items-center overflow-hidden bg-[#050505] px-5 py-10 text-white
  bg-[radial-gradient(circle_at_50%_-10%,rgba(201,162,74,0.12),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(111,78,30,0.1),transparent_28%),#050505]
  before:pointer-events-none before:fixed before:inset-0 before:content-['']
  before:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]
  before:bg-[size:58px_58px]
  before:[mask-image:radial-gradient(circle_at_center,black,transparent_78%)]
`;

const cardClass = `
  relative z-[1] w-full max-w-[520px] rounded-[28px] border border-white/10
  bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.035))]
  px-7 py-8 text-center backdrop-blur-[22px]
  shadow-[0_30px_90px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.1)]
  max-[520px]:rounded-[24px] max-[520px]:px-5 max-[520px]:py-7
`;

const fieldClass = `
  mt-2 h-[52px] w-full rounded-2xl border border-white/10 bg-black/35
  px-4 text-[15px] text-white outline-none
  placeholder:text-white/30
  transition-[border-color,background,box-shadow] duration-200
  focus:border-[#d6bf76]/60 focus:bg-black/45
  focus:shadow-[0_0_0_4px_rgba(214,191,118,0.08)]
`;

const primaryButtonClass = `
  flex h-[52px] w-full cursor-pointer items-center justify-center rounded-full border-0
  bg-[linear-gradient(135deg,#f4e7b0,#c8a14a_48%,#6f4e1e)]
  px-5 text-[15px] font-extrabold text-[#111111]
  shadow-[0_18px_44px_rgba(201,162,74,0.22)]
  transition-[transform,box-shadow,opacity] duration-200
  hover:-translate-y-0.5 hover:shadow-[0_24px_58px_rgba(201,162,74,0.3)]
  active:translate-y-0 active:scale-[0.98]
`;

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
    <div
      className="
        mx-auto grid h-[72px] w-[72px] place-items-center rounded-[23px]
        border border-[#d6bf76]/20
        bg-[linear-gradient(145deg,rgba(201,162,74,0.18),rgba(111,78,30,0.08))]
        shadow-[0_0_50px_rgba(201,162,74,0.16),inset_0_1px_0_rgba(255,255,255,0.12)]
      "
      aria-hidden="true"
    >
      <svg viewBox="0 0 80 80" className="h-[52px] w-[52px]">
        <defs>
          <linearGradient
            id="onboardingSunGradient"
            x1="18"
            y1="12"
            x2="64"
            y2="68"
          >
            <stop offset="0%" stopColor="#F4E7B0" />
            <stop offset="45%" stopColor="#C8A14A" />
            <stop offset="100%" stopColor="#6F4E1E" />
          </linearGradient>

          <filter
            id="onboardingSunGlow"
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0.9 0 0 0 0.75 0 0.65 0 0 0.45 0 0 0.25 0 0.12 0 0 0 0.55 0"
            />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx="40"
          cy="40"
          r="22"
          fill="url(#onboardingSunGradient)"
          filter="url(#onboardingSunGlow)"
        />

        <path
          d="M40 8V18M40 62V72M8 40H18M62 40H72M17.4 17.4L24.5 24.5M55.5 55.5L62.6 62.6M62.6 17.4L55.5 24.5M24.5 55.5L17.4 62.6"
          stroke="#D6BF76"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <path
          d="M29 35H51M29 45H51M35 29V51M45 29V51"
          stroke="#111827"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.75"
        />
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
      return "SunGrid could not find an email address on your account.";
    case "database":
      return "SunGrid could not create your workspace right now. Please try again.";
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

  if (!clerkUser || clerkUser.id !== userId) {
    redirect("/sign-in");
  }

  return {
    clerkId: userId,
    email: getPrimaryEmail(clerkUser)?.trim().toLowerCase() ?? null,
    name: getDisplayName(clerkUser),
    imageUrl: clerkUser.imageUrl ?? null,
  };
}

function StatusPage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className={pageClass}>
      <BackgroundGlows />

      <section className={cardClass}>
        <SunIcon />

        <p className="mb-0 mt-5 text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#d6bf76]">
          SunGrid
        </p>

        <h1 className="mb-0 mt-3 text-[clamp(30px,6vw,40px)] font-black leading-[1] tracking-[-0.05em] text-white">
          {title}
        </h1>

        <p className="mx-auto mb-0 mt-4 max-w-[400px] text-[15px] leading-[1.65] text-white/50">
          {message}
        </p>

        <a
          href="/onboarding"
          className={`${primaryButtonClass} mt-7 no-underline`}
        >
          Try again
        </a>
      </section>
    </main>
  );
}

async function createWorkspace(formData: FormData) {
  "use server";

  const profile = await getSessionProfile();

  if (!profile.email) {
    redirect("/onboarding?error=email-missing");
  }

  const workspaceName = String(formData.get("workspaceName") ?? "").trim();

  if (!workspaceName) {
    redirect("/onboarding?error=workspace-name-required");
  }

  if (workspaceName.length > MAX_WORKSPACE_NAME_LENGTH) {
    redirect("/onboarding?error=workspace-name-too-long");
  }

  let workspaceId: string;

  try {
    const result = await retryAsync(
      () =>
        prisma.$transaction(
          async (tx) => {
            const userByClerkId = await tx.user.findUnique({
              where: {
                clerkId: profile.clerkId,
              },
              select: {
                id: true,
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
            });

            const userByEmail = userByClerkId
              ? null
              : await tx.user.findUnique({
                  where: {
                    email: profile.email!,
                  },
                  select: {
                    id: true,
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
                });

            const existingUser = userByClerkId ?? userByEmail;

            if (existingUser) {
              await tx.user.update({
                where: {
                  id: existingUser.id,
                },
                data: {
                  clerkId: profile.clerkId,
                  email: profile.email!,
                  name: profile.name,
                  imageUrl: profile.imageUrl,
                  isGuest: false,
                },
              });

              const existingWorkspaceId =
                existingUser.memberships[0]?.workspaceId;

              if (existingWorkspaceId) {
                return {
                  workspaceId: existingWorkspaceId,
                };
              }

              const baseSlug = createSlug(workspaceName);

              const slugExists = await tx.workspace.findUnique({
                where: {
                  slug: baseSlug,
                },
                select: {
                  id: true,
                },
              });

              const slug = slugExists
                ? `${baseSlug}-${randomUUID().slice(0, 8)}`
                : baseSlug;

              const workspace = await tx.workspace.create({
                data: {
                  name: workspaceName,
                  slug,
                  memberships: {
                    create: {
                      userId: existingUser.id,
                      role: "OWNER",
                    },
                  },
                },
                select: {
                  id: true,
                },
              });

              return {
                workspaceId: workspace.id,
              };
            }

            const user = await tx.user.create({
              data: {
                clerkId: profile.clerkId,
                email: profile.email!,
                name: profile.name,
                imageUrl: profile.imageUrl,
                isGuest: false,
              },
              select: {
                id: true,
              },
            });

            const baseSlug = createSlug(workspaceName);

            const slugExists = await tx.workspace.findUnique({
              where: {
                slug: baseSlug,
              },
              select: {
                id: true,
              },
            });

            const slug = slugExists
              ? `${baseSlug}-${randomUUID().slice(0, 8)}`
              : baseSlug;

            const workspace = await tx.workspace.create({
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
              workspaceId: workspace.id,
            };
          },
          {
            maxWait: 20_000,
            timeout: 45_000,
          },
        ),
      {
        retries: 2,
        delayMs: 900,
        label: "Onboarding workspace creation",
      },
    );

    workspaceId = result.workspaceId;
  } catch (error) {
    console.error("Onboarding workspace creation failed:", error);
    redirect("/onboarding?error=database");
  }

  redirect(`/dashboard/${workspaceId}`);
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const profile = await getSessionProfile();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = getErrorMessage(resolvedSearchParams.error);

  if (!profile.email) {
    return (
      <StatusPage
        title="Email required"
        message="Add an email address to your account before creating a SunGrid workspace."
      />
    );
  }

  let existingWorkspaceId: string | undefined;

  try {
    existingWorkspaceId = await retryAsync(
      () =>
        prisma.$transaction(
          async (tx) => {
            const userByClerkId = await tx.user.findUnique({
              where: {
                clerkId: profile.clerkId,
              },
              select: {
                id: true,
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
            });

            const userByEmail = userByClerkId
              ? null
              : await tx.user.findUnique({
                  where: {
                    email: profile.email!,
                  },
                  select: {
                    id: true,
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
                });

            const existingUser = userByClerkId ?? userByEmail;

            if (!existingUser) {
              return undefined;
            }

            await tx.user.update({
              where: {
                id: existingUser.id,
              },
              data: {
                clerkId: profile.clerkId,
                email: profile.email!,
                name: profile.name,
                imageUrl: profile.imageUrl,
                isGuest: false,
              },
            });

            return existingUser.memberships[0]?.workspaceId;
          },
          {
            maxWait: 20_000,
            timeout: 45_000,
          },
        ),
      {
        retries: 3,
        delayMs: 700,
        label: "Onboarding account reconciliation",
      },
    );
  } catch (error) {
    console.error("Onboarding database load failed:", error);

    return (
      <StatusPage
        title="Setup could not load"
        message="SunGrid hit a temporary connection problem while loading workspace setup."
      />
    );
  }

  if (existingWorkspaceId) {
    redirect(`/dashboard/${existingWorkspaceId}`);
  }

  return (
    <main className={pageClass}>
      <BackgroundGlows />

      <section className={cardClass}>
        <SunIcon />

        <p className="mb-0 mt-5 text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#d6bf76]">
          SunGrid
        </p>

        <h1 className="mb-0 mt-3 text-[clamp(32px,6vw,44px)] font-black leading-[0.98] tracking-[-0.055em] text-white">
          Create your workspace
        </h1>

        <p className="mx-auto mb-0 mt-4 max-w-[410px] text-[15px] leading-[1.65] text-white/50">
          Give your workspace a name to start managing projects, issues,
          sprints, reports, and team activity.
        </p>

        {errorMessage ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-left text-sm font-bold leading-6 text-red-100"
          >
            {errorMessage}
          </div>
        ) : null}

        <form action={createWorkspace} className="mt-6 grid gap-5 text-left">
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
              minLength={1}
              maxLength={MAX_WORKSPACE_NAME_LENGTH}
              autoComplete="organization"
              autoFocus
              className={fieldClass}
            />

            <p className="mb-0 mt-2 text-xs leading-5 text-white/35">
              You can rename the workspace later from workspace settings.
            </p>
          </div>

          <button type="submit" className={primaryButtonClass}>
            Create workspace
          </button>
        </form>
      </section>
    </main>
  );
}