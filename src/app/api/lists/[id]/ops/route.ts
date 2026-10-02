import { cleanName, isUuid, parseOp } from "@/lib/list-ops";
import { handle, readJson } from "@/server/http";
import { applyListOp, HttpError } from "@/server/lists";

/** Applique une opération (ajout de recette, coche, ajout manuel…) et renvoie le nouvel état. */
export async function POST(req: Request, ctx: RouteContext<"/api/lists/[id]/ops">) {
  return handle(async () => {
    const { id } = await ctx.params;
    if (!isUuid(id)) throw new HttpError(404, "Cette liste n'existe pas.");
    const body = await readJson(req);
    const op = parseOp(body.op);
    if (!op) throw new HttpError(400, "Opération invalide.");
    const by = cleanName(body.by, 40) ?? "Quelqu'un";
    return applyListOp(id.toLowerCase(), op, by);
  });
}
