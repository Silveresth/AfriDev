/** Layout d'authentification : présentation sobre et pro à gauche, formulaire épuré à droite. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-3 sm:p-6 bg-zinc-950/80 backdrop-blur-md">
      <div className="w-full max-w-4xl">{children}</div>
    </div>
  );
}
