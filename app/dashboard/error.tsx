"use client";

import Link from "next/link";
import { useEffect } from "react";

type DashboardErrorProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl">
          ⚠️
        </div>

        <h1 className="mt-6 text-2xl font-bold text-gray-900">
          Dashboard could not load
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          SunGrid hit a temporary problem while loading your workspace data.
          Your data is still safe. Try again, or go back home.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Try again
          </button>

          <Link
            href="/dashboard"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reload dashboard
          </Link>

          <Link
            href="/"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Home
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-5 text-xs text-gray-400">
            Error reference: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}