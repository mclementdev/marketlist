import { CATEGORY_ORDER, INGREDIENTS, INGREDIENTS_BY_ID } from "./catalog";
import type { CategoryId, ListItem, Recipe, RecipeIngredient, Unit } from "./types";

/* ------------------------------------------------------------------ */
/* Unités                                                              */
/* ------------------------------------------------------------------ */

type Dimension = "mass" | "volume";

const CONVERTIBLE: Partial<Record<Unit, { dimension: Dimension; factor: number }>> = {
  g: { dimension: "mass", factor: 1 },
  kg: { dimension: "mass", factor: 1000 },
  ml: { dimension: "volume", factor: 1 },
  cl: { dimension: "volume", factor: 10 },
  l: { dimension: "volume", factor: 1000 },
};

const BASE_UNIT: Record<Dimension, Unit> = { mass: "g", volume: "ml" };

/** Arrondi pour éviter les artefacts flottants (0,1 + 0,2…). */
function round(n: number, decimals = 3): number {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

/** Deux unités sont compatibles si elles sont identiques ou convertibles (g ↔ kg, ml ↔ cl ↔ l). */
export function unitsCompatible(a: Unit | null, b: Unit | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ca = CONVERTIBLE[a];
  const cb = CONVERTIBLE[b];
  return !!ca && !!cb && ca.dimension === cb.dimension;
}

/**
 * Additionne deux quantités d'unités compatibles. Même unité : on la garde ;
 * unités différentes : on passe dans l'unité de base (g ou ml).
 */
export function addQuantities(
  qa: number,
  ua: Unit | null,
  qb: number,
  ub: Unit | null,
): { quantity: number; unit: Unit | null } | null {
  if (ua === ub) return { quantity: round(qa + qb), unit: ua };
  const ca = ua ? CONVERTIBLE[ua] : undefined;
  const cb = ub ? CONVERTIBLE[ub] : undefined;
  if (!ca || !cb || ca.dimension !== cb.dimension) return null;
  return { quantity: round(qa * ca.factor + qb * cb.factor), unit: BASE_UNIT[ca.dimension] };
}

/** Exprime `q` (en unité `from`) dans l'unité `to`, si elles sont compatibles. */
function convert(q: number, from: Unit | null, to: Unit | null): number | null {
  if (from === to) return q;
  const cf = from ? CONVERTIBLE[from] : undefined;
  const ct = to ? CONVERTIBLE[to] : undefined;
  if (!cf || !ct || cf.dimension !== ct.dimension) return null;
  return (q * cf.factor) / ct.factor;
}

/* ------------------------------------------------------------------ */
/* Portions                                                            */
/* ------------------------------------------------------------------ */

function roundScaled(q: number, unit: Unit): number {
  switch (unit) {
    case "g":
    case "ml":
      return Math.max(1, Math.round(q));
    case "piece":
    case "cas":
    case "cac":
    case "pincee":
      // Pas de demi-pincée de moins de 0,5 : on arrondit au demi supérieur.
      return Math.max(0.5, Math.ceil(round(q * 2, 6)) / 2);
    default:
      return round(q, 2);
  }
}

/** Recalcule les quantités d'une recette pour `servings` portions. */
export function scaleIngredients(recipe: Recipe, servings: number): RecipeIngredient[] {
  const factor = servings / recipe.servings;
  return recipe.ingredients.map((ing) => ({
    ...ing,
    quantity: factor === 1 ? ing.quantity : roundScaled(ing.quantity * factor, ing.unit),
  }));
}

/* ------------------------------------------------------------------ */
/* Fusion et retrait                                                   */
/* ------------------------------------------------------------------ */

export type ItemDraft = Pick<
  ListItem,
  "name" | "ingredientId" | "quantity" | "unit" | "category" | "source" | "recipeIds" | "addedBy"
>;

export interface MergeContext {
  now: string;
  createId: () => string;
}

/** Transforme une recette en brouillons d'articles pour `servings` portions. */
export function recipeToDrafts(recipe: Recipe, servings: number, addedBy: string | null): ItemDraft[] {
  return scaleIngredients(recipe, servings).map((ing) => {
    const ingredient = INGREDIENTS_BY_ID.get(ing.ingredientId);
    return {
      name: ingredient?.name ?? ing.ingredientId,
      ingredientId: ing.ingredientId,
      quantity: ing.quantity,
      unit: ing.unit,
      category: ingredient?.category ?? "autre",
      source: "recipe",
      recipeIds: [recipe.id],
      addedBy,
    };
  });
}

/**
 * Fusionne de nouveaux articles dans une liste existante.
 * - Les articles issus de recettes ayant le même `ingredientId` et des unités
 *   compatibles sont regroupés et leurs quantités additionnées.
 * - Les articles manuels ne sont jamais fusionnés.
 * - Un article coché dont la quantité augmente repasse en non coché.
 */
export function mergeItems(
  existingItems: readonly ListItem[],
  newItems: readonly ItemDraft[],
  ctx: MergeContext,
): ListItem[] {
  const result = existingItems.slice();

  for (const draft of newItems) {
    const idx =
      draft.source === "recipe" && draft.ingredientId
        ? result.findIndex(
            (it) =>
              it.source === "recipe" &&
              it.ingredientId === draft.ingredientId &&
              unitsCompatible(it.unit, draft.unit),
          )
        : -1;

    if (idx === -1) {
      result.push({
        ...draft,
        recipeIds: [...draft.recipeIds],
        id: ctx.createId(),
        checked: false,
        checkedBy: null,
        checkedAt: null,
        updatedAt: ctx.now,
      });
      continue;
    }

    const current = result[idx];
    let quantity = current.quantity;
    let unit = current.unit;
    let increased = false;
    if (draft.quantity !== null && draft.quantity > 0) {
      increased = true;
      if (current.quantity === null) {
        quantity = draft.quantity;
        unit = draft.unit;
      } else {
        const sum = addQuantities(current.quantity, current.unit, draft.quantity, draft.unit);
        if (sum) ({ quantity, unit } = sum);
      }
    }

    result[idx] = {
      ...current,
      quantity,
      unit,
      recipeIds: Array.from(new Set([...current.recipeIds, ...draft.recipeIds])),
      ...(increased && current.checked
        ? { checked: false, checkedBy: null, checkedAt: null }
        : null),
      updatedAt: ctx.now,
    };
  }

  return result;
}

/**
 * Retire la contribution d'une recette : décrémente les quantités qu'elle a
 * apportées et supprime les lignes qui ne servaient qu'à elle. Les ajouts
 * manuels et la part des autres recettes ne sont pas touchés.
 */
export function removeRecipe(
  items: readonly ListItem[],
  recipe: Recipe,
  servings: number,
  now: string = new Date().toISOString(),
): ListItem[] {
  const scaled = scaleIngredients(recipe, servings);
  const result: ListItem[] = [];

  for (const item of items) {
    if (item.source !== "recipe" || !item.recipeIds.includes(recipe.id)) {
      result.push(item);
      continue;
    }
    const recipeIds = item.recipeIds.filter((id) => id !== recipe.id);
    if (recipeIds.length === 0) continue; // la ligne n'existait que pour cette recette

    let quantity = item.quantity;
    const contribution = scaled.find(
      (ing) => ing.ingredientId === item.ingredientId && unitsCompatible(item.unit, ing.unit),
    );
    if (contribution && quantity !== null) {
      const delta = convert(contribution.quantity, contribution.unit, item.unit);
      if (delta !== null) {
        const remaining = round(quantity - delta);
        quantity = remaining > 0 ? remaining : null;
      }
    }
    result.push({ ...item, quantity, recipeIds, updatedAt: now });
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Affichage                                                           */
/* ------------------------------------------------------------------ */

const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** Affichage lisible d'une quantité : 1500 g → « 1,5 kg », 3 piece → « 3 ». */
export function formatQuantity(quantity: number | null, unit: Unit | null): string {
  if (quantity === null) return "";
  const n = formatNumber;
  switch (unit) {
    case null:
    case "piece":
      return n(quantity);
    case "g":
      return quantity >= 1000 ? `${n(quantity / 1000)} kg` : `${n(quantity)} g`;
    case "kg":
      return quantity < 1 ? `${n(quantity * 1000)} g` : `${n(quantity)} kg`;
    case "ml":
      return quantity >= 1000 ? `${n(quantity / 1000)} l` : `${n(quantity)} ml`;
    case "cl":
      return quantity >= 100 ? `${n(quantity / 100)} l` : `${n(quantity)} cl`;
    case "l":
      return quantity < 1 ? `${n(quantity * 100)} cl` : `${n(quantity)} l`;
    case "cas":
      return `${n(quantity)} c. à s.`;
    case "cac":
      return `${n(quantity)} c. à c.`;
    case "pincee":
      return `${n(quantity)} ${quantity > 1 ? "pincées" : "pincée"}`;
  }
}

export const UNIT_LABELS: Record<Unit, string> = {
  piece: "pièce(s)",
  g: "g",
  kg: "kg",
  ml: "ml",
  cl: "cl",
  l: "l",
  cas: "c. à soupe",
  cac: "c. à café",
  pincee: "pincée(s)",
};

/* ------------------------------------------------------------------ */
/* Catégorisation des ajouts manuels                                   */
/* ------------------------------------------------------------------ */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w))
    .join(" ");
}

const KEYWORDS: Record<Exclude<CategoryId, "autre">, string[]> = {
  "hygiene-beaute": [
    "pq", "papier toilette", "papier wc", "mouchoir", "coton", "coton tige", "savon", "gel douche",
    "shampoing", "shampooing", "apres shampoing", "dentifrice", "brosse a dent", "fil dentaire",
    "bain de bouche", "deodorant", "deo", "rasoir", "mousse a raser", "creme hydratante",
    "creme solaire", "lait corporel", "serviette hygienique", "tampon", "protege slip", "couche",
    "lingette", "maquillage", "demaquillant", "parfum", "vernis",
  ],
  entretien: [
    "eponge", "liquide vaisselle", "produit vaisselle", "pastille lave vaisselle",
    "tablette lave vaisselle", "lave vaisselle", "lessive", "adoucissant", "javel", "eau de javel",
    "sac poubelle", "sopalin", "essuie tout", "nettoyant", "desinfectant", "vinaigre blanc",
    "serpilliere", "film alimentaire", "papier aluminium", "papier alu", "papier cuisson",
    "allumette", "detartrant", "wc net",
  ],
  boissons: [
    "eau gazeuse", "eau minerale", "eau petillante", "jus", "soda", "coca", "limonade", "sirop",
    "biere", "vin", "champagne", "cidre", "ice tea",
  ],
  surgeles: [
    "surgele", "glace", "frite", "poisson pane", "glacon", "pizza surgelee", "creme glacee",
  ],
  "frais-cremerie": [
    "yaourt", "yogourt", "fromage", "beurre", "creme", "lait", "oeuf", "jambon", "comte",
    "camembert", "chevre", "skyr", "fromage blanc", "petit suisse", "raclette", "gruyere",
    "dessert lacte", "pate a pizza",
  ],
  "fruits-legumes": [
    "pomme", "poire", "banane", "fraise", "framboise", "raisin", "kiwi", "citron", "orange",
    "clementine", "mandarine", "mangue", "ananas", "melon", "pasteque", "peche", "abricot", "cerise",
    "salade", "tomate", "carotte", "courgette", "oignon", "echalote", "ail", "poireau", "brocoli",
    "chou", "chou fleur", "haricot vert", "epinard", "radis", "concombre", "champignon", "fruit",
    "legume", "patate", "navet", "betterave", "herbe fraiche",
  ],
  "boucherie-poissonnerie": [
    "poulet", "boeuf", "porc", "veau", "agneau", "dinde", "canard", "steak", "saucisse", "merguez",
    "saumon", "crevette", "cabillaud", "poisson", "viande", "escalope", "cote", "roti", "filet",
    "lardon", "chipolata",
  ],
  "epicerie-salee": [
    "pate", "riz", "semoule", "lentille", "conserve", "sauce", "ketchup", "mayonnaise", "huile",
    "vinaigre", "sel", "poivre", "epice", "chip", "cracker", "thon", "soupe", "bouillon", "pain",
    "biscotte", "olive", "cornichon", "moutarde",
  ],
  "epicerie-sucree": [
    "sucre", "chocolat", "biscuit", "gateau", "cereale", "confiture", "nutella", "pate a tartiner",
    "miel", "cafe", "the", "tisane", "compote", "bonbon", "farine", "levure", "madeleine",
  ],
};

const KEYWORD_INDEX: { kw: string; category: CategoryId }[] = Object.entries(KEYWORDS)
  .flatMap(([category, kws]) =>
    kws.map((kw) => ({ kw: normalize(kw), category: category as CategoryId })),
  )
  .sort((a, b) => b.kw.length - a.kw.length);

const CATALOG_INDEX: { name: string; category: CategoryId }[] = INGREDIENTS.map((i) => ({
  name: normalize(i.name.replace(/\(.*\)/, "")),
  category: i.category,
})).sort((a, b) => b.name.length - a.name.length);

function containsWords(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

/**
 * Devine le rayon d'un article saisi à la main : correspondance exacte avec le
 * catalogue, puis table de mots-clés, puis nom du catalogue contenu dans la
 * saisie, sinon « Autre ».
 */
export function guessCategory(name: string): CategoryId {
  const q = normalize(name);
  if (!q) return "autre";
  const exact = CATALOG_INDEX.find((c) => c.name === q);
  if (exact) return exact.category;
  const keyword = KEYWORD_INDEX.find((k) => containsWords(q, k.kw));
  if (keyword) return keyword.category;
  const partial = CATALOG_INDEX.find((c) => containsWords(q, c.name));
  if (partial) return partial.category;
  return "autre";
}

/* ------------------------------------------------------------------ */
/* Regroupement par rayon                                              */
/* ------------------------------------------------------------------ */

export interface CategoryGroup {
  category: CategoryId;
  items: ListItem[];
}

/**
 * Regroupe par rayon dans l'ordre du magasin. Dans chaque rayon : les articles
 * à prendre d'abord (ordre alphabétique), puis ceux déjà dans le panier.
 */
export function groupByCategory(items: readonly ListItem[]): CategoryGroup[] {
  const byCat = new Map<CategoryId, ListItem[]>();
  for (const it of items) {
    const list = byCat.get(it.category) ?? [];
    list.push(it);
    byCat.set(it.category, list);
  }
  return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((category) => ({
    category,
    items: (byCat.get(category) ?? []).sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      if (a.checked && b.checked) return (a.checkedAt ?? "").localeCompare(b.checkedAt ?? "");
      return a.name.localeCompare(b.name, "fr");
    }),
  }));
}

/* ------------------------------------------------------------------ */
/* Saisie libre d'une quantité (ajout rapide)                          */
/* ------------------------------------------------------------------ */

const UNIT_ALIASES: Record<string, Unit> = {
  g: "g", gr: "g", gramme: "g", grammes: "g",
  kg: "kg", kilo: "kg", kilos: "kg",
  ml: "ml", cl: "cl", l: "l", litre: "l", litres: "l",
  x: "piece", pc: "piece", pce: "piece", piece: "piece", pieces: "piece",
};

/**
 * Interprète une quantité saisie librement : « 2 », « x3 », « 500 g », « 1,5 kg ».
 * Renvoie `null` si la saisie n'est pas reconnue.
 */
export function parseQuantityInput(input: string): { quantity: number; unit: Unit } | null {
  const s = input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const m = /^(?:x\s*)?(\d+(?:[.,]\d+)?)\s*([a-z]*)\.?$/.exec(s);
  if (!m) return null;
  const quantity = Number(m[1].replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) return null;
  const unit = m[2] ? UNIT_ALIASES[m[2]] : "piece";
  return unit ? { quantity, unit } : null;
}
