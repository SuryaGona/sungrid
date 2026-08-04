import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

const clerkAppearance = {
  variables: {
    colorPrimary: "#d8c274",
    colorBackground: "#1b1b19",
    colorText: "#f7f7f5",
    colorTextSecondary: "#a6a7a3",
    colorInputBackground: "#292b2d",
    colorInputText: "#f8f8f6",
    colorDanger: "#f08080",
    borderRadius: "14px",
  },
  elements: {
    rootBox: {
      width: "100%",
    },
    cardBox: {
      width: "100%",
      maxWidth: "390px",
      boxShadow: "none",
    },
    card: {
      width: "100%",
      padding: "28px",
      borderRadius: "24px",
      border: "1px solid rgba(255,255,255,0.1)",
      background:
        "linear-gradient(145deg, rgba(31,31,28,0.99), rgba(23,23,21,0.99))",
      boxShadow:
        "0 30px 90px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.055)",
      backdropFilter: "blur(20px)",
    },
    header: {
      gap: "8px",
    },
    headerTitle: {
      fontSize: "24px",
      fontWeight: "650",
      letterSpacing: "-0.04em",
      color: "#f7f7f5",
    },
    headerSubtitle: {
      fontSize: "13px",
      color: "#a6a7a3",
    },
    socialButtonsBlockButton: {
      position: "relative",
      height: "46px",
      marginTop: "8px",
      borderRadius: "13px",
      border: "1px solid rgba(255,255,255,0.13)",
      background: "#303235",
      color: "#f4f4f1",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.045)",
    },
    socialButtonsBlockButtonText: {
      fontSize: "13px",
      fontWeight: "600",
      color: "#f4f4f1",
    },
    socialButtonsProviderIcon: {
      filter: "none",
    },
    lastAuthenticationStrategyBadge: {
      top: "-11px",
      right: "10px",
      zIndex: "5",
      padding: "4px 9px",
      borderRadius: "999px",
      border: "1px solid rgba(216,194,116,0.34)",
      background: "#d8c274",
      color: "#1d1c17",
      fontSize: "10px",
      fontWeight: "750",
      lineHeight: "1",
      boxShadow: "0 6px 18px rgba(0,0,0,0.32)",
    },
    dividerLine: {
      background: "rgba(255,255,255,0.1)",
    },
    dividerText: {
      fontSize: "11px",
      color: "#858681",
    },
    formFieldLabel: {
      fontSize: "12px",
      fontWeight: "550",
      color: "#c4c4bf",
    },
    formFieldInput: {
      height: "44px",
      borderRadius: "13px",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "#292b2d",
      color: "#f8f8f6",
      boxShadow:
        "inset 0 1px 0 rgba(255,255,255,0.035), 0 0 0 1px transparent",
    },
    formFieldInputShowPasswordButton: {
      color: "#a8aaa6",
    },
    formButtonPrimary: {
      height: "44px",
      borderRadius: "13px",
      border: "1px solid rgba(255,255,255,0.08)",
      background: "#d8c274",
      color: "#1c1b16",
      fontSize: "13px",
      fontWeight: "700",
      boxShadow: "0 12px 30px rgba(216,194,116,0.15)",
    },
    footer: {
      background: "transparent",
    },
    footerActionText: {
      fontSize: "12px",
      color: "#92938f",
    },
    footerActionLink: {
      fontSize: "12px",
      fontWeight: "650",
      color: "#e3cf85",
    },
    identityPreview: {
      borderRadius: "13px",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "#292b2d",
    },
    identityPreviewText: {
      color: "#ededeb",
    },
    identityPreviewEditButton: {
      color: "#e3cf85",
    },
    formFieldAction: {
      color: "#e3cf85",
    },
    alert: {
      borderRadius: "13px",
      border: "1px solid rgba(240,128,128,0.22)",
      background: "rgba(116,48,48,0.3)",
      color: "#ffd5d5",
    },
    alternativeMethodsBlockButton: {
      borderRadius: "13px",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "#303235",
      color: "#f4f4f1",
    },
    alternativeMethodsBlockButtonText: {
      color: "#f4f4f1",
    },
  },
};

function Logo() {
  return (
    <div
      className="
        grid h-11 w-11 shrink-0 place-items-center rounded-[16px]
        border border-[#d6bf76]/25
        bg-[linear-gradient(145deg,rgba(201,162,74,0.14),rgba(111,78,30,0.06))]
        shadow-[0_0_32px_rgba(201,162,74,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]
      "
      aria-hidden="true"
    >
      <svg viewBox="0 0 80 80" className="h-8 w-8" fill="none">
        <defs>
          <linearGradient
            id="signUpLogoGradient"
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
            id="signUpLogoGlow"
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
          fill="url(#signUpLogoGradient)"
          filter="url(#signUpLogoGlow)"
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

function BackIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 10H5M9 6l-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SignUpPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#101112] px-5 py-10 text-white">
      <Link
        href="/"
        className="
          absolute left-5 top-5 z-30 inline-flex items-center gap-2
          rounded-xl border border-white/[0.1]
          bg-[#25272a] px-3.5 py-2.5
          text-xs font-medium text-white/65 no-underline
          shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
          transition hover:border-white/[0.17]
          hover:bg-[#2e3033] hover:text-white
          sm:left-8 sm:top-7
        "
      >
        <BackIcon />
        Back
      </Link>

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-430px] h-[760px] w-[760px] -translate-x-1/2 rounded-full bg-[#8c7429]/12 blur-[145px]" />

        <div className="absolute bottom-[-300px] right-[-260px] h-[580px] w-[580px] rounded-full bg-[#4b4e51]/10 blur-[150px]" />

        <div className="absolute inset-0 opacity-[0.025] [background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 180 180%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.7%22/%3E%3C/svg%3E')]" />
      </div>

      <Link
        href="/"
        className="
          absolute left-1/2 top-5 z-20 flex -translate-x-1/2
          items-center gap-3 text-white no-underline sm:top-7
        "
      >
        <Logo />

        <div className="hidden sm:block">
          <p className="m-0 text-[12px] font-extrabold leading-none tracking-[-0.02em] text-[#d6bf76]">
            SunGrid
          </p>

          <p className="m-0 mt-1.5 whitespace-nowrap text-[15px] font-black leading-none tracking-[-0.04em] text-white">
            Team Workspace
          </p>
        </div>
      </Link>

      <section className="relative z-10 w-full max-w-[390px] pt-20 sm:pt-16">
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/onboarding"
          appearance={clerkAppearance}
        />
      </section>
    </main>
  );
}