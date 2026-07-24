export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`skeleton rounded-md bg-muted ${className}`}
    />
  );
}

export function MemoryRowSkeleton() {
  return (
    <li className="rounded-lg border border-border bg-surface p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-2/3" />
    </li>
  );
}

export function MemoryListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="space-y-1.5" aria-busy="true" aria-label="Loading memories">
      {Array.from({ length: rows }).map((_, i) => (
        <MemoryRowSkeleton key={i} />
      ))}
    </ul>
  );
}
