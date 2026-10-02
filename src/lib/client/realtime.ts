"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/**
 * Client Supabase du navigateur, utilisé uniquement pour s'abonner aux canaux
 * Broadcast. Il n'a accès à aucune table (RLS sans policy). `null` si Supabase
 * n'est pas configuré : l'app se rabat alors sur le rafraîchissement périodique.
 */
export function getRealtimeClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client =
    url && key
      ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
  return client;
}
