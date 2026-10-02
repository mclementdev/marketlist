"use client";

import { useSyncExternalStore } from "react";
import type { ListInfo, ListSnapshot } from "@/lib/types";
import { uuid } from "@/lib/uuid";

/**
 * Données propres à l'appareil, gardées dans localStorage : prénom, identifiant
 * d'appareil, listes rejointes et liste active. Exposées comme un store externe
 * pour `useSyncExternalStore` (null pendant le rendu serveur et l'hydratation).
 */

export interface Profile {
  deviceId: string;
  name: string;
}

export interface LocalState {
  profile: Profile | null;
  lists: ListInfo[];
  activeListId: string | null;
}

const KEY = "panier:v1";
const SNAPSHOT_PREFIX = "panier:snapshot:";

let state: LocalState | null = null;
const listeners = new Set<() => void>();

function read(): LocalState {
  const empty: LocalState = { profile: null, lists: [], activeListId: null };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    const lists = Array.isArray(parsed.lists) ? parsed.lists : [];
    return {
      profile: parsed.profile?.name ? parsed.profile : null,
      lists,
      activeListId: lists.some((l) => l.id === parsed.activeListId) ? (parsed.activeListId ?? null) : null,
    };
  } catch {
    return empty;
  }
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = read();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): LocalState {
  if (state === null) state = read();
  return state;
}

function getServerSnapshot(): LocalState | null {
  return null;
}

export function useLocalState(): LocalState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function updateLocalState(fn: (s: LocalState) => LocalState) {
  state = fn(getSnapshot());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // stockage indisponible (navigation privée…) : l'état reste en mémoire
  }
  emit();
}

/* Actions ------------------------------------------------------------ */

export function setProfileName(name: string) {
  updateLocalState((s) => ({
    ...s,
    profile: { deviceId: s.profile?.deviceId ?? uuid(), name },
  }));
}

/** Mémorise une liste (ou met à jour son nom) et en fait la liste active. */
export function rememberList(list: ListInfo, activate = true) {
  updateLocalState((s) => {
    const exists = s.lists.some((l) => l.id === list.id);
    return {
      ...s,
      lists: exists ? s.lists.map((l) => (l.id === list.id ? list : l)) : [...s.lists, list],
      activeListId: activate ? list.id : s.activeListId,
    };
  });
}

export function updateRememberedList(list: ListInfo) {
  const current = getSnapshot().lists.find((l) => l.id === list.id);
  if (current && (current.name !== list.name || current.shareCode !== list.shareCode)) {
    rememberList(list, false);
  }
}

export function setActiveList(id: string) {
  updateLocalState((s) => ({ ...s, activeListId: id }));
}

export function forgetList(id: string) {
  updateLocalState((s) => {
    const lists = s.lists.filter((l) => l.id !== id);
    return {
      ...s,
      lists,
      activeListId: s.activeListId === id ? (lists[0]?.id ?? null) : s.activeListId,
    };
  });
  try {
    window.localStorage.removeItem(SNAPSHOT_PREFIX + id);
  } catch {
    // ignoré
  }
}

/* Cache du dernier état connu, pour un affichage instantané au lancement. */

export function readCachedSnapshot(listId: string): ListSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_PREFIX + listId);
    return raw ? (JSON.parse(raw) as ListSnapshot) : null;
  } catch {
    return null;
  }
}

export function writeCachedSnapshot(snapshot: ListSnapshot) {
  try {
    window.localStorage.setItem(SNAPSHOT_PREFIX + snapshot.list.id, JSON.stringify(snapshot));
  } catch {
    // ignoré
  }
}
