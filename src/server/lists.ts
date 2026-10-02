import { createHash } from "node:crypto";
import { after } from "next/server";
import { applyOp, diffState, isEmptyDiff, type ListOp } from "@/lib/list-ops";
import type { ListSnapshot } from "@/lib/types";
import { getRepository } from "./repository";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Au-delà, l'instantané n'est pas joint à la diffusion : les clients le rechargent. */
const MAX_BROADCAST_BYTES = 100_000;

function scheduleBroadcast(snapshot: ListSnapshot) {
  const repo = getRepository();
  const json = JSON.stringify(snapshot);
  const payload =
    json.length <= MAX_BROADCAST_BYTES
      ? { version: snapshot.version, snapshot }
      : { version: snapshot.version };
  // Envoyé après la réponse HTTP pour ne pas ralentir l'auteur de la modification.
  after(() =>
    repo.broadcast(snapshot.list.id, payload).catch((err: unknown) => {
      console.error("[panier] broadcast", err);
    }),
  );
}

export async function createList(name: string): Promise<ListSnapshot> {
  const repo = getRepository();
  const list = await repo.createList(name);
  return { list, version: 0, items: [], recipes: [] };
}

export async function getList(listId: string): Promise<ListSnapshot> {
  const snapshot = await getRepository().getSnapshot(listId);
  if (!snapshot) throw new HttpError(404, "Cette liste n'existe plus.");
  return snapshot;
}

export async function renameList(listId: string, name: string): Promise<ListSnapshot> {
  const version = await getRepository().rename(listId, name);
  if (version === null) throw new HttpError(404, "Cette liste n'existe plus.");
  const snapshot = await getList(listId);
  scheduleBroadcast(snapshot);
  return snapshot;
}

const MAX_ATTEMPTS = 6;

/**
 * Applique une opération : lecture de l'état, calcul avec le réducteur pur,
 * écriture conditionnée à la version lue. Si quelqu'un a écrit entre-temps,
 * on relit et on recalcule : aucun ajout simultané n'est perdu, et pour une
 * même donnée c'est la dernière écriture qui gagne.
 */
export async function applyListOp(listId: string, op: ListOp, by: string): Promise<ListSnapshot> {
  const repo = getRepository();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const current = await repo.getSnapshot(listId);
    if (!current) throw new HttpError(404, "Cette liste n'existe plus.");

    const next = applyOp(current, op, {
      now: new Date().toISOString(),
      by,
      createId: () => crypto.randomUUID(),
    });
    const diff = diffState(current, next);
    if (isEmptyDiff(diff)) return current;

    const res = await repo.commit(listId, current.version, diff);
    if (res.ok) {
      const snapshot: ListSnapshot = {
        list: current.list,
        version: res.version,
        items: next.items,
        recipes: next.recipes,
      };
      scheduleBroadcast(snapshot);
      return snapshot;
    }
    if (res.reason === "not_found") throw new HttpError(404, "Cette liste n'existe plus.");
    // Conflit : petite attente aléatoire puis nouvel essai.
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * (attempt + 1)));
  }
  throw new HttpError(409, "La liste est très sollicitée, réessaie dans un instant.");
}

/* ------------------------------------------------------------------ */
/* Rejoindre par code, avec limitation des tentatives                   */
/* ------------------------------------------------------------------ */

const JOIN_WINDOW_MS = 15 * 60_000;
const JOIN_MAX_FAILURES = 10;

export function hashIp(ip: string): string {
  return createHash("sha256").update(`panier:${ip}`).digest("hex").slice(0, 32);
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function joinByCode(code: string, ip: string): Promise<ListSnapshot> {
  const repo = getRepository();
  const ipHash = hashIp(ip);
  const since = new Date(Date.now() - JOIN_WINDOW_MS).toISOString();
  if ((await repo.countRecentFailures(ipHash, since)) >= JOIN_MAX_FAILURES) {
    throw new HttpError(429, "Trop de codes essayés. Réessaie dans un quart d'heure.");
  }
  const listId = await repo.findListIdByCode(code);
  if (!listId) {
    await repo.recordFailure(ipHash);
    throw new HttpError(404, "Aucune liste ne correspond à ce code.");
  }
  return getList(listId);
}
