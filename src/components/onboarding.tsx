"use client";

import { useState } from "react";
import { Loader2, LogIn, Plus, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAndActivate, joinAndActivate } from "@/lib/client/list-actions";
import { setProfileName } from "@/lib/client/local-store";
import { normalizeShareCode } from "@/lib/share-code";

function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-3 pt-12 pb-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <ShoppingBasket className="size-8" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function NameStep() {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5">
      <Hero
        title="Bienvenue dans Panier"
        subtitle="Des recettes à la liste de courses, partagée avec tes proches."
      />
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) setProfileName(trimmed.slice(0, 40));
        }}
      >
        <Label htmlFor="firstname" className="text-base">
          Comment t’appelles-tu ?
        </Label>
        <Input
          id="firstname"
          autoFocus
          autoComplete="given-name"
          placeholder="Ton prénom"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          Il s’affiche quand tu ajoutes ou coches un article. Pas de compte, pas de mot de passe.
        </p>
        <Button type="submit" size="lg" className="mt-2" disabled={!trimmed}>
          Continuer
        </Button>
      </form>
    </main>
  );
}

export function CreateListForm({ defaultName, onDone }: { defaultName: string; onDone?: () => void }) {
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        setError(null);
        try {
          await createAndActivate(name.trim());
          onDone?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur inconnue.");
          setBusy(false);
        }
      }}
    >
      <Label htmlFor="list-name">Nom de la liste</Label>
      <Input
        id="list-name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={!name.trim() || busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Plus />}
        Créer une liste
      </Button>
    </form>
  );
}

export function JoinListForm({ onDone }: { onDone?: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalized = normalizeShareCode(code);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!normalized || busy) return;
        setBusy(true);
        setError(null);
        try {
          await joinAndActivate(normalized);
          onDone?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur inconnue.");
          setBusy(false);
        }
      }}
    >
      <Label htmlFor="join-code">Code reçu d’un proche</Label>
      <Input
        id="join-code"
        value={code}
        placeholder="EX. K7PQ2M"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={9}
        className="font-mono text-lg tracking-[0.3em] uppercase placeholder:tracking-normal"
        onChange={(e) => setCode(e.target.value)}
        aria-invalid={code.length >= 6 && !normalized ? true : undefined}
      />
      {code.length >= 6 && !normalized && (
        <p className="text-sm text-muted-foreground">
          Le code contient 6 lettres ou chiffres (jamais de O, 0, I, 1 ou L).
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" variant="outline" disabled={!normalized || busy}>
        {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
        Rejoindre une liste
      </Button>
    </form>
  );
}

export function ListChooser({ firstName }: { firstName: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-10">
      <Hero
        title={`Bonjour ${firstName} !`}
        subtitle="Crée ta liste de courses, ou rejoins celle d’un proche avec son code."
      />
      <CreateListForm defaultName="Nos courses" />
      <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
      <JoinListForm />
    </main>
  );
}
