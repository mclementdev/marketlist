import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecipeDetail } from "@/components/recipes/recipe-detail";
import { RECIPES, RECIPES_BY_ID } from "@/lib/catalog";

export function generateStaticParams() {
  return RECIPES.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: PageProps<"/recettes/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `${RECIPES_BY_ID.get(id)?.title ?? "Recette"} · Panier` };
}

export default async function RecipePage({ params }: PageProps<"/recettes/[id]">) {
  const { id } = await params;
  if (!RECIPES_BY_ID.has(id)) notFound();
  return <RecipeDetail recipeId={id} />;
}
