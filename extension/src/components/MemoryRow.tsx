import { Star, Trash2, RotateCcw, ExternalLink } from "lucide-react";
import type { Memory } from "@/types";
import { providerMeta } from "@/lib/providers";

interface Props {
  memory: Memory;
  onToggleFavorite?: (id: string) => void;
  onTrash?: (id: string) => void;
  onRestore?: (id: string) => void;
  onDelete?: (id: string) => void;
  onOpen?: (m: Memory) => void;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function MemoryRow({ memory, onToggleFavorite, onTrash, onRestore, onDelete, onOpen }: Props) {
  const meta = providerMeta(memory.provider);
  const preview = memory.content.replace(/\s+/g, " ").slice(0, 140);
  return (
    <li className="group relative rounded-lg border border-border bg-surface p-3 hover:border-primary/40 transition-colors">
      <button
        type="button"
        onClick={() => onOpen?.(memory)}
        className="w-full text-left focus-visible:outline-none"
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ background: meta?.color ?? "#94a3b8" }}
            aria-hidden
          />
          <h4 className="text-sm font-medium text-foreground truncate flex-1">
            {memory.title}
          </h4>
          <time className="text-[11px] text-muted-foreground shrink-0">
            {formatRelative(memory.updatedAt)}
          </time>
        </div>
        {preview && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{preview}</p>
        )}
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-md bg-muted px-1.5 py-0.5">
            {meta?.name ?? "Other"}
          </span>
          {memory.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-md bg-muted px-1.5 py-0.5">#{t}</span>
          ))}
        </div>
      </button>

      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {onToggleFavorite && (
          <button
            type="button"
            aria-label={memory.favorite ? "Unfavorite" : "Favorite"}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(memory.id); }}
            className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <Star className={"h-3.5 w-3.5 " + (memory.favorite ? "fill-amber-400 text-amber-500" : "")} />
          </button>
        )}
        {memory.sourceUrl && (
          <a
            href={memory.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open source"
            onClick={(e) => e.stopPropagation()}
            className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {onRestore && (
          <button
            type="button"
            aria-label="Restore"
            onClick={(e) => { e.stopPropagation(); onRestore(memory.id); }}
            className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        {onTrash && (
          <button
            type="button"
            aria-label="Move to trash"
            onClick={(e) => { e.stopPropagation(); onTrash(memory.id); }}
            className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            aria-label="Delete permanently"
            onClick={(e) => { e.stopPropagation(); onDelete(memory.id); }}
            className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}
