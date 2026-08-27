"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

function SunGridLogo() {
  return (
    <div className="sungrid-logo" aria-hidden="true">
      <svg viewBox="0 0 80 80" className="h-[54px] w-[54px]">
        <defs>
          <linearGradient
            id="sunGridErrorGradient"
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
            id="sunGridErrorGlow"
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0.9 0 0 0 0.75  0 0.65 0 0 0.45  0 0 0.25 0 0.12  0 0 0 0.55 0"
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
          fill="url(#sunGridErrorGradient)"
          filter="url(#sunGridErrorGlow)"
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

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    Sentry.withScope((scope) => {
      scope.setTag("errorBoundary", "dashboard");

      if (error.digest) {
        scope.setTag("nextjsDigest", error.digest);
      }

      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <>
      <style>{`
        html,
        body {
          margin: 0;
          min-height: 100%;
          background: #050505;
        }

        .sungrid-error-card {
          animation: sungrid-card-enter 520ms cubic-bezier(0.22, 1, 0.36, 1)
            both;
        }

        .sungrid-logo {
          display: flex;
          width: 74px;
          height: 74px;
          margin: 0 auto 24px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(214, 191, 118, 0.22);
          border-radius: 24px;
          background: linear-gradient(
            145deg,
            rgba(201, 162, 74, 0.18),
            rgba(111, 78, 30, 0.08)
          );
          box-shadow:
            0 0 50px rgba(201, 162, 74, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.14);
          animation: sungrid-logo-float 3.8s ease-in-out infinite;
        }

        .sungrid-glow-one {
          animation: sungrid-glow-one 8s ease-in-out infinite alternate;
        }

        .sungrid-glow-two {
          animation: sungrid-glow-two 10s ease-in-out infinite alternate;
        }

        @keyframes sungrid-card-enter {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.97);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes sungrid-logo-float {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-7px);
          }
        }

        @keyframes sungrid-glow-one {
          from {
            transform: translate(-50%, 0) scale(1);
          }

          to {
            transform: translate(-50%, 24px) scale(1.12);
          }
        }

        @keyframes sungrid-glow-two {
          from {
            transform: translate(0, 0) scale(1);
          }

          to {
            transform: translate(-30px, -22px) scale(1.1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sungrid-error-card,
          .sungrid-logo,
          .sungrid-glow-one,
          .sungrid-glow-two {
            animation: none;
          }
        }
      `}</style>

      <main
        className="
          relative grid min-h-dvh w-full place-items-center overflow-hidden
          bg-[radial-gradient(circle_at_50%_10%,rgba(201,162,74,0.14),transparent_32%),radial-gradient(circle_at_15%_80%,rgba(111,78,30,0.12),transparent_30%),radial-gradient(circle_at_85%_75%,rgba(214,191,118,0.08),transparent_28%),#050505]
          p-6 text-white
          before:pointer-events-none before:absolute before:inset-0
          before:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)]
          before:bg-[size:54px_54px]
          before:[mask-image:radial-gradient(circle_at_center,black,transparent_72%)]
          max-[520px]:p-5
        "
      >
        <div
          className="
            sungrid-glow-one pointer-events-none absolute left-1/2 top-[-130px]
            h-[430px] w-[430px] -translate-x-1/2 rounded-full
            bg-[rgba(201,162,74,0.14)] blur-[90px]
          "
        />

        <div
          className="
            sungrid-glow-two pointer-events-none absolute bottom-[-180px]
            right-[-140px] h-[470px] w-[470px] rounded-full
            bg-[rgba(111,78,30,0.16)] blur-[100px]
          "
        />

        <section
          className="
            sungrid-error-card relative z-[1] w-[min(100%,540px)]
            rounded-[30px] border border-white/10
            bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))]
            px-9 py-10 text-center backdrop-blur-[22px]
            shadow-[0_30px_90px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]
            max-[520px]:rounded-[26px] max-[520px]:px-6 max-[520px]:py-9
          "
        >
          <SunGridLogo />

          <p className="mb-4 mt-0 text-sm font-extrabold uppercase tracking-[0.22em] text-[#D6BF76]">
            SunGrid
          </p>

          <h1 className="m-0 text-[clamp(38px,7vw,58px)] font-black leading-[0.96] tracking-[-0.055em]">
            Something went wrong
          </h1>

          <p className="mx-auto mb-0 mt-5 max-w-[400px] text-[15.5px] leading-[1.65] text-white/55">
            SunGrid hit a temporary problem. Try loading the page again or
            return to the main website.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
            <button
              type="button"
              onClick={reset}
              className="
                flex h-[52px] cursor-pointer items-center justify-center
                rounded-full border-0
                bg-[linear-gradient(135deg,#f4e7b0,#c8a14a_48%,#6f4e1e)]
                text-[15px] font-extrabold text-[#111111]
                shadow-[0_18px_44px_rgba(201,162,74,0.22)]
                transition-[transform,box-shadow] duration-200
                hover:-translate-y-0.5
                hover:shadow-[0_24px_58px_rgba(201,162,74,0.3)]
                active:translate-y-0 active:scale-[0.98]
              "
            >
              Try again
            </button>

            <Link
              href="/"
              className="
                flex h-[52px] items-center justify-center rounded-full
                border border-[#D6BF7633] bg-white/[0.08]
                text-[15px] font-extrabold text-white/80 no-underline
                shadow-[0_14px_34px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.1)]
                transition-[transform,box-shadow,background,border-color,color]
                duration-200
                hover:-translate-y-0.5 hover:border-[#D6BF765C]
                hover:bg-[#D6BF761F] hover:text-white
                hover:shadow-[0_20px_48px_rgba(0,0,0,0.36),0_0_34px_rgba(201,162,74,0.12)]
                active:translate-y-0 active:scale-[0.98]
              "
            >
              Go home
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}