"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { useActiveList } from "@/components/providers/active-list";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { Input } from "@/components/ui/input";
import { RECIPES, TAG_LABELS } from "@/lib/catalog";
import { searchKey } from "@/lib/format";
import { cn } from "@/lib/utils";

const TAGS = Object.keys(TAG_LABELS);

export function RecipeBrowser() {
  const { state, list } = useActiveList();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const added = useMemo(
    () => new Map(state?.recipes.map((r) => [r.recipeId, r.servings]) ?? []),
    [state],
  );

  const recipes = useMemo(() => {
    const q = searchKey(query.trim());
    return RECIPES.filter(
      (r) => (!tag || r.tags.includes(tag)) && (!q || searchKey(r.title).includes(q)),
    );
  }, [query, tag]);

  return (
    <main>
      <PageHeader
        title="Recettes"
        subtitle={
          added.size > 0
            ? `${added.size} recette${added.size > 1 ? "s" : ""} dans « ${list?.name ?? "ma liste"} »`
            : "Ajoute des recettes, les ingrédients rejoignent ta liste."
        }
      />

      <div className="sticky top-0 z-10 space-y-3 bg-background/95 px-4 pt-1 pb-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            inputMode="search"
            placeholder="Rechercher une recette"
            aria-label="Rechercher une recette"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center text-muted-foreground"
              aria-label="Effacer la recherche"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="Filtrer par type">
          {[null, ...TAGS].map((t) => {
            const active = tag === t;
            return (
              <button
                key={t ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setTag(t)}
                className={cn(
                  "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-foreground hover:bg-muted",
                )}
              >
                {t ? TAG_LABELS[t] : "Toutes"}
              </button>
            );
          })}
        </div>
      </div>

      {recipes.length === 0 ? (
        <div className="px-6 py-16 text-center text-muted-foreground">
          <p className="text-4xl" aria-hidden>🔍</p>
          <p className="mt-3 font-medium text-foreground">Aucune recette trouvée</p>
          <p className="mt-1 text-sm">Essaie un autre mot ou retire le filtre.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 px-4 pb-6">
          {recipes.map((r) => (
            <li key={r.id} className="flex">
              <RecipeCard recipe={r} addedServings={added.get(r.id)} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
