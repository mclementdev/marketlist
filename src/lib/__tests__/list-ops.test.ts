import { describe, expect, it } from "vitest";
import { applyOp, diffState, parseOp, type ListOp, type ListState, type OpContext } from "../list-ops";
import { normalizeShareCode, generateShareCode, SHARE_CODE_ALPHABET } from "../share-code";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

function makeCtx(by = "Alice"): OpContext {
  let n = 0;
  return { now: new Date(2026, 0, 1, 12, n).toISOString(), by, createId: () => `gen-${++n}` };
}

function run(ops: ListOp[], ctx = makeCtx()): ListState {
  return ops.reduce<ListState>((s, op) => applyOp(s, op, ctx), { items: [], recipes: [] });
}

describe("applyOp", () => {
  it("ajouter puis retirer une recette conserve les ajouts manuels", () => {
    const state = run([
      { type: "addRecipe", recipeId: "crepes", servings: 4 },
      { type: "addItem", id: ID1, name: "PQ", quantity: null, unit: null, category: "hygiene-beaute" },
      { type: "removeRecipe", recipeId: "crepes" },
    ]);
    expect(state.recipes).toEqual([]);
    expect(state.items.map((i) => i.name)).toEqual(["PQ"]);
  });

  it("modifier les portions d'une recette recalcule les quantités", () => {
    const state = run([
      { type: "addRecipe", recipeId: "pates-carbonara", servings: 4 },
      { type: "addRecipe", recipeId: "pates-carbonara", servings: 2 },
    ]);
    expect(state.recipes).toEqual([{ recipeId: "pates-carbonara", servings: 2, addedBy: "Alice" }]);
    expect(state.items.find((i) => i.ingredientId === "spaghetti")?.quantity).toBe(200);
  });

  it("cocher enregistre qui a coché, décocher l'efface", () => {
    const add: ListOp = { type: "addItem", id: ID1, name: "Pain", quantity: 1, unit: "piece", category: "epicerie-salee" };
    const checked = run([add, { type: "toggleItem", id: ID1, checked: true }], makeCtx("Bob"));
    expect(checked.items[0]).toMatchObject({ checked: true, checkedBy: "Bob" });
    const unchecked = applyOp(checked, { type: "toggleItem", id: ID1, checked: false }, makeCtx());
    expect(unchecked.items[0]).toMatchObject({ checked: false, checkedBy: null, checkedAt: null });
  });

  it("« retirer les articles cochés » retire aussi les recettes devenues vides", () => {
    let state = run([
      { type: "addRecipe", recipeId: "mousse-chocolat", servings: 6 },
      { type: "addItem", id: ID1, name: "PQ", quantity: null, unit: null, category: "hygiene-beaute" },
    ]);
    const ctx = makeCtx();
    for (const it of state.items.filter((i) => i.source === "recipe")) {
      state = applyOp(state, { type: "toggleItem", id: it.id, checked: true }, ctx);
    }
    state = applyOp(state, { type: "clearChecked" }, ctx);
    expect(state.items.map((i) => i.name)).toEqual(["PQ"]);
    expect(state.recipes).toEqual([]);
  });
});

describe("diffState", () => {
  it("ne renvoie que les lignes modifiées", () => {
    const before = run([
      { type: "addItem", id: ID1, name: "Pain", quantity: null, unit: null, category: "epicerie-salee" },
      { type: "addItem", id: ID2, name: "Lait", quantity: null, unit: null, category: "frais-cremerie" },
    ]);
    const after = applyOp(before, { type: "deleteItem", id: ID2 }, makeCtx());
    const diff = diffState(before, applyOp(after, { type: "toggleItem", id: ID1, checked: true }, makeCtx()));
    expect(diff.upsertItems.map((i) => i.id)).toEqual([ID1]);
    expect(diff.deleteItemIds).toEqual([ID2]);
  });
});

describe("parseOp", () => {
  it("accepte une opération valide et nettoie le nom", () => {
    expect(
      parseOp({ type: "addItem", id: ID1, name: "  PQ  ", quantity: 2, unit: "piece", category: "hygiene-beaute" }),
    ).toEqual({ type: "addItem", id: ID1, name: "PQ", quantity: 2, unit: "piece", category: "hygiene-beaute" });
  });

  it.each([
    [null],
    [{ type: "nope" }],
    [{ type: "addRecipe", recipeId: "inconnue", servings: 4 }],
    [{ type: "addRecipe", recipeId: "crepes", servings: 0 }],
    [{ type: "addItem", id: "pas-un-uuid", name: "x", quantity: null, unit: null, category: "autre" }],
    [{ type: "addItem", id: ID1, name: "x", quantity: -1, unit: null, category: "autre" }],
    [{ type: "addItem", id: ID1, name: "x", quantity: null, unit: null, category: "rayon" }],
    [{ type: "toggleItem", id: ID1, checked: "oui" }],
  ])("rejette %j", (input) => {
    expect(parseOp(input)).toBeNull();
  });
});

describe("share code", () => {
  it("génère 6 caractères sans ambiguïté", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateShareCode();
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
      expect(code).not.toMatch(/[O0I1L]/);
      for (const c of code) expect(SHARE_CODE_ALPHABET).toContain(c);
    }
  });

  it("normalise la saisie et rejette les codes invalides", () => {
    expect(normalizeShareCode(" abc-23k ")).toBe("ABC23K");
    expect(normalizeShareCode("ABC12K")).toBeNull(); // « 1 » est exclu
    expect(normalizeShareCode("ABC")).toBeNull();
  });
});
