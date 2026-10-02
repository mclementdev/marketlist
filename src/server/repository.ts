import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StateDiff } from "@/lib/list-ops";
import { generateShareCode } from "@/lib/share-code";
import type { ListInfo, ListSnapshot } from "@/lib/types";

/** Résultat d'un commit : nouvelle version, conflit de version, ou liste introuvable. */
export type CommitResult = { ok: true; version: number } | { ok: false; reason: "conflict" | "not_found" };

export interface ListRepository {
  readonly kind: "supabase" | "memory";
  createList(name: string): Promise<ListInfo>;
  findListIdByCode(code: string): Promise<string | null>;
  getSnapshot(listId: string): Promise<ListSnapshot | null>;
  commit(listId: string, expectedVersion: number | null, diff: StateDiff): Promise<CommitResult>;
  rename(listId: string, name: string): Promise<number | null>;
  countRecentFailures(ipHash: string, sinceIso: string): Promise<number>;
  recordFailure(ipHash: string): Promise<void>;
  /** Diffuse un événement aux clients abonnés au canal `list:{id}`. */
  broadcast(listId: string, payload: unknown): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Supabase (production)                                               */
/* ------------------------------------------------------------------ */

class SupabaseRepository implements ListRepository {
  readonly kind = "supabase" as const;
  constructor(private readonly db: SupabaseClient) {}

  async createList(name: string): Promise<ListInfo> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const shareCode = generateShareCode();
      const { data, error } = await this.db
        .from("lists")
        .insert({ name, share_code: shareCode })
        .select("id, name, share_code")
        .single();
      if (!error && data) return { id: data.id, name: data.name, shareCode: data.share_code };
      if (error?.code !== "23505") throw new Error(`createList: ${error?.message}`);
      // Collision de code (très improbable) : on retente avec un autre.
    }
    throw new Error("createList: impossible de générer un code unique");
  }

  async findListIdByCode(code: string): Promise<string | null> {
    const { data, error } = await this.db.from("lists").select("id").eq("share_code", code).maybeSingle();
    if (error) throw new Error(`findListIdByCode: ${error.message}`);
    return data?.id ?? null;
  }

  async getSnapshot(listId: string): Promise<ListSnapshot | null> {
    const { data, error } = await this.db.rpc("get_list_snapshot", { p_list_id: listId });
    if (error) throw new Error(`getSnapshot: ${error.message}`);
    return (data as ListSnapshot | null) ?? null;
  }

  async commit(listId: string, expectedVersion: number | null, diff: StateDiff): Promise<CommitResult> {
    const { data, error } = await this.db.rpc("commit_list_changes", {
      p_list_id: listId,
      p_expected_version: expectedVersion,
      p_upsert_items: diff.upsertItems,
      p_delete_item_ids: diff.deleteItemIds,
      p_upsert_recipes: diff.upsertRecipes,
      p_delete_recipe_ids: diff.deleteRecipeIds,
    });
    if (error) throw new Error(`commit: ${error.message}`);
    if (data === null) return { ok: false, reason: "not_found" };
    const version = Number(data);
    return version < 0 ? { ok: false, reason: "conflict" } : { ok: true, version };
  }

  async rename(listId: string, name: string): Promise<number | null> {
    const { data, error } = await this.db.rpc("rename_list", { p_list_id: listId, p_name: name });
    if (error) throw new Error(`rename: ${error.message}`);
    return data === null ? null : Number(data);
  }

  async countRecentFailures(ipHash: string, sinceIso: string): Promise<number> {
    const { count, error } = await this.db
      .from("join_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", sinceIso);
    if (error) throw new Error(`countRecentFailures: ${error.message}`);
    return count ?? 0;
  }

  async recordFailure(ipHash: string): Promise<void> {
    await this.db.from("join_attempts").insert({ ip_hash: ipHash });
    // Ménage occasionnel des tentatives de plus d'un jour.
    if (Math.random() < 0.05) {
      const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
      await this.db.from("join_attempts").delete().lt("created_at", dayAgo);
    }
  }

  async broadcast(listId: string, payload: unknown): Promise<void> {
    const channel = this.db.channel(`list:${listId}`);
    try {
      const res = await channel.httpSend("change", payload);
      if (!res.success) console.warn(`broadcast échoué (${res.status}) : ${res.error}`);
    } finally {
      await this.db.removeChannel(channel);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Mémoire (développement sans Supabase, non persistant)               */
/* ------------------------------------------------------------------ */

class MemoryRepository implements ListRepository {
  readonly kind = "memory" as const;
  private lists = new Map<string, ListSnapshot>();
  private failures: { ipHash: string; at: string }[] = [];

  async createList(name: string): Promise<ListInfo> {
    const list: ListInfo = { id: crypto.randomUUID(), name, shareCode: generateShareCode() };
    this.lists.set(list.id, { list, version: 0, items: [], recipes: [] });
    return list;
  }

  async findListIdByCode(code: string): Promise<string | null> {
    for (const s of this.lists.values()) if (s.list.shareCode === code) return s.list.id;
    return null;
  }

  async getSnapshot(listId: string): Promise<ListSnapshot | null> {
    const s = this.lists.get(listId);
    return s ? structuredClone(s) : null;
  }

  async commit(listId: string, expectedVersion: number | null, diff: StateDiff): Promise<CommitResult> {
    const s = this.lists.get(listId);
    if (!s) return { ok: false, reason: "not_found" };
    if (expectedVersion !== null && s.version !== expectedVersion) return { ok: false, reason: "conflict" };
    const deleted = new Set(diff.deleteItemIds);
    const items = new Map(s.items.filter((i) => !deleted.has(i.id)).map((i) => [i.id, i]));
    for (const it of diff.upsertItems) items.set(it.id, structuredClone(it));
    const deletedRecipes = new Set(diff.deleteRecipeIds);
    const recipes = new Map(
      s.recipes.filter((r) => !deletedRecipes.has(r.recipeId)).map((r) => [r.recipeId, r]),
    );
    for (const r of diff.upsertRecipes) recipes.set(r.recipeId, { ...r });
    s.items = [...items.values()];
    s.recipes = [...recipes.values()];
    s.version += 1;
    return { ok: true, version: s.version };
  }

  async rename(listId: string, name: string): Promise<number | null> {
    const s = this.lists.get(listId);
    if (!s) return null;
    s.list.name = name;
    s.version += 1;
    return s.version;
  }

  async countRecentFailures(ipHash: string, sinceIso: string): Promise<number> {
    return this.failures.filter((f) => f.ipHash === ipHash && f.at >= sinceIso).length;
  }

  async recordFailure(ipHash: string): Promise<void> {
    this.failures.push({ ipHash, at: new Date().toISOString() });
  }

  async broadcast(): Promise<void> {
    // Pas de temps réel en mode mémoire : les clients se rabattent sur le rafraîchissement périodique.
  }
}

/* ------------------------------------------------------------------ */

const globalForRepo = globalThis as unknown as { __panierRepo?: ListRepository };

export function getRepository(): ListRepository {
  if (globalForRepo.__panierRepo) return globalForRepo.__panierRepo;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let repo: ListRepository;
  if (url && serviceKey) {
    repo = new SupabaseRepository(
      createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
  } else if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[panier] Variables Supabase absentes : stockage en mémoire (non persistant, sans temps réel).",
    );
    repo = new MemoryRepository();
  } else {
    throw new Error("Supabase n'est pas configuré (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).");
  }
  globalForRepo.__panierRepo = repo;
  return repo;
}
