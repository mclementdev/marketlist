"use client";

import { useState } from "react";
import { CheckCheck, Eraser } from "lucide-react";
import { toast } from "sonner";
import { useActiveList } from "@/components/providers/active-list";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { pluralize } from "@/lib/format";

/** « Terminer les courses » : retirer les articles cochés, ou tout vider. */
export function FinishSheet({
  open,
  onOpenChange,
  checkedCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkedCount: number;
}) {
  const { dispatch } = useActiveList();
  const [confirmAll, setConfirmAll] = useState(false);

  function close() {
    setConfirmAll(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent side="bottom" className="mx-auto max-w-[480px] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle className="text-lg">Terminer les courses</SheetTitle>
          <SheetDescription>Que veux-tu faire de la liste ?</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <Button
            size="lg"
            disabled={checkedCount === 0}
            onClick={() => {
              dispatch({ type: "clearChecked" });
              toast.success(`${pluralize(checkedCount, "article retiré", "articles retirés")}`);
              close();
            }}
          >
            <CheckCheck />
            Retirer les articles cochés ({checkedCount})
          </Button>
          {!confirmAll ? (
            <Button size="lg" variant="outline" onClick={() => setConfirmAll(true)}>
              <Eraser />
              Vider toute la liste et les recettes
            </Button>
          ) : (
            <Button
              size="lg"
              variant="destructive"
              onClick={() => {
                dispatch({ type: "clearAll" });
                toast.success("Liste vidée");
                close();
              }}
            >
              <Eraser />
              Confirmer : tout vider, pour tout le monde
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={close}>
            Annuler
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
