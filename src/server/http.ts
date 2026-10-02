import { HttpError } from "./lists";

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    if (typeof body === "object" && body !== null && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // corps invalide
  }
  throw new HttpError(400, "Requête invalide.");
}

/** Exécute un handler et convertit les erreurs en réponses JSON `{ error }`. */
export async function handle(fn: () => Promise<unknown>, status = 200): Promise<Response> {
  try {
    const data = await fn();
    return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof HttpError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[panier]", err);
    return Response.json({ error: "Erreur du serveur, réessaie." }, { status: 500 });
  }
}
