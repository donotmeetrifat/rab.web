import { MessagesSquare } from "lucide-react";
import { Empty } from "@/components/Empty";
import type { ReactNode } from "react";

export function ConversationEmptyState({
  query,
  action,
}: {
  query?: string;
  action?: ReactNode;
}) {
  if (query) {
    return (
      <Empty
        icon={<MessagesSquare className="h-5 w-5" />}
        title="No matching conversations"
        description={`Nothing matches “${query}”. Try a different search term.`}
      />
    );
  }
  return (
    <Empty
      icon={<MessagesSquare className="h-5 w-5" />}
      title="No conversations yet"
      description="Open ChatGPT (or another supported AI) and hit “Save to Memlace” — your chat will show up here."
      action={action}
    />
  );
}
