"use client";

import { useMemo, useState } from "react";
import { Check, Copy, LogOut, Pencil, Plus, Share, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { CreateListForm, JoinListForm } from "@/components/onboarding";
import { useActiveList } from "@/components/providers/active-list";
import { QrCode } from "@/components/share/qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  forgetList,
  setActiveList,
  setProfileName,
  useLocalState,
} from "@/lib/client/local-store";
import { cn } from "@/lib/utils";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ShareView() {
  const { list, state, userName, rename } = useActiveList();
  const local = useLocalState();
  const [sheet, setSheet] = useState<"create" | "join" | null>(null);

  const shareUrl = list ? `${window.location.origin}/l/${list.shareCode}` : "";

  const participants = useMemo(() => {
    const names = new Set<string>([userName]);
    for (const r of state?.recipes ?? []) if (r.addedBy) names.add(r.addedBy);
    for (const i of state?.items ?? []) {
      if (i.addedBy) names.add(i.addedBy);
      if (i.checkedBy) names.add(i.checkedBy);
    }
    return [...names];
  }, [state, userName]);

  async function shareLink() {
    if (!list) return;
    const data = {
      title: `Liste « ${list.name} »`,
      text: `Rejoins ma liste de courses « ${list.name} » sur Panier (code ${list.shareCode})`,
      url: shareUrl,
    };
    if (typeof navigator.share === "function" && navigator.canShare?.(data) !== false) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    if (await copyText(shareUrl)) toast.success("Lien copié", { description: shareUrl });
    else toast.error("Impossible de copier le lien");
  }

  return (
    <main className="pb-8">
      <PageHeader title="Partager" subtitle="Faites les courses à plusieurs, en temps réel." />

      {list ? (
        <section className="mx-4 rounded-2xl border bg-card p-5 text-center shadow-xs" aria-labelledby="code-title">
          <ListName name={list.name} onRename={rename} />
          <h2 id="code-title" className="mt-4 text-sm text-muted-foreground">
            Code de partage
          </h2>
          <p className="mt-1 font-mono text-4xl font-semibold tracking-[0.25em] tabular-nums select-all">
            {list.shareCode}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant="outline"
              onClick={async () => {
                if (await copyText(list.shareCode)) toast.success("Code copié");
                else toast.error("Impossible de copier le code");
              }}
            >
              <Copy /> Copier le code
            </Button>
            <Button size="lg" onClick={shareLink}>
              <Share /> Partager le lien
            </Button>
          </div>
          <div className="mt-5 flex flex-col items-center gap-2">
            <div className="rounded-2xl border p-2">
              <QrCode value={shareUrl} label={`QR code du lien ${shareUrl}`} />
            </div>
            <p className="text-xs text-muted-foreground">À scanner avec l’appareil photo d’un proche.</p>
          </div>
        </section>
      ) : (
        <div className="mx-4 h-40 animate-pulse rounded-2xl bg-muted" aria-busy />
      )}

      <section className="mt-6 px-4" aria-labelledby="people-title">
        <h2 id="people-title" className="mb-2 text-lg font-semibold">
          Participants
        </h2>
        <ul className="flex flex-wrap gap-2">
          {participants.map((name) => (
            <li
              key={name}
              className="inline-flex h-9 items-center gap-2 rounded-full border bg-card pr-3.5 pl-1 text-sm"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {name.slice(0, 1).toUpperCase()}
              </span>
              {name}
              {name === userName && <span className="text-muted-foreground">(toi)</span>}
            </li>
          ))}
        </ul>
        {participants.length === 1 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Les prénoms apparaissent ici dès que quelqu’un ajoute ou coche un article.
          </p>
        )}
      </section>

      <section className="mt-6 px-4" aria-labelledby="lists-title">
        <h2 id="lists-title" className="mb-2 text-lg font-semibold">
          Mes listes
        </h2>
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {local?.lists.map((l) => {
            const active = l.id === local.activeListId;
            return (
              <li key={l.id} className="flex items-center">
                <button
                  type="button"
                  className="flex min-h-14 flex-1 items-center gap-3 px-4 text-left"
                  onClick={() => {
                    if (!active) {
                      setActiveList(l.id);
                      toast(`Liste active : ${l.name}`);
                    }
                  }}
                  aria-current={active ? "true" : undefined}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border-2",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                    aria-hidden
                  >
                    {active && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{l.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{l.shareCode}</span>
                  </span>
                </button>
                <LeaveButton name={l.name} onLeave={() => forgetList(l.id)} />
              </li>
            );
          })}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="lg" variant="outline" onClick={() => setSheet("create")}>
            <Plus /> Nouvelle liste
          </Button>
          <Button size="lg" variant="outline" onClick={() => setSheet("join")}>
            Rejoindre
          </Button>
        </div>
      </section>

      <section className="mt-6 px-4" aria-labelledby="me-title">
        <h2 id="me-title" className="mb-2 text-lg font-semibold">
          Mon prénom
        </h2>
        <FirstNameForm current={userName} />
      </section>

      <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-[480px] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle className="text-lg">
              {sheet === "join" ? "Rejoindre une liste" : "Nouvelle liste"}
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            {sheet === "join" ? (
              <JoinListForm onDone={() => setSheet(null)} />
            ) : (
              <CreateListForm defaultName="Nouvelle liste" onDone={() => setSheet(null)} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

function ListName({ name, onRename }: { name: string; onRename: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  if (!editing) {
    return (
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xl font-semibold hover:bg-muted"
        onClick={() => {
          setValue(name);
          setEditing(true);
        }}
        aria-label={`Renommer la liste ${name}`}
      >
        {name}
        <Pencil className="size-4 text-muted-foreground" aria-hidden />
      </button>
    );
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = value.trim();
        setEditing(false);
        if (v && v !== name) await onRename(v.slice(0, 60));
      }}
    >
      <Input autoFocus value={value} maxLength={60} onChange={(e) => setValue(e.target.value)} aria-label="Nom de la liste" />
      <Button type="submit" size="icon-lg" aria-label="Enregistrer le nom">
        <Check />
      </Button>
    </form>
  );
}

function LeaveButton({ name, onLeave }: { name: string; onLeave: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <div className="flex items-center gap-1 pr-2">
        <Button variant="destructive" onClick={onLeave}>
          Quitter
        </Button>
        <Button variant="ghost" onClick={() => setConfirm(false)}>
          Non
        </Button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      aria-label={`Quitter la liste ${name}`}
      className="flex size-12 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
    >
      <LogOut className="size-5" />
    </button>
  );
}

function FirstNameForm({ current }: { current: string }) {
  const [value, setValue] = useState(current);
  const v = value.trim();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v && v !== current) {
          setProfileName(v.slice(0, 40));
          toast.success("Prénom mis à jour");
        }
      }}
    >
      <div className="relative flex-1">
        <UserRound className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={value} maxLength={40} onChange={(e) => setValue(e.target.value)} className="pl-10" aria-label="Mon prénom" />
      </div>
      <Button type="submit" size="lg" variant="outline" disabled={!v || v === current}>
        Enregistrer
      </Button>
    </form>
  );
}
