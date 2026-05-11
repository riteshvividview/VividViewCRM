import Image from "next/image";
import { cn } from "@/lib/utils";

export function AuthLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-700 flex items-center justify-center shadow-lg shadow-purple-200 dark:shadow-purple-900/50 p-2 relative">
        <Image
          src="/vividviewlogo.png"
          alt="Vivid View"
          fill
          sizes="64px"
          className="object-contain p-2 brightness-0 invert"
          priority
        />
      </div>
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Vivid View</h1>
        <p className="text-xs text-muted-foreground font-medium tracking-wider uppercase">CRM</p>
      </div>
    </div>
  );
}
