import { cleanName } from "@/lib/list-ops";
import { handle, readJson } from "@/server/http";
import { createList, HttpError } from "@/server/lists";

/** Crée une liste. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const name = cleanName(body.name, 60);
    if (!name) throw new HttpError(400, "Donne un nom à la liste.");
    return createList(name);
  }, 201);
}
