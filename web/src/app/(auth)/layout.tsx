/** Layout d'authentification : fond de marque discret (points, lueurs), carte centrée. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-surface p-3 sm:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(var(--line-strong)_1px,transparent_1.2px)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] bg-[length:22px_22px] opacity-60" />
        <div className="absolute -top-48 -left-40 size-[36rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)] blur-2xl" />
        <div className="absolute -right-40 -bottom-48 size-[36rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--secondary)_12%,transparent),transparent)] blur-2xl" />
      </div>
      <div className="w-full max-w-5xl">{children}</div>
    </div>
  );
}
