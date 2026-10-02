import type { ListOp } from "@/lib/list-ops";
import type { ListSnapshot } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Pas de connexion. Vérifie ton réseau.");
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || body === null) {
    throw new ApiError(res.status, body?.error ?? "Erreur du serveur, réessaie.");
  }
  return body;
}

export const api = {
  createList: (name: string) =>
    request<ListSnapshot>("/api/lists", { method: "POST", body: JSON.stringify({ name }) }),
  joinList: (code: string) =>
    request<ListSnapshot>("/api/lists/join", { method: "POST", body: JSON.stringify({ code }) }),
  getList: (id: string) => request<ListSnapshot>(`/api/lists/${id}`),
  renameList: (id: string, name: string) =>
    request<ListSnapshot>(`/api/lists/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  applyOp: (id: string, op: ListOp, by: string) =>
    request<ListSnapshot>(`/api/lists/${id}/ops`, {
      method: "POST",
      body: JSON.stringify({ op, by }),
    }),
};
