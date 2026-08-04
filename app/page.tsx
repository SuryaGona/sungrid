import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

function Logo() {
  return (
    <div
      className="
        grid h-12 w-12 shrink-0 place-items-center rounded-[17px]
        border border-[#d6bf76]/25
        bg-[linear-gradient(145deg,rgba(201,162,74,0.14),rgba(111,78,30,0.06))]
        shadow-[0_0_32px_rgba(201,162,74,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]
      "
      aria-hidden="true"
    >
      <svg viewBox="0 0 80 80" className="h-[35px] w-[35px]" fill="none">
        <defs>
          <linearGradient
            id="homeLogoGradient"
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
            id="homeLogoGlow"
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="4" result="blur" />

            <feColorMatrix
              in="blur"
              type="matrix"
              values="0.9 0 0 0 0.75 0 0.65 0 0 0.45 0 0 0.25 0 0.12 0 0 0 0.5 0"
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
          r="21"
          fill="url(#homeLogoGradient)"
          filter="url(#homeLogoGlow)"
        />

        <path
          d="M40 8V18M40 62V72M8 40H18M62 40H72M17.4 17.4L24.5 24.5M55.5 55.5L62.6 62.6M62.6 17.4L55.5 24.5M24.5 55.5L17.4 62.6"
          stroke="#D6BF76"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <path
          d="M29 35H51M29 45H51M35 29V51M45 29V51"
          stroke="#17140B"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.8"
        />
      </svg>
    </div>
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 10h11M11 6l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M8 9h8M8 13h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IssuesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M12 8v5M12 16.5v.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SprintsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M6 7h9a4 4 0 0 1 4 4v1M18 17H9a4 4 0 0 1-4-4v-1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      <path
        d="m16 9 3 3 3-3M8 15l-3-3-3 3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MembersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <circle
        cx="9"
        cy="9"
        r="3"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M4 18c.7-2.5 2.4-4 5-4s4.3 1.5 5 4M16 7.5a2.5 2.5 0 0 1 0 5M16 14c2.1.2 3.4 1.5 4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M5 5v14M5 7h8M5 12h11M5 17h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      <circle cx="15" cy="7" r="2" fill="currentColor" />
      <circle cx="18" cy="12" r="2" fill="currentColor" />
      <circle cx="13" cy="17" r="2" fill="currentColor" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M5 19V10M10 19V5M15 19v-7M20 19V8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KeyFeaturesCanvas() {
  const features = [
    {
      title: "Projects",
      description:
        "Organize work into clear projects with ownership, status, and shared context.",
      icon: <ProjectsIcon />,
    },
    {
      title: "Issues",
      description:
        "Track priorities, assignments, progress, and completed work without losing details.",
      icon: <IssuesIcon />,
    },
    {
      title: "Sprints",
      description:
        "Group active issues into focused cycles and keep upcoming work easy to understand.",
      icon: <SprintsIcon />,
    },
    {
      title: "Members",
      description:
        "Bring your team together with workspace roles and controlled access.",
      icon: <MembersIcon />,
    },
    {
      title: "Activity",
      description:
        "Follow project, issue, sprint, and workspace updates through one activity trail.",
      icon: <ActivityIcon />,
    },
    {
      title: "Reports",
      description:
        "See workspace progress and understand how work is moving across the team.",
      icon: <ReportsIcon />,
    },
  ];

  return (
    <div className="relative mx-auto mt-9 w-full max-w-6xl lg:mt-10">
      <div className="pointer-events-none absolute -inset-x-16 -inset-y-10 bg-[radial-gradient(ellipse_at_center,rgba(243,213,107,0.12),transparent_66%)] blur-3xl" />

      <div
        className="
          relative overflow-hidden rounded-[30px]
          border border-white/[0.09] bg-[#0d0d0c]
          shadow-[0_40px_120px_rgba(0,0,0,0.6)]
        "
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3.5">
            <Logo />

            <div className="min-w-0">
              <p className="truncate text-[13px] font-extrabold leading-none tracking-[-0.02em] text-[#d6bf76]">
                SunGrid
              </p>

              <p className="mt-1.5 truncate text-[16px] font-black leading-none tracking-[-0.04em] text-white">
                Key Features
              </p>
            </div>
          </div>

          <span className="hidden rounded-full border border-[#f3d56b]/15 bg-[#f3d56b]/[0.05] px-3 py-1.5 text-[10px] font-medium text-[#f3d56b]/70 sm:inline">
            Six connected tools
          </span>
        </div>

        <div className="grid gap-px bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="
                group relative min-h-[190px] overflow-hidden
                bg-[#0d0d0c] p-6 text-left sm:p-7
              "
            >
              <div
                className={`
                  pointer-events-none absolute inset-0 opacity-0
                  transition-opacity duration-300 group-hover:opacity-100
                  ${
                    index === 1 || index === 4
                      ? "bg-[radial-gradient(circle_at_top,rgba(243,213,107,0.08),transparent_65%)]"
                      : "bg-[radial-gradient(circle_at_top_left,rgba(243,213,107,0.06),transparent_62%)]"
                  }
                `}
              />

              <div className="relative">
                <div
                  className="
                    grid h-10 w-10 place-items-center rounded-xl
                    border border-white/[0.08] bg-white/[0.035]
                    text-[#f3d56b]/75
                    transition duration-300
                    group-hover:border-[#f3d56b]/20
                    group-hover:bg-[#f3d56b]/[0.07]
                    group-hover:text-[#f3d56b]
                  "
                >
                  {feature.icon}
                </div>

                <h2 className="mt-6 text-[17px] font-semibold tracking-[-0.03em] text-white/88">
                  {feature.title}
                </h2>

                <p className="mt-3 max-w-[310px] text-sm leading-6 text-white/32">
                  {feature.description}
                </p>

                <div className="mt-6 h-px w-8 bg-[#f3d56b]/20 transition-all duration-300 group-hover:w-14 group-hover:bg-[#f3d56b]/50" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] px-6 py-5 text-center sm:flex-row sm:px-7 sm:text-left">
          <div>
            <p className="text-sm font-medium text-white/65">
              See how every feature works together.
            </p>

            <p className="mt-1 text-xs text-white/25">
              Open the guest workspace without creating an account.
            </p>
          </div>

          <a
            href="/demo/start"
            className="
              inline-flex shrink-0 items-center justify-center gap-2
              rounded-xl border border-white/[0.09]
              bg-white/[0.035] px-4 py-2.5
              text-xs font-medium text-white/55 no-underline
              transition hover:border-[#f3d56b]/20
              hover:bg-[#f3d56b]/[0.06] hover:text-white
            "
          >
            Explore SunGrid
            <Arrow />
          </a>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#070706] text-white selection:bg-[#f3d56b] selection:text-black">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-460px] h-[760px] w-[760px] -translate-x-1/2 rounded-full bg-[#8c7429]/15 blur-[140px]" />

        <div className="absolute inset-0 opacity-[0.03] [background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 180 180%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.7%22/%3E%3C/svg%3E')]" />
      </div>

      <header className="relative z-20 mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3.5 no-underline">
          <Logo />

          <div>
            <p className="m-0 text-[13px] font-extrabold leading-none tracking-[-0.02em] text-[#d6bf76]">
              SunGrid
            </p>

            <p className="m-0 mt-1.5 text-[17px] font-black leading-none tracking-[-0.04em] text-white">
              Team Workspace
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="
              rounded-xl px-4 py-2.5 text-sm
              text-white/45 no-underline transition
              hover:text-white
            "
          >
            Sign in
          </Link>

          <Link
            href="/sign-up"
            className="
              rounded-xl border border-white/[0.1]
              bg-white/[0.06] px-4 py-2.5
              text-sm font-medium text-white no-underline
              transition hover:bg-white/[0.1]
            "
          >
            Create account
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-2 text-center sm:px-8 sm:pt-3 lg:pt-4">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-4 py-2 text-[12px] font-medium text-white/42">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f3d56b]" />

          One workspace for your entire team
        </div>

        <h1 className="mx-auto mt-6 max-w-[1100px] text-[clamp(3rem,5.3vw,5.3rem)] font-semibold leading-[0.95] tracking-[-0.06em]">
          Bring every part of your work together.
          <span className="mt-1 block text-white/30">
            Keep progress easy to follow.
          </span>
        </h1>

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="
              group inline-flex min-w-48 items-center justify-center gap-2
              rounded-2xl bg-[#f3d56b] px-7 py-3.5
              text-sm font-semibold text-[#15130c] no-underline
              shadow-[0_14px_40px_rgba(243,213,107,0.14)]
              transition hover:-translate-y-0.5 hover:bg-[#f8df83]
              hover:shadow-[0_18px_46px_rgba(243,213,107,0.2)]
            "
          >
            Create workspace
            <Arrow />
          </Link>

          <a
            href="/demo/start"
            className="
              inline-flex min-w-48 items-center justify-center gap-2
              rounded-2xl border border-white/[0.09]
              bg-white/[0.035] px-7 py-3.5
              text-sm font-medium text-white/55 no-underline
              transition hover:-translate-y-0.5
              hover:border-white/15 hover:bg-white/[0.055]
              hover:text-white
            "
          >
            Open guest demo
            <Arrow />
          </a>
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-7 text-white/38 sm:text-[18px] sm:leading-8">
          Plan projects, manage issues, run sprints, track reports, and follow
          team activity from one focused SunGrid workspace.
        </p>

        <KeyFeaturesCanvas />
      </section>
    </main>
  );
}