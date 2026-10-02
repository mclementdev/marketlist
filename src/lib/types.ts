export const CATEGORY_IDS = [
  "fruits-legumes",
  "boucherie-poissonnerie",
  "frais-cremerie",
  "epicerie-salee",
  "epicerie-sucree",
  "boissons",
  "surgeles",
  "hygiene-beaute",
  "entretien",
  "autre",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const UNITS = ["g", "kg", "ml", "cl", "l", "piece", "cas", "cac", "pincee"] as const;
export type Unit = (typeof UNITS)[number];

export interface Ingredient {
  id: string;
  name: string;
  category: CategoryId;
  defaultUnit: Unit;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: Unit;
}

export interface Recipe {
  id: string;
  title: string;
  servings: number;
  prepTime: number;
  cookTime: number;
  tags: string[];
  emoji: string;
  color: string;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export type ItemSource = "recipe" | "manual";

export interface ListItem {
  id: string;
  name: string;
  ingredientId: string | null;
  quantity: number | null;
  unit: Unit | null;
  category: CategoryId;
  source: ItemSource;
  recipeIds: string[];
  checked: boolean;
  checkedBy: string | null;
  checkedAt: string | null;
  addedBy: string | null;
  updatedAt: string;
}

export interface ListRecipe {
  recipeId: string;
  servings: number;
  addedBy: string | null;
}

export interface ListInfo {
  id: string;
  name: string;
  shareCode: string;
}

/** État complet d'une liste à une version donnée. */
export interface ListSnapshot {
  list: ListInfo;
  version: number;
  items: ListItem[];
  recipes: ListRecipe[];
}
