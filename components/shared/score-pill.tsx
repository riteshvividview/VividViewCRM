import { cn } from "@/lib/utils";
import { scoreColor } from "@/modules/leads/types";

interface ScorePillProps {
  score: number;
  className?: string;
  showBar?: boolean;
}

export function ScorePill({ score, className, showBar = false }: ScorePillProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", scoreColor(score))}>
        {score}
      </span>
      {showBar && (
        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500")}
            style={{ width: `${score}%` }}
          />
        </div>
      )}
    </span>
  );
}
