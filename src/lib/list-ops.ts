import { RECIPES_BY_ID, isCategoryId } from "./catalog";
import { mergeItems, recipeToDrafts, removeRecipe } from "./shopping-list";
import { UNITS, type CategoryId, type ListItem, type ListRecipe, type Unit } from "./types";

/**
 * Opérations sur une liste. Le même réducteur `applyOp` sert côté client (mise à
 * jour optimiste) et côté serveur (calcul de l'état à enregistrer).
 */
export type ListOp =
  | { type: "addRecipe"; recipeId: string; servings: number }
  | { type: "removeRecipe"; recipeId: string }
  | { type: "addItem"; id: string; name: string; quantity: number | null; unit: Unit | null; category: CategoryId }
  | { type: "updateItem"; id: string; name: string; quantity: number | null; unit: Unit | null; category: CategoryId }
  | { type: "toggleItem"; id: string; checked: boolean }
  | { type: "deleteItem"; id: string }
  | { type: "clearChecked" }
  | { type: "clearAll" };

export interface ListState {
  items: ListItem[];
  recipes: ListRecipe[];
}

export interface OpContext {
  now: string;
  /** Prénom de la personne qui agit. */
  by: string;
  createId: () => string;
}

export function applyOp(state: ListState, op: ListOp, ctx: OpContext): ListState {
  switch (op.type) {
    case "addRecipe": {
      const recipe = RECIPES_BY_ID.get(op.recipeId);
      if (!recipe) return state;
      const existing = state.recipes.find((r) => r.recipeId === op.recipeId);
      if (existing?.servings === op.servings) return state;
      // Ajouter une recette déjà présente revient à modifier ses portions.
      const base = existing
        ? removeRecipe(state.items, recipe, existing.servings, ctx.now)
        : state.items;
      const items = mergeItems(base, recipeToDrafts(recipe, op.servings, ctx.by), ctx);
      const entry: ListRecipe = {
        recipeId: op.recipeId,
        servings: op.servings,
        addedBy: existing?.addedBy ?? ctx.by,
      };
      const recipes = existing
        ? state.recipes.map((r) => (r.recipeId === op.recipeId ? entry : r))
        : [...state.recipes, entry];
      return { items, recipes };
    }
    case "removeRecipe": {
      const recipe = RECIPES_BY_ID.get(op.recipeId);
      const existing = state.recipes.find((r) => r.recipeId === op.recipeId);
      if (!recipe || !existing) return state;
      return {
        items: removeRecipe(state.items, recipe, existing.servings, ctx.now),
        recipes: state.recipes.filter((r) => r.recipeId !== op.recipeId),
      };
    }
    case "addItem": {
      if (state.items.some((i) => i.id === op.id)) return state;
      const item: ListItem = {
        id: op.id,
        name: op.name,
        ingredientId: null,
        quantity: op.quantity,
        unit: op.quantity === null ? null : op.unit,
        category: op.category,
        source: "manual",
        recipeIds: [],
        checked: false,
        checkedBy: null,
        checkedAt: null,
        addedBy: ctx.by,
        updatedAt: ctx.now,
      };
      return { ...state, items: [...state.items, item] };
    }
    case "updateItem":
      return mapItem(state, op.id, (it) => ({
        ...it,
        name: op.name,
        quantity: op.quantity,
        unit: op.quantity === null ? null : op.unit,
        category: op.category,
        updatedAt: ctx.now,
      }));
    case "toggleItem":
      return mapItem(state, op.id, (it) =>
        it.checked === op.checked
          ? it
          : {
              ...it,
              checked: op.checked,
              checkedBy: op.checked ? ctx.by : null,
              checkedAt: op.checked ? ctx.now : null,
              updatedAt: ctx.now,
            },
      );
    case "deleteItem":
      return { ...state, items: state.items.filter((i) => i.id !== op.id) };
    case "clearChecked": {
      const items = state.items.filter((i) => !i.checked);
      // Les recettes dont plus aucun ingrédient n'est sur la liste sont retirées.
      const recipes = state.recipes.filter((r) => items.some((i) => i.recipeIds.includes(r.recipeId)));
      return { items, recipes };
    }
    case "clearAll":
      return { items: [], recipes: [] };
  }
}

function mapItem(state: ListState, id: string, fn: (it: ListItem) => ListItem): ListState {
  let changed = false;
  const items = state.items.map((it) => {
    if (it.id !== id) return it;
    const next = fn(it);
    if (next !== it) changed = true;
    return next;
  });
  return changed ? { ...state, items } : state;
}

/* ------------------------------------------------------------------ */
/* Différentiel entre deux états (pour n'écrire que ce qui change)     */
/* ------------------------------------------------------------------ */

export interface StateDiff {
  upsertItems: ListItem[];
  deleteItemIds: string[];
  upsertRecipes: ListRecipe[];
  deleteRecipeIds: string[];
}

function sameItem(a: ListItem, b: ListItem): boolean {
  return (
    a.name === b.name &&
    a.ingredientId === b.ingredientId &&
    a.quantity === b.quantity &&
    a.unit === b.unit &&
    a.category === b.category &&
    a.source === b.source &&
    a.checked === b.checked &&
    a.checkedBy === b.checkedBy &&
    a.checkedAt === b.checkedAt &&
    a.addedBy === b.addedBy &&
    a.recipeIds.length === b.recipeIds.length &&
    a.recipeIds.every((r, i) => r === b.recipeIds[i])
  );
}

export function diffState(before: ListState, after: ListState): StateDiff {
  const beforeItems = new Map(before.items.map((i) => [i.id, i]));
  const afterItemIds = new Set(after.items.map((i) => i.id));
  const beforeRecipes = new Map(before.recipes.map((r) => [r.recipeId, r]));
  const afterRecipeIds = new Set(after.recipes.map((r) => r.recipeId));

  return {
    upsertItems: after.items.filter((i) => {
      const prev = beforeItems.get(i.id);
      return !prev || !sameItem(prev, i);
    }),
    deleteItemIds: before.items.filter((i) => !afterItemIds.has(i.id)).map((i) => i.id),
    upsertRecipes: after.recipes.filter((r) => {
      const prev = beforeRecipes.get(r.recipeId);
      return !prev || prev.servings !== r.servings || prev.addedBy !== r.addedBy;
    }),
    deleteRecipeIds: before.recipes
      .filter((r) => !afterRecipeIds.has(r.recipeId))
      .map((r) => r.recipeId),
  };
}

export function isEmptyDiff(d: StateDiff): boolean {
  return (
    d.upsertItems.length === 0 &&
    d.deleteItemIds.length === 0 &&
    d.upsertRecipes.length === 0 &&
    d.deleteRecipeIds.length === 0
  );
}

/* ------------------------------------------------------------------ */
/* Validation des entrées (côté serveur, données non fiables)          */
/* ------------------------------------------------------------------ */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function cleanName(v: unknown, max = 80): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim().slice(0, max);
  return s.length > 0 ? s : null;
}

function cleanQuantity(v: unknown): number | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 100000) return undefined;
  return Math.round(v * 1000) / 1000;
}

function cleanUnit(v: unknown): Unit | null | undefined {
  if (v === null || v === undefined) return null;
  return typeof v === "string" && (UNITS as readonly string[]).includes(v) ? (v as Unit) : undefined;
}

function cleanServings(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 50 ? v : null;
}

/** Valide une opération reçue du client. Renvoie `null` si elle est invalide. */
export function parseOp(input: unknown): ListOp | null {
  if (typeof input !== "object" || input === null) return null;
  const o = input as Record<string, unknown>;
  switch (o.type) {
    case "addRecipe": {
      const servings = cleanServings(o.servings);
      if (typeof o.recipeId !== "string" || !RECIPES_BY_ID.has(o.recipeId) || servings === null)
        return null;
      return { type: "addRecipe", recipeId: o.recipeId, servings };
    }
    case "removeRecipe":
      if (typeof o.recipeId !== "string" || !RECIPES_BY_ID.has(o.recipeId)) return null;
      return { type: "removeRecipe", recipeId: o.recipeId };
    case "addItem":
    case "updateItem": {
      const name = cleanName(o.name);
      const quantity = cleanQuantity(o.quantity);
      const unit = cleanUnit(o.unit);
      if (!isUuid(o.id) || !name || quantity === undefined || unit === undefined) return null;
      if (!isCategoryId(o.category)) return null;
      return { type: o.type, id: o.id.toLowerCase(), name, quantity, unit, category: o.category };
    }
    case "toggleItem":
      if (!isUuid(o.id) || typeof o.checked !== "boolean") return null;
      return { type: "toggleItem", id: o.id.toLowerCase(), checked: o.checked };
    case "deleteItem":
      if (!isUuid(o.id)) return null;
      return { type: "deleteItem", id: o.id.toLowerCase() };
    case "clearChecked":
    case "clearAll":
      return { type: o.type };
    default:
      return null;
  }
}
