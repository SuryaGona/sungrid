"use client";

import Link from "next/link";
import { useEffect } from "react";

type DashboardErrorProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

function SunGridLogo() {
  return (
    <div
      className="
        mx-auto mb-[20px] flex h-[70px] w-[70px] items-center justify-center
        rounded-[23px] border border-[#D6BF7638]
        bg-[linear-gradient(145deg,rgba(201,162,74,0.18),rgba(111,78,30,0.08))]
        shadow-[0_0_50px_rgba(201,162,74,0.18),inset_0_1px_0_rgba(255,255,255,0.14)]
        max-[520px]:mb-[18px] max-[520px]:h-[76px] max-[520px]:w-[76px] max-[520px]:rounded-[24px]
        min-[521px]:max-h-[760px]:mb-[16px] min-[521px]:max-h-[760px]:h-[68px] min-[521px]:max-h-[760px]:w-[68px]
      "
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 80 80"
        className="
          h-[52px] w-[52px]
          max-[520px]:h-[56px] max-[520px]:w-[56px]
          min-[521px]:max-h-[760px]:h-[50px] min-[521px]:max-h-[760px]:w-[50px]
        "
        role="img"
      >
        <defs>
          <linearGradient id="errorSunGradient" x1="18" y1="12" x2="64" y2="68">
            <stop offset="0%" stopColor="#F4E7B0" />
            <stop offset="45%" stopColor="#C8A14A" />
            <stop offset="100%" stopColor="#6F4E1E" />
          </linearGradient>

          <filter id="errorSunGlow" x="-60%" y="-60%" width="220%" height="220%">
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
          fill="url(#errorSunGradient)"
          filter="url(#errorSunGlow)"
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

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <>
      <style>{`
        html,
        body {
          overflow: hidden;
        }

        @media (max-width: 520px) {
          html,
          body {
            overflow-x: hidden;
            overflow-y: auto;
          }
        }
      `}</style>

      <main
        className="
          relative grid h-dvh w-full box-border place-items-center overflow-hidden p-6 text-white
          bg-[radial-gradient(circle_at_50%_10%,rgba(201,162,74,0.14),transparent_32%),radial-gradient(circle_at_15%_80%,rgba(111,78,30,0.12),transparent_30%),radial-gradient(circle_at_85%_75%,rgba(214,191,118,0.08),transparent_28%),#050505]
          before:pointer-events-none before:absolute before:inset-0
          before:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)]
          before:bg-[size:54px_54px]
          before:[mask-image:radial-gradient(circle_at_center,black,transparent_72%)]
          max-[520px]:h-auto max-[520px]:min-h-dvh max-[520px]:overflow-x-hidden max-[520px]:overflow-y-auto max-[520px]:p-5
        "
      >
        <div
          className="
            pointer-events-none absolute left-1/2 top-[-120px] h-[420px] w-[420px]
            -translate-x-1/2 rounded-full bg-[rgba(201,162,74,0.14)] blur-[80px]
          "
        />

        <div
          className="
            pointer-events-none absolute bottom-[-160px] right-[-120px] h-[460px] w-[460px]
            rounded-full bg-[rgba(111,78,30,0.14)] blur-[90px]
          "
        />

        <section
          className="
            relative z-[1] box-border w-[min(100%,560px)] max-h-[calc(100dvh-48px)]
            rounded-[30px] border border-white/10
            bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))]
            px-[36px] py-[34px] text-center backdrop-blur-[22px]
            shadow-[0_30px_90px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]
            max-[520px]:max-h-none max-[520px]:w-full max-[520px]:rounded-[26px] max-[520px]:px-6 max-[520px]:py-[34px]
            min-[521px]:max-h-[760px]:px-[36px] min-[521px]:max-h-[760px]:py-7
          "
        >
          <SunGridLogo />

          <p
            className="
              mb-[17px] mt-0 text-[15px] font-extrabold uppercase tracking-[0.22em] text-[#D6BF76]
              max-[520px]:mb-[14px] max-[520px]:text-[14px]
              min-[521px]:max-h-[760px]:mb-[14px] min-[521px]:max-h-[760px]:text-[14px]
            "
          >
            Connection issue
          </p>

          <h1
            className="
              mx-auto m-0 max-w-[500px] text-[clamp(40px,5vw,62px)] font-black leading-[0.95] tracking-[-0.06em]
              max-[520px]:text-[42px]
              min-[521px]:max-h-[760px]:text-[48px]
            "
          >
            Dashboard could not load
          </h1>

          <p
            className="
              mx-auto mb-0 mt-[22px] max-w-[420px] text-[15.5px] leading-[1.65] text-white/55
              max-[520px]:text-[15.5px]
              min-[521px]:max-h-[760px]:mt-[16px] min-[521px]:leading-[1.55]
            "
          >
            SunGrid hit a temporary problem while loading your workspace. Try again in a moment.
          </p>

          <div
            className="
              mt-[34px] grid grid-cols-3 gap-3
              max-[620px]:grid-cols-1
              min-[521px]:max-h-[760px]:mt-7
            "
          >
            <button
              type="button"
              onClick={reset}
              className="
                flex h-[52px] cursor-pointer items-center justify-center rounded-full border-0
                bg-[linear-gradient(135deg,#f4e7b0,#c8a14a_48%,#6f4e1e)]
                text-[15px] font-extrabold text-[#111111]
                shadow-[0_18px_44px_rgba(201,162,74,0.22)]
                transition-[transform,box-shadow] duration-180 ease-in-out
                hover:-translate-y-0.5 hover:shadow-[0_24px_58px_rgba(201,162,74,0.3)]
                active:translate-y-0 active:scale-[0.98]
                min-[521px]:max-h-[760px]:h-[50px]
              "
            >
              Try again
            </button>

            <Link
              href="/dashboard"
              className="
                flex h-[52px] items-center justify-center rounded-full border border-[#D6BF7633]
                bg-white/[0.08] text-[15px] font-extrabold text-white/80 no-underline
                shadow-[0_14px_34px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.1)]
                transition-[transform,box-shadow,background,border-color,color] duration-180 ease-in-out
                hover:-translate-y-0.5 hover:border-[#D6BF765C] hover:bg-[#D6BF761F] hover:text-white
                hover:shadow-[0_20px_48px_rgba(0,0,0,0.36),0_0_34px_rgba(201,162,74,0.12),inset_0_1px_0_rgba(255,255,255,0.14)]
                active:translate-y-0 active:scale-[0.98]
                min-[521px]:max-h-[760px]:h-[50px]
              "
            >
              Dashboard
            </Link>

            <Link
              href="/"
              className="
                flex h-[52px] items-center justify-center rounded-full border border-[#D6BF7633]
                bg-white/[0.08] text-[15px] font-extrabold text-white/80 no-underline
                shadow-[0_14px_34px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.1)]
                transition-[transform,box-shadow,background,border-color,color] duration-180 ease-in-out
                hover:-translate-y-0.5 hover:border-[#D6BF765C] hover:bg-[#D6BF761F] hover:text-white
                hover:shadow-[0_20px_48px_rgba(0,0,0,0.36),0_0_34px_rgba(201,162,74,0.12),inset_0_1px_0_rgba(255,255,255,0.14)]
                active:translate-y-0 active:scale-[0.98]
                min-[521px]:max-h-[760px]:h-[50px]
              "
            >
              Home
            </Link>
          </div>

          {error.digest ? (
            <p className="mb-0 mt-[26px] text-[13px] text-white/28">
              Error reference: {error.digest}
            </p>
          ) : null}
        </section>
      </main>
    </>
  );
}