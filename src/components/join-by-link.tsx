"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { joinAndActivate } from "@/lib/client/list-actions";
import { setActiveList, useLocalState } from "@/lib/client/local-store";
import { normalizeShareCode } from "@/lib/share-code";
import { cn } from "@/lib/utils";

/** Ouverture d'un lien de partage /l/{code} : rejoint la liste puis ouvre « Ma liste ». */
export function JoinByLink({ code }: { code: string }) {
  const router = useRouter();
  const local = useLocalState();
  const normalized = normalizeShareCode(decodeURIComponent(code));
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!local || !normalized || started.current) return;
    started.current = true;
    const known = local.lists.find((l) => l.shareCode === normalized);
    if (known) {
      setActiveList(known.id);
      router.replace("/liste");
      return;
    }
    joinAndActivate(normalized)
      .then(() => router.replace("/liste"))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Erreur inconnue."));
  }, [local, normalized, router]);

  const message = !normalized ? "Ce lien de partage n’est pas valide." : error;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
      {message ? (
        <>
          <p className="text-lg font-medium">Impossible de rejoindre la liste</p>
          <p className="text-muted-foreground">{message}</p>
          <Link href="/" className={cn(buttonVariants({ size: "lg" }), "mt-2")}>
            Retour à l’accueil
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
          <p className="text-muted-foreground">
            Connexion à la liste <span className="font-mono font-semibold text-foreground">{normalized}</span>…
          </p>
        </>
      )}
    </main>
  );
}
