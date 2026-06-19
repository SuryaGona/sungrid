import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import styles from "../../auth.module.css";

function SunGridLogo() {
  return (
    <div className={styles.logoWrap} aria-hidden="true">
      <svg viewBox="0 0 80 80" className={styles.logo}>
        <defs>
          <linearGradient id="sunGridSignInGradient" x1="16" y1="10" x2="66" y2="70">
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

const clerkAppearance = {
  variables: {
    colorPrimary: "#f59e0b",
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
      borderRadius: "28px",
      boxShadow: "0 30px 90px rgba(0, 0, 0, 0.45)",
    },
    card: {
      borderRadius: "28px",
      border: "1px solid rgba(255, 255, 255, 0.18)",
    },
    headerTitle: {
      fontSize: "28px",
      fontWeight: "900",
      letterSpacing: "-0.04em",
      color: "#111827",
    },
    headerSubtitle: {
      color: "#6b7280",
    },
    formButtonPrimary: {
      background: "linear-gradient(135deg, #fde68a, #fbbf24 42%, #f97316)",
      color: "#111111",
      fontWeight: "900",
      boxShadow: "0 16px 38px rgba(251, 191, 36, 0.28)",
    },
    footerActionLink: {
      color: "#d97706",
      fontWeight: "800",
    },
    identityPreviewEditButton: {
      color: "#d97706",
    },
  },
};

export default function SignInPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.backLink}>
        ← Back to SunGrid
      </Link>

      <section className={styles.shell}>
        <div className={styles.brand}>
          <SunGridLogo />
          <h1 className={styles.name}>SunGrid</h1>
          <p className={styles.tagline}>Sign in to continue to your workspace.</p>
        </div>

        <div className={styles.clerkWrap}>
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