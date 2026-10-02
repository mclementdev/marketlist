"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChefHat, RefreshCw, ShoppingBasket } from "lucide-react";
import { LoadingBlock, PageHeader } from "@/components/app-shell";
import { FinishSheet } from "@/components/list/finish-sheet";
import { ItemRow } from "@/components/list/item-row";
import { ItemSheet } from "@/components/list/item-sheet";
import { QuickAdd } from "@/components/list/quick-add";
import { useActiveList } from "@/components/providers/active-list";
import { Button, buttonVariants } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/catalog";
import { formatNumber, groupByCategory } from "@/lib/shopping-list";
import type { ListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ShoppingListView() {
  const { state, status, list, realtime, userName, dispatch, refresh } = useActiveList();
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);

  const groups = useMemo(() => (state ? groupByCategory(state.items) : []), [state]);
  const total = state?.items.length ?? 0;
  const checked = state?.items.filter((i) => i.checked).length ?? 0;
  const menuItem = state?.items.find((i) => i.id === menuItemId) ?? null;

  const toggle = (item: ListItem) =>
    dispatch({ type: "toggleItem", id: item.id, checked: !item.checked });

  return (
    <main>
      <PageHeader
        title={list?.name ?? "Ma liste"}
        subtitle={<SyncBadge realtime={realtime} />}
        action={
          total > 0 ? (
            <Button variant="outline" onClick={() => setFinishOpen(true)} className="shrink-0">
              Terminer les courses
            </Button>
          ) : undefined
        }
      />

      <div className="sticky top-0 z-10 border-b bg-background/95 px-4 pt-1 pb-3 backdrop-blur">
        <QuickAdd />
        {total > 0 && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">
                {formatNumber(checked)} / {formatNumber(total)} dans le panier
              </span>
              {checked === total && <span className="text-primary">Tout y est !</span>}
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={checked}
              aria-label="Avancement des courses"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${(checked / total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {state === null ? (
        status === "error" ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="font-medium">Impossible de charger la liste.</p>
            <p className="text-sm text-muted-foreground">Vérifie ta connexion puis réessaie.</p>
            <Button variant="outline" onClick={() => void refresh()}>
              <RefreshCw /> Réessayer
            </Button>
          </div>
        ) : (
          <LoadingBlock label="Chargement de la liste…" />
        )
      ) : total === 0 ? (
        <EmptyList />
      ) : (
        <div className="space-y-5 px-4 pt-4 pb-6">
          {groups.map((g) => {
            const left = g.items.filter((i) => !i.checked).length;
            return (
              <section key={g.category} aria-labelledby={`cat-${g.category}`}>
                <h2
                  id={`cat-${g.category}`}
                  className="mb-2 flex items-baseline justify-between px-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {CATEGORY_LABELS[g.category]}
                  <span className="text-xs font-medium normal-case">
                    {left === 0 ? "✓ complet" : `${left} à prendre`}
                  </span>
                </h2>
                <ul className="divide-y overflow-hidden rounded-2xl border shadow-xs">
                  {g.items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      me={userName}
                      onToggle={toggle}
                      onMenu={(it) => setMenuItemId(it.id)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
          <p className="px-1 text-center text-xs text-muted-foreground">
            Touche un article pour le mettre dans le panier · appui long pour le modifier.
          </p>
        </div>
      )}

      <ItemSheet item={menuItem} onClose={() => setMenuItemId(null)} />
      <FinishSheet open={finishOpen} onOpenChange={setFinishOpen} checkedCount={checked} />
    </main>
  );
}

function SyncBadge({ realtime }: { realtime: "connecting" | "live" | "offline" }) {
  const label =
    realtime === "live"
      ? "Synchronisée en direct"
      : realtime === "connecting"
        ? "Connexion…"
        : "Synchronisation toutes les 5 s";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          realtime === "live" ? "bg-emerald-500" : realtime === "connecting" ? "bg-amber-400" : "bg-muted-foreground/50",
        )}
      />
      {label}
    </span>
  );
}

function EmptyList() {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-14 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <ShoppingBasket className="size-8" aria-hidden />
      </div>
      <p className="text-lg font-medium">Ta liste est vide</p>
      <p className="text-sm text-muted-foreground">
        Ajoute un article ci-dessus (« PQ », « liquide vaisselle »…) ou pioche dans les recettes : leurs
        ingrédients s’ajoutent tout seuls.
      </p>
      <Link href="/" className={cn(buttonVariants({ size: "lg" }), "mt-2")}>
        <ChefHat />
        Voir les recettes
      </Link>
    </div>
  );
}
