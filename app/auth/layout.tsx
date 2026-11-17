import Image from "next/image";

/** Sign-in pages: brand at the top, the card centred, everything inside one screen (no scrolling). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-purple-50/30 px-4 py-6 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950/20">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-violet-700 shadow-md shadow-purple-200 dark:shadow-purple-900/50">
          <Image src="/vividviewlogo.png" alt="" fill sizes="36px" className="object-contain p-1.5 brightness-0 invert" priority />
        </span>
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Vivid View</span>
      </div>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
