import Link from "next/link";
import { Check, Clock, Users } from "lucide-react";
import { formatDuration } from "@/lib/format";
import type { Recipe } from "@/lib/types";

export function RecipeEmoji({ recipe, className }: { recipe: Recipe; className?: string }) {
  return (
    <div
      className={className}
      style={{ backgroundColor: recipe.color }}
      aria-hidden
    >
      <span className="drop-shadow-sm">{recipe.emoji}</span>
    </div>
  );
}

export function RecipeCard({ recipe, addedServings }: { recipe: Recipe; addedServings?: number }) {
  return (
    <Link
      href={`/recettes/${recipe.id}`}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition active:scale-[0.98]"
    >
      <div className="relative">
        <RecipeEmoji
          recipe={recipe}
          className="flex aspect-[4/3] items-center justify-center text-5xl"
        />
        {addedServings !== undefined && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
            <Check className="size-3.5" aria-hidden />
            Dans la liste
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 leading-snug font-medium">{recipe.title}</h3>
        <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {formatDuration(recipe.prepTime + recipe.cookTime)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            {addedServings ?? recipe.servings} pers.
          </span>
        </div>
      </div>
    </Link>
  );
}
