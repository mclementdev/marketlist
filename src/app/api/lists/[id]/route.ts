import { cleanName, isUuid } from "@/lib/list-ops";
import { handle, readJson } from "@/server/http";
import { getList, HttpError, renameList } from "@/server/lists";

async function listId(ctx: RouteContext<"/api/lists/[id]">): Promise<string> {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, "Cette liste n'existe pas.");
  return id.toLowerCase();
}

/** Instantané complet d'une liste (chargement initial et rafraîchissement de repli). */
export async function GET(_req: Request, ctx: RouteContext<"/api/lists/[id]">) {
  return handle(async () => getList(await listId(ctx)));
}

/** Renomme une liste. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/lists/[id]">) {
  return handle(async () => {
    const id = await listId(ctx);
    const name = cleanName((await readJson(req)).name, 60);
    if (!name) throw new HttpError(400, "Donne un nom à la liste.");
    return renameList(id, name);
  });
}
