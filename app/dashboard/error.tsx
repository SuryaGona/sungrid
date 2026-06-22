"use client";

import Link from "next/link";
import { useEffect } from "react";

type DashboardErrorProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

function SunGridMark() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 shadow-[0_0_42px_rgba(251,191,36,0.18)]"
    >
      <svg viewBox="0 0 80 80" className="h-10 w-10">
        <defs>
          <linearGradient
            id="errorSunGradient"
            x1="18"
            y1="12"
            x2="64"
            y2="68"
          >
            <stop offset="0%" stopColor="#FFF7AD" />
            <stop offset="45%" stopColor="#FDBA33" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>

          <filter
            id="errorSunGlow"
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
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
          fill="url(#errorSunGradient)"
          filter="url(#errorSunGlow)"
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

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] px-6 py-10 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(251,191,36,0.13),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(249,115,22,0.09),transparent_30%)]" />

      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:58px_58px] [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1280px] items-center justify-center">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <SunGridMark />

          <p className="mt-7 text-sm font-black uppercase tracking-[0.28em] text-amber-300">
            Connection issue
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] text-white md:text-5xl">
            Dashboard could not load
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/50">
            SunGrid hit a temporary problem while loading your workspace. Your
            data is still safe. Try again in a moment.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={reset}
              style={{ cursor: "pointer" }}
              className="rounded-full bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 px-6 py-3 text-sm font-black text-black shadow-[0_14px_34px_rgba(251,191,36,0.16)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(251,191,36,0.24)] active:translate-y-0 active:scale-[0.98]"
            >
              Try again
            </button>

            <Link
              href="/dashboard"
              className="rounded-full border border-white/10 px-6 py-3 text-sm font-bold text-white/65 transition duration-200 hover:-translate-y-0.5 hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98]"
            >
              Dashboard
            </Link>

            <Link
              href="/"
              className="rounded-full border border-white/10 px-6 py-3 text-sm font-bold text-white/65 transition duration-200 hover:-translate-y-0.5 hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98]"
            >
              Home
            </Link>
          </div>

          {error.digest ? (
            <p className="mt-7 text-xs text-white/28">
              Error reference: {error.digest}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}