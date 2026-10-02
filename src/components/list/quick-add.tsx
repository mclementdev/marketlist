"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useActiveList } from "@/components/providers/active-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS, CATEGORY_ORDER, isCategoryId } from "@/lib/catalog";
import { guessCategory, parseQuantityInput } from "@/lib/shopping-list";
import type { CategoryId } from "@/lib/types";
import { uuid } from "@/lib/uuid";

/** Ajout rapide en haut de la liste : nom, quantité facultative, rayon deviné (modifiable). */
export function QuickAdd() {
  const { dispatch, state } = useActiveList();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  // null : on suit la catégorie devinée ; sinon choix explicite de l'utilisateur.
  const [category, setCategory] = useState<CategoryId | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  const guessed = guessCategory(trimmed);
  const effective = category ?? guessed;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    const parsed = qty.trim() ? parseQuantityInput(qty) : null;
    // Une quantité non reconnue (« 2 paquets ») est gardée dans le nom.
    const finalName = qty.trim() && !parsed ? `${trimmed} (${qty.trim()})` : trimmed;
    dispatch({
      type: "addItem",
      id: uuid(),
      name: finalName.slice(0, 80),
      quantity: parsed?.quantity ?? null,
      unit: parsed?.unit ?? null,
      category: effective,
    });
    setName("");
    setQty("");
    setCategory(null);
    nameRef.current?.focus();
  }

  return (
    <form onSubmit={submit} className="space-y-2" aria-label="Ajouter un article">
      <div className="flex gap-2">
        <Input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ajouter un article…"
          aria-label="Article"
          enterKeyHint="done"
          autoComplete="off"
          maxLength={80}
          className="flex-1"
        />
        <Input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Qté"
          aria-label="Quantité (facultative)"
          enterKeyHint="done"
          autoComplete="off"
          className="w-20 text-center"
        />
        <Button
          type="submit"
          size="icon-lg"
          aria-label="Ajouter"
          disabled={!trimmed || state === null}
        >
          <Plus />
        </Button>
      </div>
      {trimmed && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Rayon :
          <select
            value={effective}
            onChange={(e) => isCategoryId(e.target.value) && setCategory(e.target.value)}
            className="h-9 rounded-lg border bg-card px-2 font-medium text-foreground"
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      )}
    </form>
  );
}
