"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useActiveList } from "@/components/providers/active-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CATEGORY_LABELS, CATEGORY_ORDER, isCategoryId } from "@/lib/catalog";
import { UNIT_LABELS } from "@/lib/shopping-list";
import { UNITS, type CategoryId, type ListItem, type Unit } from "@/lib/types";

const selectClass = "h-11 w-full rounded-xl border border-input bg-card px-3 text-base";

/** Feuille du bas pour modifier ou supprimer un article. */
export function ItemSheet({ item, onClose }: { item: ListItem | null; onClose: () => void }) {
  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-[480px] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        {item && <ItemForm key={item.id} item={item} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function ItemForm({ item, onClose }: { item: ListItem; onClose: () => void }) {
  const { dispatch } = useActiveList();
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.quantity === null ? "" : String(item.quantity).replace(".", ","));
  const [unit, setUnit] = useState<Unit>(item.unit ?? "piece");
  const [category, setCategory] = useState<CategoryId>(item.category);

  const parsedQty = qty.trim() === "" ? null : Number(qty.replace(",", "."));
  const qtyValid = parsedQty === null || (Number.isFinite(parsedQty) && parsedQty > 0 && parsedQty <= 100000);
  const valid = name.trim().length > 0 && qtyValid;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        dispatch({
          type: "updateItem",
          id: item.id,
          name: name.trim().slice(0, 80),
          quantity: parsedQty,
          unit: parsedQty === null ? null : unit,
          category,
        });
        onClose();
      }}
    >
      <SheetHeader className="pb-2">
        <SheetTitle className="text-lg">Modifier l’article</SheetTitle>
        <SheetDescription>
          {item.source === "recipe" ? "Issu d’une recette." : "Ajouté à la main."}
          {item.addedBy ? ` Par ${item.addedBy}.` : ""}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-name">Nom</Label>
          <Input id="item-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-qty">Quantité</Label>
            <Input
              id="item-qty"
              inputMode="decimal"
              placeholder="—"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              aria-invalid={!qtyValid || undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-unit">Unité</Label>
            <select
              id="item-unit"
              className={selectClass}
              value={unit}
              disabled={parsedQty === null}
              onChange={(e) => setUnit(e.target.value as Unit)}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-category">Rayon</Label>
          <select
            id="item-category"
            className={selectClass}
            value={category}
            onChange={(e) => isCategoryId(e.target.value) && setCategory(e.target.value)}
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <Button type="submit" size="lg" disabled={!valid}>
          Enregistrer
        </Button>
        <Button
          type="button"
          size="lg"
          variant="destructive"
          onClick={() => {
            dispatch({ type: "deleteItem", id: item.id });
            onClose();
          }}
        >
          <Trash2 />
          Supprimer
        </Button>
      </div>
    </form>
  );
}
