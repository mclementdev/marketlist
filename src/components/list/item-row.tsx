"use client";

import { useRef } from "react";
import { EllipsisVertical, ShoppingCart } from "lucide-react";
import { RECIPES_BY_ID } from "@/lib/catalog";
import { formatQuantity } from "@/lib/shopping-list";
import type { ListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 500;

function origin(item: ListItem, me: string): string | null {
  if (item.source === "recipe" && item.recipeIds.length > 0) {
    const titles = item.recipeIds.map((id) => RECIPES_BY_ID.get(id)?.title ?? id);
    return `pour : ${titles.join(", ")}`;
  }
  if (item.addedBy && item.addedBy !== me) return `ajouté par ${item.addedBy}`;
  return null;
}

/**
 * Un article. Tap : coche/décoche. Appui long ou bouton « ⋮ » : modifier/supprimer.
 */
export function ItemRow({
  item,
  me,
  onToggle,
  onMenu,
}: {
  item: ListItem;
  me: string;
  onToggle: (item: ListItem) => void;
  onMenu: (item: ListItem) => void;
}) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  // Un article tout juste ajouté via une recette n'a pas encore d'identifiant serveur.
  const pendingCreation = item.id.startsWith("tmp-");
  const quantity = formatQuantity(item.quantity, item.unit);
  const sub = item.checked ? `Dans le panier · ${item.checkedBy ?? "quelqu’un"}` : origin(item, me);

  function cancelTimer() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }

  return (
    <li
      className={cn(
        "flex items-stretch transition-colors duration-200",
        item.checked ? "bg-muted" : "bg-card",
        pendingCreation && "pointer-events-none opacity-70",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        className="flex min-h-14 flex-1 items-center gap-3 py-2.5 pl-4 text-left select-none [-webkit-touch-callout:none]"
        onPointerDown={(e) => {
          longPressed.current = false;
          start.current = { x: e.clientX, y: e.clientY };
          cancelTimer();
          timer.current = window.setTimeout(() => {
            longPressed.current = true;
            navigator.vibrate?.(15);
            onMenu(item);
          }, LONG_PRESS_MS);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancelTimer();
        }}
        onPointerUp={cancelTimer}
        onPointerCancel={cancelTimer}
        onPointerLeave={cancelTimer}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          onToggle(item);
        }}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            item.checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
          )}
        >
          {item.checked && <ShoppingCart className="size-4" strokeWidth={2.5} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[15px]",
                item.checked
                  ? "text-muted-foreground line-through decoration-2"
                  : "font-medium",
              )}
            >
              {item.name}
            </span>
            {quantity && (
              <span
                className={cn(
                  "shrink-0 text-sm whitespace-nowrap tabular-nums",
                  item.checked ? "text-muted-foreground line-through" : "text-foreground/80",
                )}
              >
                {quantity}
              </span>
            )}
          </span>
          {sub && (
            <span
              className={cn(
                "mt-0.5 block truncate text-xs",
                item.checked ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              {sub}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onMenu(item)}
        aria-label={`Options pour ${item.name}`}
        className="flex w-12 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <EllipsisVertical className="size-5" />
      </button>
    </li>
  );
}
