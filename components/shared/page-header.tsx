import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  action?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title, description, subtitle, action, actions, className,
}: PageHeaderProps) {
  const body = description ?? subtitle;
  const controls = actions ?? action;
  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5",
      className
    )}>
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold text-foreground leading-tight">{title}</h1>
        {body && <p className="text-sm text-muted-foreground mt-0.5">{body}</p>}
      </div>
      {controls && (
        <div className="shrink-0 flex items-center gap-2 flex-wrap">
          {controls}
        </div>
      )}
    </div>
  );
}
