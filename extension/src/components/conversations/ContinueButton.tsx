import { useState } from "react";
import { Send } from "lucide-react";
import type { StoredConversation, StoredConvMessage } from "@/types";
import { ContinueAnywherePanel } from "./ContinueAnywherePanel";

interface Props {
  conversation: StoredConversation;
  messages: StoredConvMessage[] | null;
}

/**
 * Single "Continue Anywhere" entry point — one button opens the unified
 * panel that handles provider selection, preview, and handoff in one
 * flow. Replaces the previous dropdown + preview split.
 */
export function ContinueButton({ conversation, messages }: Props) {
  const [open, setOpen] = useState(false);
  const disabled = !messages || messages.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-primary/30 bg-primary text-primary-foreground px-3 text-xs font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
        title={
          disabled
            ? "No messages to continue"
            : "Continue this conversation in another AI"
        }
      >
        <Send className="h-3.5 w-3.5" />
        Continue Anywhere
      </button>

      {open && messages && (
        <ContinueAnywherePanel
          open
          conversation={conversation}
          messages={messages}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
