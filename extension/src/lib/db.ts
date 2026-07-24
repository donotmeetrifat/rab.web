import Dexie, { type Table } from "dexie";
import type { Memory, Project } from "@/types";

class MemlaceDB extends Dexie {
  projects!: Table<Project, string>;
  memories!: Table<Memory, string>;

  constructor() {
    super("memlace");
    this.version(1).stores({
      projects: "id, name, pinned, archived, updatedAt",
      memories:
        "id, projectId, provider, favorite, trashed, createdAt, updatedAt, *tags",
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
