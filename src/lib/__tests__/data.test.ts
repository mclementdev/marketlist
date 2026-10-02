import { describe, expect, it } from "vitest";
import { INGREDIENTS, INGREDIENTS_BY_ID, RECIPES, TAG_LABELS, isCategoryId } from "../catalog";
import { UNITS } from "../types";

describe("données de recettes", () => {
  it("contient une vingtaine de recettes aux identifiants uniques", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(18);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  it("chaque ingredientId utilisé dans une recette existe dans le catalogue", () => {
    const missing = RECIPES.flatMap((r) =>
      r.ingredients
        .filter((i) => !INGREDIENTS_BY_ID.has(i.ingredientId))
        .map((i) => `${r.id} → ${i.ingredientId}`),
    );
    expect(missing).toEqual([]);
  });

  it("utilise uniquement des unités normalisées et des quantités positives", () => {
    for (const r of RECIPES) {
      expect(r.servings).toBeGreaterThan(0);
      expect(r.steps.length).toBeGreaterThan(0);
      for (const t of r.tags) expect(TAG_LABELS).toHaveProperty(t);
      const ids = r.ingredients.map((i) => i.ingredientId);
      expect(new Set(ids).size, `ingrédient en double dans ${r.id}`).toBe(ids.length);
      for (const i of r.ingredients) {
        expect(UNITS).toContain(i.unit);
        expect(i.quantity).toBeGreaterThan(0);
      }
    }
  });

  it("a un catalogue cohérent (ids uniques, rayons et unités valides)", () => {
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length);
    for (const i of INGREDIENTS) {
      expect(isCategoryId(i.category), `${i.id}: ${i.category}`).toBe(true);
      expect(UNITS).toContain(i.defaultUnit);
    }
  });
});
