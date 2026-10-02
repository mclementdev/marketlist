"use client";

import { api } from "./api";
import { rememberList, writeCachedSnapshot } from "./local-store";

/** Crée une liste, la mémorise et l'active. */
export async function createAndActivate(name: string) {
  const snapshot = await api.createList(name);
  writeCachedSnapshot(snapshot);
  rememberList(snapshot.list);
  return snapshot;
}

/** Rejoint une liste par son code, la mémorise et l'active. */
export async function joinAndActivate(code: string) {
  const snapshot = await api.joinList(code);
  writeCachedSnapshot(snapshot);
  rememberList(snapshot.list);
  return snapshot;
}
