export default function DashboardLoading() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050710] px-6 py-10 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(214,191,118,0.13),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(214,191,118,0.07),transparent_30%)]" />

      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:58px_58px] [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />

      <section className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-[#d6bf76]" />

        <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.24em] text-[#d6bf76]">
          Loading
        </p>

        <h1 className="mt-3 text-2xl font-extrabold tracking-[-0.04em] text-white">
          Loading SunGrid
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/50">
          Preparing your workspace, projects, and dashboard data.
        </p>
      </section>
    </main>
  );
}