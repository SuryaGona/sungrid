import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

const pageClass = `
  relative grid min-h-screen place-items-center overflow-hidden bg-[#050505] px-5 py-10 text-white
  bg-[radial-gradient(circle_at_50%_-10%,rgba(201,162,74,0.12),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(111,78,30,0.1),transparent_28%),#050505]
  before:pointer-events-none before:fixed before:inset-0 before:content-['']
  before:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]
  before:bg-[size:58px_58px]
  before:[mask-image:radial-gradient(circle_at_center,black,transparent_78%)]
`;

const shellClass =
  "relative z-[1] grid w-full max-w-[980px] grid-cols-[minmax(0,0.82fr)_minmax(360px,430px)] items-center gap-6 max-[900px]:max-w-[520px] max-[900px]:grid-cols-1";

const brandCardClass =
  "rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.24)]";

const clerkWrapClass =
  "rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-3 shadow-[0_18px_48px_rgba(0,0,0,0.24)]";

const iconWrapClass =
  "grid h-14 w-14 place-items-center rounded-[1.1rem] border border-[#d6bf76]/20 bg-[#d6bf76]/[0.1] shadow-[0_14px_36px_rgba(0,0,0,0.18)]";

const clerkAppearance = {
  variables: {
    colorPrimary: "#d6bf76",
    colorBackground: "#ffffff",
    colorText: "#111827",
    colorTextSecondary: "#6b7280",
    colorInputBackground: "#ffffff",
    colorInputText: "#111827",
    colorDanger: "#dc2626",
    borderRadius: "18px",
  },
  elements: {
    rootBox: {
      width: "100%",
      display: "flex",
      justifyContent: "center",
    },
    cardBox: {
      width: "100%",
      maxWidth: "430px",
      borderRadius: "24px",
      boxShadow: "0 18px 48px rgba(0, 0, 0, 0.24)",
    },
    card: {
      borderRadius: "24px",
      border: "1px solid rgba(255, 255, 255, 0.14)",
    },
    headerTitle: {
      fontSize: "26px",
      fontWeight: "900",
      letterSpacing: "-0.04em",
      color: "#111827",
    },
    headerSubtitle: {
      color: "#6b7280",
    },
    formButtonPrimary: {
      background: "linear-gradient(135deg, #fff7ad, #d6bf76 48%, #f97316)",
      color: "#111111",
      fontWeight: "900",
      boxShadow: "0 14px 34px rgba(214, 191, 118, 0.24)",
    },
    footerActionLink: {
      color: "#b8872f",
      fontWeight: "800",
    },
    identityPreviewEditButton: {
      color: "#b8872f",
    },
  },
};

function BackgroundGlows() {
  return (
    <>
      <div className="pointer-events-none fixed left-[42%] top-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(201,162,74,0.1)] blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[-220px] right-[-220px] h-[520px] w-[520px] rounded-full bg-[rgba(111,78,30,0.1)] blur-[90px]" />
    </>
  );
}

function SunGridLogo() {
  return (
    <div className={iconWrapClass} aria-hidden="true">
      <svg viewBox="0 0 80 80" className="h-9 w-9">
        <defs>
          <linearGradient
            id="sunGridSignInGradient"
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

        <circle cx="40" cy="40" r="22" fill="url(#sunGridSignInGradient)" />

        <path
          d="M29 35H51M29 45H51M35 29V51M45 29V51"
          stroke="#111827"
          strokeWidth="2.7"
          strokeLinecap="round"
          opacity="0.72"
        />
      </svg>
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className={pageClass}>
      <BackgroundGlows />

      <Link
        href="/"
        className="absolute left-5 top-5 z-[2] inline-flex h-8 items-center rounded-full border border-white/10 bg-black/25 px-3 text-xs font-bold text-white/55 no-underline transition hover:-translate-y-px hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98]"
      >
        ← Back to SunGrid
      </Link>

      <section className={shellClass}>
        <div className={brandCardClass}>
          <SunGridLogo />

          <p className="m-0 mt-4 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#d6bf76]">
            Workspace access
          </p>

          <h1 className="m-0 mt-2 text-[34px] font-extrabold tracking-[-0.05em] text-white md:text-[42px]">
            SunGrid
          </h1>

          <p className="m-0 mt-2 max-w-md text-sm leading-6 text-white/45">
            Sign in to continue to your workspace, projects, boards, sprints,
            reports, and team activity.
          </p>
        </div>

        <div className={clerkWrapClass}>
          <SignIn
            path="/sign-in"
            routing="path"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/dashboard"
            appearance={clerkAppearance}
          />
        </div>
      </section>
    </main>
  );
}