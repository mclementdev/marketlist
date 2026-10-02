"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat, ListChecks, Loader2, Share2, ShoppingBasket } from "lucide-react";
import { ListChooser, NameStep } from "@/components/onboarding";
import { ActiveListProvider, useActiveList } from "@/components/providers/active-list";
import { Button } from "@/components/ui/button";
import { forgetList, useLocalState } from "@/lib/client/local-store";
import { cn } from "@/lib/utils";

export function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-primary" aria-busy>
      <ShoppingBasket className="size-10 animate-pulse" aria-label="Chargement" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const local = useLocalState();
  const pathname = usePathname();

  if (!local) return <Splash />;
  if (!local.profile) return <NameStep />;
  // Lien de partage : la page /l/{code} gère elle-même l'adhésion.
  if (pathname.startsWith("/l/")) return <>{children}</>;
  if (!local.activeListId) return <ListChooser firstName={local.profile.name} />;

  return (
    <ActiveListProvider
      key={local.activeListId}
      listId={local.activeListId}
      userName={local.profile.name}
    >
      <MissingListGuard>
        <div className="mx-auto min-h-dvh w-full max-w-[480px] pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
        <TabBar />
      </MissingListGuard>
    </ActiveListProvider>
  );
}

function MissingListGuard({ children }: { children: React.ReactNode }) {
  const { status, list, refresh } = useActiveList();
  const local = useLocalState();
  if (status === "missing") {
    const id = local?.activeListId;
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-medium">Cette liste n’existe plus.</p>
        <p className="text-muted-foreground">Elle a peut-être été supprimée de la base de données.</p>
        <Button size="lg" onClick={() => id && forgetList(id)}>
          Retirer {list?.name ? `« ${list.name} »` : "la liste"} de mes listes
        </Button>
        <Button variant="ghost" onClick={() => void refresh()}>
          Réessayer
        </Button>
      </main>
    );
  }
  return <>{children}</>;
}

const TABS = [
  { href: "/", label: "Recettes", icon: ChefHat },
  { href: "/liste", label: "Ma liste", icon: ListChecks },
  { href: "/partager", label: "Partager", icon: Share2 },
] as const;

function TabBar() {
  const pathname = usePathname();
  const { state } = useActiveList();
  const remaining = state?.items.filter((i) => !i.checked).length ?? 0;

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-card/85"
    >
      <ul className="mx-auto grid max-w-[480px] grid-cols-3">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" || pathname.startsWith("/recettes") : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-6" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
                  {href === "/liste" && remaining > 0 && (
                    <span className="absolute -top-1.5 -right-3 min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] leading-5 font-semibold text-primary-foreground tabular-nums">
                      {remaining > 99 ? "99+" : remaining}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3 px-4 pt-6 pb-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {action}
    </header>
  );
}

export function LoadingBlock({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground" aria-busy>
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}
