import type { StoredConversation } from "@/types";
import { ConversationCard } from "./ConversationCard";
import { ConversationEmptyState } from "./ConversationEmptyState";
import { MemoryListSkeleton } from "@/components/Skeleton";
import type { ReactNode } from "react";
import type { ConvSnippet } from "@/services/conversations";

export function ConversationList({
  conversations,
  loading,
  activeId,
  onOpen,
  onDelete,
  query,
  compact = false,
  emptyAction,
  snippets,
}: {
  conversations: StoredConversation[];
  loading?: boolean;
  activeId?: string | null;
  onOpen?: (c: StoredConversation) => void;
  onDelete?: (c: StoredConversation) => void;
  query?: string;
  compact?: boolean;
  emptyAction?: ReactNode;
  snippets?: Map<string, ConvSnippet | null>;
}) {
  if (loading && conversations.length === 0) {
    return <MemoryListSkeleton rows={compact ? 3 : 5} />;
  }
  if (conversations.length === 0) {
    return <ConversationEmptyState query={query} action={emptyAction} />;
  }
  return (
    <ul className="space-y-1.5" role="list">
      {conversations.map((c) => (
        <ConversationCard
          key={c.id}
          conversation={c}
          active={activeId === c.id}
          onOpen={onOpen}
          onDelete={onDelete}
          compact={compact}
          query={query}
          snippet={snippets?.get(c.id) ?? null}
        />
      ))}
    </ul>
  );
}
