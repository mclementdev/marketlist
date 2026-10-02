import { normalizeShareCode } from "@/lib/share-code";
import { handle, readJson } from "@/server/http";
import { clientIp, HttpError, joinByCode } from "@/server/lists";

/** Rejoint une liste à partir de son code de partage (tentatives limitées par IP). */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const code = typeof body.code === "string" ? normalizeShareCode(body.code) : null;
    if (!code) throw new HttpError(400, "Le code fait 6 caractères (lettres et chiffres).");
    return joinByCode(code, clientIp(req.headers));
  });
}
