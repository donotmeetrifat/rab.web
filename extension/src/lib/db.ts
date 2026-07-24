import Dexie, { type Table } from "dexie";
import type {
  Memory,
  Project,
  StoredConversation,
  StoredConvMessage,
} from "@/types";

class MemlaceDB extends Dexie {
  projects!: Table<Project, string>;
  memories!: Table<Memory, string>;
  conversations!: Table<StoredConversation, string>;
  convMessages!: Table<StoredConvMessage, string>;

  constructor() {
    super("memlace");

    // v1 — original schema
    this.version(1).stores({
      projects: "id, name, pinned, archived, updatedAt",
      memories:
        "id, projectId, provider, favorite, trashed, createdAt, updatedAt, *tags",
    });

    // v2 — adds pinned/archived on memories, favorite/icon on projects
    this.version(2)
      .stores({
        projects: "id, name, pinned, favorite, archived, updatedAt",
        memories:
          "id, projectId, provider, favorite, pinned, archived, trashed, createdAt, updatedAt, trashedAt, *tags",
      })
      .upgrade(async (tx) => {
        await tx
          .table<Memory>("memories")
          .toCollection()
          .modify((m) => {
            if (typeof m.pinned !== "boolean") m.pinned = false;
            if (typeof m.archived !== "boolean") m.archived = false;
            if (typeof m.trashedAt !== "number" && m.trashedAt !== null) {
              m.trashedAt = m.trashed ? m.updatedAt : null;
            }
          });
        await tx
          .table<Project>("projects")
          .toCollection()
          .modify((p) => {
            if (typeof p.favorite !== "boolean") p.favorite = false;
            if (typeof p.icon !== "string") p.icon = "folder";
          });
      });

    // v3 — conversation capture (provider adapters)
    this.version(3).stores({
      projects: "id, name, pinned, favorite, archived, updatedAt",
      memories:
        "id, projectId, provider, favorite, pinned, archived, trashed, createdAt, updatedAt, trashedAt, *tags",
      conversations:
        "id, provider, providerConversationId, [provider+providerConversationId], updatedAt, createdAt",
      convMessages: "id, conversationId, order, role",
    });
  }
}

export const db = new MemlaceDB();

export function uid(prefix = "id"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}
