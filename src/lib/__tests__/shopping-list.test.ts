import { describe, expect, it } from "vitest";
import { RECIPES_BY_ID } from "../catalog";
import {
  formatQuantity,
  groupByCategory,
  guessCategory,
  mergeItems,
  parseQuantityInput,
  recipeToDrafts,
  removeRecipe,
  scaleIngredients,
  type ItemDraft,
  type MergeContext,
} from "../shopping-list";
import type { ListItem, Recipe } from "../types";

function ctx(): MergeContext {
  let n = 0;
  return { now: "2026-01-01T00:00:00.000Z", createId: () => `id-${++n}` };
}

function recipe(id: string): Recipe {
  const r = RECIPES_BY_ID.get(id);
  if (!r) throw new Error(`recette inconnue : ${id}`);
  return r;
}

const flour = (quantity: number, unit: "g" | "kg", recipeId: string): ItemDraft => ({
  name: "Farine",
  ingredientId: "farine",
  quantity,
  unit,
  category: "epicerie-sucree",
  source: "recipe",
  recipeIds: [recipeId],
  addedBy: "Test",
});

describe("scaleIngredients", () => {
  it("divise les quantités par deux en passant de 4 à 2 portions", () => {
    const carbo = recipe("pates-carbonara");
    expect(carbo.servings).toBe(4);
    const scaled = scaleIngredients(carbo, 2);
    carbo.ingredients.forEach((ing, i) => {
      expect(scaled[i].ingredientId).toBe(ing.ingredientId);
      expect(scaled[i].unit).toBe(ing.unit);
      expect(scaled[i].quantity).toBeCloseTo(ing.quantity / 2);
    });
  });

  it("ne descend pas sous une demi-pièce", () => {
    const quiche = recipe("quiche-lorraine"); // 6 portions, 1 pâte
    const pate = scaleIngredients(quiche, 1).find((i) => i.ingredientId === "pate-brisee");
    expect(pate?.quantity).toBe(0.5);
  });
});

describe("mergeItems", () => {
  it("deux recettes partageant un ingrédient donnent une seule ligne avec la quantité totale", () => {
    const c = ctx();
    const carbo = recipe("pates-carbonara"); // 4 œufs
    const crepes = recipe("crepes"); // 4 œufs
    let items = mergeItems([], recipeToDrafts(carbo, 4, "A"), c);
    items = mergeItems(items, recipeToDrafts(crepes, 4, "B"), c);

    const eggs = items.filter((i) => i.ingredientId === "oeuf");
    expect(eggs).toHaveLength(1);
    expect(eggs[0].quantity).toBe(8);
    expect(eggs[0].recipeIds).toEqual(["pates-carbonara", "crepes"]);
  });

  it("200 g + 0,3 kg de farine donnent « 500 g »", () => {
    const items = mergeItems([], [flour(200, "g", "r1"), flour(0.3, "kg", "r2")], ctx());
    expect(items).toHaveLength(1);
    expect(formatQuantity(items[0].quantity, items[0].unit)).toBe("500 g");
  });

  it("additionne ml, cl et l", () => {
    const lait = (quantity: number, unit: "ml" | "cl" | "l"): ItemDraft => ({
      ...flour(0, "g", "r"),
      ingredientId: "lait",
      name: "Lait",
      quantity,
      unit,
    });
    const items = mergeItems([], [lait(50, "cl"), lait(200, "ml"), lait(1, "l")], ctx());
    expect(items).toHaveLength(1);
    expect(formatQuantity(items[0].quantity, items[0].unit)).toBe("1,7 l");
  });

  it("garde des lignes distinctes si les unités sont incompatibles", () => {
    const items = mergeItems(
      [],
      [flour(200, "g", "r1"), { ...flour(2, "g", "r2"), unit: "cas" }],
      ctx(),
    );
    expect(items).toHaveLength(2);
  });

  it("ne fusionne jamais un ajout manuel avec un article de recette", () => {
    const c = ctx();
    const manual: ItemDraft = { ...flour(1, "kg", "x"), source: "manual", recipeIds: [] };
    let items = mergeItems([], [manual], c);
    items = mergeItems(items, [flour(200, "g", "r1")], c);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.source === "manual")?.quantity).toBe(1);
  });

  it("décoche un article dont la quantité augmente", () => {
    const c = ctx();
    const [first] = mergeItems([], [flour(200, "g", "r1")], c);
    const checked: ListItem = { ...first, checked: true, checkedBy: "A", checkedAt: c.now };
    const [after] = mergeItems([checked], [flour(100, "g", "r2")], c);
    expect(after.quantity).toBe(300);
    expect(after.checked).toBe(false);
    expect(after.checkedBy).toBeNull();
  });
});

describe("removeRecipe", () => {
  it("ne supprime ni les ajouts manuels ni la part des autres recettes", () => {
    const c = ctx();
    const carbo = recipe("pates-carbonara");
    const crepes = recipe("crepes");
    let items = mergeItems([], recipeToDrafts(carbo, 4, "A"), c);
    items = mergeItems(items, recipeToDrafts(crepes, 4, "A"), c);
    items = mergeItems(
      items,
      [{ ...flour(1, "kg", "x"), name: "Farine bio", source: "manual", recipeIds: [] }],
      c,
    );

    const after = removeRecipe(items, crepes, 4);

    // Les œufs restent pour la carbonara.
    const eggs = after.find((i) => i.ingredientId === "oeuf");
    expect(eggs?.quantity).toBe(4);
    expect(eggs?.recipeIds).toEqual(["pates-carbonara"]);
    // L'ajout manuel est intact.
    expect(after.find((i) => i.source === "manual")?.quantity).toBe(1);
    // Les ingrédients propres aux crêpes ont disparu.
    expect(after.find((i) => i.ingredientId === "farine" && i.source === "recipe")).toBeUndefined();
    expect(after.find((i) => i.ingredientId === "sucre")).toBeUndefined();
    // Les ingrédients propres à la carbonara sont intacts.
    expect(after.find((i) => i.ingredientId === "spaghetti")?.quantity).toBe(400);
  });

  it("retire la bonne quantité même après conversion d'unités", () => {
    const c = ctx();
    let items = mergeItems([], [flour(200, "g", "r1")], c);
    items = mergeItems(items, recipeToDrafts(recipe("crepes"), 4, "A"), c); // 250 g
    expect(items[0].quantity).toBe(450);
    const after = removeRecipe(items, recipe("crepes"), 4);
    expect(after.find((i) => i.ingredientId === "farine")?.quantity).toBe(200);
  });

  it("utilise le nombre de portions avec lequel la recette a été ajoutée", () => {
    const c = ctx();
    let items = mergeItems([], recipeToDrafts(recipe("pates-carbonara"), 2, "A"), c); // 2 œufs
    items = mergeItems(items, recipeToDrafts(recipe("crepes"), 8, "A"), c); // 8 œufs
    const after = removeRecipe(items, recipe("crepes"), 8);
    expect(after.find((i) => i.ingredientId === "oeuf")?.quantity).toBe(2);
  });
});

describe("formatQuantity", () => {
  it.each([
    [1500, "g", "1,5 kg"],
    [500, "g", "500 g"],
    [0.25, "kg", "250 g"],
    [3, "piece", "3"],
    [1.5, "piece", "1,5"],
    [75, "cl", "75 cl"],
    [150, "cl", "1,5 l"],
    [1200, "ml", "1,2 l"],
    [2, "cas", "2 c. à s."],
    [1, "cac", "1 c. à c."],
    [1, "pincee", "1 pincée"],
    [3, "pincee", "3 pincées"],
  ] as const)("%s %s → %s", (q, u, expected) => {
    expect(formatQuantity(q, u)).toBe(expected);
  });

  it("renvoie une chaîne vide sans quantité", () => {
    expect(formatQuantity(null, null)).toBe("");
  });
});

describe("guessCategory", () => {
  it.each([
    ["PQ", "hygiene-beaute"],
    ["papier toilette", "hygiene-beaute"],
    ["Dentifrice", "hygiene-beaute"],
    ["éponge", "entretien"],
    ["Éponges", "entretien"],
    ["liquide vaisselle", "entretien"],
    ["Lait demi-écrémé", "frais-cremerie"],
    ["lait de coco", "epicerie-salee"],
    ["Tomates", "fruits-legumes"],
    ["Bananes bio", "fruits-legumes"],
    ["oeufs", "frais-cremerie"],
    ["Pâtes", "epicerie-salee"],
    ["Eau de javel", "entretien"],
    ["Bière", "boissons"],
    ["frites surgelées", "surgeles"],
    ["Chocolat au lait", "epicerie-sucree"],
    ["Cadeau anniversaire", "autre"],
    ["", "autre"],
  ] as const)("« %s » → %s", (name, expected) => {
    expect(guessCategory(name)).toBe(expected);
  });
});

describe("groupByCategory", () => {
  it("ordonne les rayons comme en magasin et place les articles cochés en bas", () => {
    const c = ctx();
    const items = mergeItems(
      [],
      [
        { ...flour(1, "kg", "x"), name: "Savon", category: "hygiene-beaute", source: "manual" },
        { ...flour(1, "kg", "x"), name: "Bananes", category: "fruits-legumes", source: "manual" },
        { ...flour(1, "kg", "x"), name: "Ail", category: "fruits-legumes", source: "manual" },
      ],
      c,
    ).map((i) => (i.name === "Ail" ? { ...i, checked: true, checkedAt: c.now } : i));

    const groups = groupByCategory(items);
    expect(groups.map((g) => g.category)).toEqual(["fruits-legumes", "hygiene-beaute"]);
    expect(groups[0].items.map((i) => i.name)).toEqual(["Bananes", "Ail"]);
  });
});

describe("parseQuantityInput", () => {
  it.each([
    ["2", { quantity: 2, unit: "piece" }],
    ["x3", { quantity: 3, unit: "piece" }],
    ["500 g", { quantity: 500, unit: "g" }],
    ["1,5 kg", { quantity: 1.5, unit: "kg" }],
    ["75cl", { quantity: 75, unit: "cl" }],
    ["2 litres", { quantity: 2, unit: "l" }],
    ["beaucoup", null],
    ["2 paquets", null],
    ["0", null],
  ] as const)("« %s »", (input, expected) => {
    expect(parseQuantityInput(input)).toEqual(expected);
  });
});
