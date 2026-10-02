"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client/api";
import { readCachedSnapshot, updateRememberedList, writeCachedSnapshot } from "@/lib/client/local-store";
import { getRealtimeClient } from "@/lib/client/realtime";
import { applyOp, type ListOp, type ListState } from "@/lib/list-ops";
import type { ListInfo, ListSnapshot } from "@/lib/types";
import { uuid } from "@/lib/uuid";

type Status = "loading" | "ready" | "error" | "missing";
type Realtime = "connecting" | "live" | "offline";

interface Pending {
  opId: string;
  op: ListOp;
  at: string;
}

interface ActiveListValue {
  list: ListInfo | null;
  state: ListState | null;
  status: Status;
  realtime: Realtime;
  userName: string;
  dispatch: (op: ListOp) => void;
  refresh: () => Promise<void>;
  rename: (name: string) => Promise<void>;
}

const ActiveListContext = createContext<ActiveListValue | null>(null);

export function useActiveList(): ActiveListValue {
  const ctx = useContext(ActiveListContext);
  if (!ctx) throw new Error("useActiveList doit être utilisé dans <ActiveListProvider>");
  return ctx;
}

const POLL_FALLBACK_MS = 5_000; // temps réel indisponible
const POLL_SAFETY_MS = 60_000; // temps réel actif : simple filet de sécurité

/**
 * État de la liste active.
 * - `snapshot` : dernier état confirmé par le serveur (la version la plus haute gagne).
 * - `pending` : opérations envoyées mais pas encore confirmées, rejouées par-dessus
 *   le snapshot pour un affichage instantané (mise à jour optimiste). En cas
 *   d'échec, l'opération est simplement retirée : l'écran revient à l'état serveur.
 * - Synchronisation : canal Broadcast `list:{id}`, avec repli sur un
 *   rafraîchissement périodique si le temps réel ne répond pas.
 *
 * Le composant est monté avec `key={listId}` : changer de liste repart d'un état neuf.
 */
export function ActiveListProvider({
  listId,
  userName,
  children,
}: {
  listId: string;
  userName: string;
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<ListSnapshot | null>(() => readCachedSnapshot(listId));
  const [pending, setPending] = useState<Pending[]>([]);
  const [status, setStatus] = useState<Status>(() => (snapshot ? "ready" : "loading"));
  const [realtime, setRealtime] = useState<Realtime>(() =>
    getRealtimeClient() ? "connecting" : "offline",
  );
  const versionRef = useRef(snapshot?.version ?? -1);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const accept = useCallback(
    (s: ListSnapshot) => {
      if (s.list.id !== listId || s.version < versionRef.current) return;
      versionRef.current = s.version;
      setSnapshot(s);
      setStatus("ready");
      writeCachedSnapshot(s);
      updateRememberedList(s.list);
    },
    [listId],
  );

  const onRefreshError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 404) setStatus("missing");
    else setStatus((prev) => (prev === "loading" ? "error" : prev));
  }, []);

  const refresh = useCallback(
    () => api.getList(listId).then(accept).catch(onRefreshError),
    [accept, listId, onRefreshError],
  );

  // Chargement initial.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Temps réel : abonnement au canal Broadcast de la liste.
  useEffect(() => {
    const client = getRealtimeClient();
    if (!client) return;
    const channel = client
      .channel(`list:${listId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "change" }, ({ payload }) => {
        const p = payload as { version?: number; snapshot?: ListSnapshot };
        if (p.snapshot) accept(p.snapshot);
        else if (typeof p.version === "number" && p.version > versionRef.current) void refresh();
      })
      .subscribe((st) => {
        if (st === "SUBSCRIBED") {
          setRealtime("live");
          void refresh(); // rattrape ce qui a pu être manqué pendant la (re)connexion
        } else {
          setRealtime("offline");
        }
      });
    return () => {
      void client.removeChannel(channel);
    };
  }, [accept, listId, refresh]);

  // Repli : rafraîchissement périodique, au retour au premier plan et au retour du réseau.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(onVisible, realtime === "live" ? POLL_SAFETY_MS : POLL_FALLBACK_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [realtime, refresh]);

  const dispatch = useCallback(
    (op: ListOp) => {
      const p: Pending = { opId: uuid(), op, at: new Date().toISOString() };
      setPending((prev) => [...prev, p]);
      // File d'attente : les opérations partent dans l'ordre où elles ont été faites.
      queueRef.current = queueRef.current.then(async () => {
        try {
          accept(await api.applyOp(listId, op, userName));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erreur inconnue.";
          toast.error("Modification annulée", { description: message });
          if (err instanceof ApiError && err.status === 404) setStatus("missing");
        } finally {
          setPending((prev) => prev.filter((x) => x.opId !== p.opId));
        }
      });
    },
    [accept, listId, userName],
  );

  const rename = useCallback(
    async (name: string) => {
      try {
        accept(await api.renameList(listId, name));
      } catch (err) {
        toast.error("Impossible de renommer la liste", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [accept, listId],
  );

  const state = useMemo<ListState | null>(() => {
    if (!snapshot) return null;
    let s: ListState = { items: snapshot.items, recipes: snapshot.recipes };
    for (const p of pending) {
      let n = 0;
      s = applyOp(s, p.op, { now: p.at, by: userName, createId: () => `tmp-${p.opId}-${n++}` });
    }
    return s;
  }, [snapshot, pending, userName]);

  const value = useMemo<ActiveListValue>(
    () => ({
      list: snapshot?.list ?? null,
      state,
      status,
      realtime,
      userName,
      dispatch,
      refresh,
      rename,
    }),
    [snapshot, state, status, realtime, userName, dispatch, refresh, rename],
  );

  return <ActiveListContext.Provider value={value}>{children}</ActiveListContext.Provider>;
}
