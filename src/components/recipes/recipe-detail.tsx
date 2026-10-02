"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, Clock, Flame, Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveList } from "@/components/providers/active-list";
import { RecipeEmoji } from "@/components/recipes/recipe-card";
import { Button } from "@/components/ui/button";
import { INGREDIENTS_BY_ID, RECIPES_BY_ID, TAG_LABELS } from "@/lib/catalog";
import { formatDuration } from "@/lib/format";
import { formatQuantity, scaleIngredients } from "@/lib/shopping-list";

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 20;

export function RecipeDetail({ recipeId }: { recipeId: string }) {
  const recipe = RECIPES_BY_ID.get(recipeId);
  const router = useRouter();
  const { state, dispatch, list } = useActiveList();
  // null : l'utilisateur n'a pas touché au sélecteur.
  const [chosen, setChosen] = useState<number | null>(null);

  if (!recipe) return null;

  const added = state?.recipes.find((r) => r.recipeId === recipe.id);
  const servings = chosen ?? added?.servings ?? recipe.servings;
  const ingredients = scaleIngredients(recipe, servings);
  const ready = state !== null;

  const goToList = { label: "Voir la liste", onClick: () => router.push("/liste") };

  function add() {
    dispatch({ type: "addRecipe", recipeId: recipe!.id, servings });
    setChosen(null);
    toast.success(added ? "Portions mises à jour" : "Ajoutée à ta liste", {
      description: `${recipe!.title} · ${servings} pers.`,
      action: goToList,
    });
  }

  function remove() {
    dispatch({ type: "removeRecipe", recipeId: recipe!.id });
    setChosen(null);
    toast("Recette retirée", { description: "Ses ingrédients ont quitté la liste." });
  }

  return (
    <main className="pb-40">
      <div className="relative">
        <RecipeEmoji recipe={recipe} className="flex h-52 items-center justify-center text-7xl" />
        <Link
          href="/"
          aria-label="Retour aux recettes"
          className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 flex size-11 items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </div>

      <div className="px-4">
        <div className="relative -mt-6 rounded-2xl border bg-card p-4 shadow-sm">
          <h1 className="text-xl leading-tight font-semibold">{recipe.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" aria-hidden /> Préparation {formatDuration(recipe.prepTime)}
            </span>
            {recipe.cookTime > 0 && (
              <span className="inline-flex items-center gap-1">
                <Flame className="size-4" aria-hidden /> Cuisson {formatDuration(recipe.cookTime)}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recipe.tags.map((t) => (
              <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {TAG_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        </div>

        <section className="mt-6" aria-labelledby="ingredients-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="ingredients-title" className="text-lg font-semibold">
              Ingrédients
            </h2>
            <div className="flex items-center gap-1 rounded-full border bg-card p-1" role="group" aria-label="Nombre de portions">
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-full"
                aria-label="Une portion de moins"
                disabled={servings <= MIN_SERVINGS}
                onClick={() => setChosen(Math.max(MIN_SERVINGS, servings - 1))}
              >
                <Minus />
              </Button>
              <span className="min-w-16 text-center text-sm font-medium tabular-nums" aria-live="polite">
                {servings} pers.
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-full"
                aria-label="Une portion de plus"
                disabled={servings >= MAX_SERVINGS}
                onClick={() => setChosen(Math.min(MAX_SERVINGS, servings + 1))}
              >
                <Plus />
              </Button>
            </div>
          </div>
          <ul className="mt-3 divide-y rounded-2xl border bg-card">
            {ingredients.map((ing) => (
              <li key={ing.ingredientId} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <span>{INGREDIENTS_BY_ID.get(ing.ingredientId)?.name ?? ing.ingredientId}</span>
                <span className="shrink-0 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatQuantity(ing.quantity, ing.unit)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6" aria-labelledby="steps-title">
          <h2 id="steps-title" className="text-lg font-semibold">
            Préparation
          </h2>
          <ol className="mt-3 space-y-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {i + 1}
                </span>
                <p className="pt-0.5 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Barre d'action fixée au-dessus des onglets, à portée de pouce. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30">
        <div className="mx-auto max-w-[480px] border-t bg-background/95 px-4 py-3 backdrop-blur">
          {!added ? (
            <Button size="lg" className="w-full" disabled={!ready} onClick={add}>
              <ShoppingBasket />
              Ajouter à ma liste · {servings} pers.
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              {servings !== added.servings ? (
                <Button size="lg" className="w-full" onClick={add}>
                  Mettre à jour : {added.servings} → {servings} pers.
                </Button>
              ) : (
                <p className="flex items-center justify-center gap-1.5 py-1 text-sm font-medium text-primary">
                  <Check className="size-4" aria-hidden />
                  Dans « {list?.name ?? "ma liste"} » pour {added.servings} pers.
                </p>
              )}
              <Button size="lg" variant="outline" className="w-full" onClick={remove}>
                <Trash2 />
                Retirer de ma liste
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
