import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

function SunGridLogo() {
  return (
    <div className={styles.logoWrap} aria-hidden="true">
      <svg viewBox="0 0 80 80" className={styles.logo} role="img">
        <defs>
          <linearGradient id="sunGradient" x1="18" y1="12" x2="64" y2="68">
            <stop offset="0%" stopColor="#FFF7AD" />
            <stop offset="45%" stopColor="#FDBA33" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
          <filter id="sunGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 1  0 0.65 0 0 0.55  0 0 0.1 0 0  0 0 0 0.75 0"
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
          fill="url(#sunGradient)"
          filter="url(#sunGlow)"
        />

        <path
          d="M40 8V18M40 62V72M8 40H18M62 40H72M17.4 17.4L24.5 24.5M55.5 55.5L62.6 62.6M62.6 17.4L55.5 24.5M24.5 55.5L17.4 62.6"
          stroke="#FDE68A"
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

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className={styles.page}>
      <div className={styles.backgroundGlowOne} />
      <div className={styles.backgroundGlowTwo} />

      <section className={styles.card}>
        <SunGridLogo />

        <p className={styles.brand}>SunGrid</p>

        <h1 className={styles.title}>Turn team work into clear progress.</h1>

        <p className={styles.subtitle}>
          Plan projects, manage issues, run sprints, and track activity in one
          workspace.
        </p>

        <div className={styles.actions}>
          <div className={styles.authActions}>
            <Link href="/sign-in" className={styles.authButton}>
              Sign In
            </Link>

            <Link href="/sign-up" className={styles.authButton}>
              Create Account
            </Link>
          </div>

          <a href="/demo/start" className={styles.guestButton}>
            Try Guest Demo
          </a>
        </div>
      </section>
    </main>
  );
}