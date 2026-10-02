import ingredientsData from "@/data/ingredients.json";
import recipesData from "@/data/recipes.json";
import { CATEGORY_IDS, type CategoryId, type Ingredient, type Recipe } from "./types";

export const INGREDIENTS = ingredientsData as Ingredient[];
export const RECIPES = recipesData as Recipe[];

export const INGREDIENTS_BY_ID: ReadonlyMap<string, Ingredient> = new Map(
  INGREDIENTS.map((i) => [i.id, i]),
);
export const RECIPES_BY_ID: ReadonlyMap<string, Recipe> = new Map(RECIPES.map((r) => [r.id, r]));

/** Rayons, dans l'ordre d'un parcours de magasin type. */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  "fruits-legumes": "Fruits & légumes",
  "boucherie-poissonnerie": "Boucherie & poissonnerie",
  "frais-cremerie": "Frais & crèmerie",
  "epicerie-salee": "Épicerie salée",
  "epicerie-sucree": "Épicerie sucrée",
  boissons: "Boissons",
  surgeles: "Surgelés",
  "hygiene-beaute": "Hygiène & beauté",
  entretien: "Entretien",
  autre: "Autre",
};

export const CATEGORY_ORDER: readonly CategoryId[] = CATEGORY_IDS;

export const TAG_LABELS: Record<string, string> = {
  rapide: "Rapide",
  vegetarien: "Végétarien",
  familial: "Familial",
  dessert: "Dessert",
};

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}
