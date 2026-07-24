import type { ReactNode } from "react";

export function Empty({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground max-w-[260px]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
