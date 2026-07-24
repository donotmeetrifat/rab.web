import { memo } from "react";
import {
  Star,
  Trash2,
  RotateCcw,
  ExternalLink,
  Pin,
  MoreHorizontal,
  Copy,
  Archive,
  ArchiveRestore,
  Pencil,
  FolderInput,
} from "lucide-react";
import type { Memory } from "@/types";
import { providerMeta } from "@/lib/providers";
import { colorForTag } from "@/services/memories";
import { useOutsideClick } from "@/components/Dialog";
import { useState } from "react";

interface Props {
  memory: Memory;
  selected?: boolean;
  onSelectChange?: (id: string, next: boolean) => void;
  onToggleFavorite?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onTrash?: (id: string) => void;
  onRestore?: (id: string) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onCopy?: (id: string) => void;
  onEdit?: (id: string) => void;
  onMove?: (id: string) => void;
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

function MemoryRowInner(props: Props) {
  const {
    memory, selected, onSelectChange,
    onToggleFavorite, onTogglePin,
    onTrash, onRestore, onDelete,
    onArchive, onUnarchive,
    onDuplicate, onCopy, onEdit, onMove,
    onOpen,
  } = props;

  const meta = providerMeta(memory.provider);
  const preview = memory.content.replace(/\s+/g, " ").slice(0, 140);
  const [menuOpen, setMenuOpen] = useState(false);
  const { ref } = useOutsideClick<HTMLDivElement>(() => setMenuOpen(false));

  return (
    <li
      className={
        "group relative rounded-lg border p-3 transition-colors " +
        (selected
          ? "border-primary/50 bg-primary/5"
          : "border-border bg-surface hover:border-primary/40")
      }
    >
      <div className="flex items-start gap-2">
        {onSelectChange && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={(e) => onSelectChange(memory.id, e.target.checked)}
            aria-label={`Select ${memory.title}`}
            className="mt-1 h-3.5 w-3.5 accent-[color:var(--color-primary)]"
          />
        )}
        <button
          type="button"
          onClick={() => onOpen?.(memory)}
          className="flex-1 min-w-0 text-left focus-visible:outline-none"
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: meta?.color ?? "#94a3b8" }}
              aria-hidden
            />
            {memory.pinned && (
              <Pin className="h-3 w-3 text-primary shrink-0" aria-label="Pinned" />
            )}
            <h4 className="text-sm font-medium text-foreground truncate flex-1">
              {memory.title}
            </h4>
            <time className="text-[11px] text-muted-foreground shrink-0">
              {formatRelative(memory.updatedAt)}
            </time>
          </div>
          {preview && (
            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
              {preview}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-md bg-muted px-1.5 py-0.5">
              {meta?.name ?? "Other"}
            </span>
            {memory.archived && (
              <span className="rounded-md bg-amber-100 text-amber-800 px-1.5 py-0.5 dark:bg-amber-950 dark:text-amber-200">
                Archived
              </span>
            )}
            {memory.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-md px-1.5 py-0.5 text-white text-[10px] font-medium"
                style={{ background: colorForTag(t) }}
              >
                #{t}
              </span>
            ))}
            {memory.tags.length > 4 && (
              <span className="text-[10px]">+{memory.tags.length - 4}</span>
            )}
          </div>
        </button>
      </div>

      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {onTogglePin && (
          <IconBtn
            label={memory.pinned ? "Unpin" : "Pin"}
            onClick={() => onTogglePin(memory.id)}
          >
            <Pin className={"h-3.5 w-3.5 " + (memory.pinned ? "text-primary" : "")} />
          </IconBtn>
        )}
        {onToggleFavorite && (
          <IconBtn
            label={memory.favorite ? "Unfavorite" : "Favorite"}
            onClick={() => onToggleFavorite(memory.id)}
          >
            <Star
              className={
                "h-3.5 w-3.5 " +
                (memory.favorite ? "fill-amber-400 text-amber-500" : "")
              }
            />
          </IconBtn>
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
        {onTrash && (
          <IconBtn label="Move to trash" onClick={() => onTrash(memory.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        )}
        {onRestore && (
          <IconBtn label="Restore" onClick={() => onRestore(memory.id)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </IconBtn>
        )}
        {onDelete && (
          <IconBtn label="Delete permanently" onClick={() => onDelete(memory.id)}>
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </IconBtn>
        )}
        {(onDuplicate || onCopy || onEdit || onMove || onArchive || onUnarchive) && (
          <div className="relative" ref={ref}>
            <IconBtn
              label="More actions"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </IconBtn>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-border bg-surface shadow-xl py-1 text-xs animate-scale-in"
              >
                {onEdit && (
                  <MenuItem icon={Pencil} onClick={() => { setMenuOpen(false); onEdit(memory.id); }}>
                    Edit
                  </MenuItem>
                )}
                {onDuplicate && (
                  <MenuItem icon={Copy} onClick={() => { setMenuOpen(false); onDuplicate(memory.id); }}>
                    Duplicate
                  </MenuItem>
                )}
                {onCopy && (
                  <MenuItem icon={Copy} onClick={() => { setMenuOpen(false); onCopy(memory.id); }}>
                    Copy content
                  </MenuItem>
                )}
                {onMove && (
                  <MenuItem icon={FolderInput} onClick={() => { setMenuOpen(false); onMove(memory.id); }}>
                    Move to project…
                  </MenuItem>
                )}
                {onArchive && !memory.archived && (
                  <MenuItem icon={Archive} onClick={() => { setMenuOpen(false); onArchive(memory.id); }}>
                    Archive
                  </MenuItem>
                )}
                {onUnarchive && memory.archived && (
                  <MenuItem icon={ArchiveRestore} onClick={() => { setMenuOpen(false); onUnarchive(memory.id); }}>
                    Unarchive
                  </MenuItem>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  ...rest
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
      {...rest}
    >
      {children}
    </button>
  );
}

function MenuItem({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof Copy;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted text-left"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{children}</span>
    </button>
  );
}

export const MemoryRow = memo(MemoryRowInner);
