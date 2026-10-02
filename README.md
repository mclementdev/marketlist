# Panier

Liste de courses partagée, mobile-first et installable (PWA). On pioche des recettes, leurs
ingrédients s'ajoutent à la liste, on ajoute ses propres articles, et on coche en magasin, à
plusieurs et en temps réel.

- **Stack** : Next.js 16 (App Router, TypeScript strict), Tailwind CSS 4, shadcn/ui (Base UI),
  Lucide, Supabase (Postgres + Realtime Broadcast), Vitest.
- **Pas de compte** : un prénom et un identifiant d'appareil, stockés dans le navigateur.

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis renseigner les 3 variables (voir plus bas)
npm run dev                  # http://localhost:3000
```

> **Sans Supabase** : si les variables sont absentes, `npm run dev` utilise un stockage **en
> mémoire** (perdu au redémarrage, sans temps réel). La synchronisation entre onglets passe alors
> par le rafraîchissement toutes les 5 s. Pratique pour essayer l'interface ; en production,
> Supabase est obligatoire.

Autres commandes : `npm test` (Vitest), `npm run lint`, `npm run typecheck`, `npm run build`.

## Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), créer un projet (région proche de vos utilisateurs,
   par ex. `eu-west-3` Paris).
2. **Appliquer la migration** `supabase/migrations/20261002000000_init.sql`, au choix :
   - *SQL Editor* → coller le contenu du fichier → **Run** ;
   - ou avec la CLI : `npx supabase link --project-ref <ref>` puis `npx supabase db push`.
3. **Récupérer les clés** (*Project Settings → API Keys*) et remplir `.env.local` :
   - `NEXT_PUBLIC_SUPABASE_URL` : l'URL du projet ;
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` : la clé publique (`anon` ou `sb_publishable_…`) ;
   - `SUPABASE_SERVICE_ROLE_KEY` : la clé secrète (`service_role` ou `sb_secret_…`).
4. **Realtime** : vérifier dans *Realtime → Settings* que « Allow public access » est activé
   (c'est le réglage par défaut). L'app utilise des canaux **Broadcast** publics nommés
   `list:{uuid}` ; aucune table n'est exposée via Realtime.

## Architecture

```
src/
  data/recipes.json, ingredients.json   recettes et catalogue (statiques)
  lib/shopping-list.ts                  logique pure : portions, fusion, retrait, formats, rayons
  lib/list-ops.ts                       réducteur d'opérations partagé client/serveur + validation
  server/repository.ts                  accès Supabase (service_role) ou mémoire (dev)
  server/lists.ts                       application des opérations, concurrence, diffusion
  app/api/lists/…                       Route Handlers (seul point d'accès aux données)
  components/providers/active-list.tsx  état client : optimiste, temps réel, repli
supabase/migrations/                    schéma, RLS, fonctions SQL
```

### Sécurité (sans comptes)

- Le navigateur ne lit ni n'écrit **jamais** dans les tables : tout passe par les Route Handlers,
  qui utilisent la clé `service_role` côté serveur. La RLS est activée **sans aucune policy**.
- Une liste est accessible par son `id` (UUID non devinable) ou son `share_code` (6 caractères
  sans O/0/I/1/L, soit environ 887 millions de combinaisons).
- Saisie de code limitée à **10 échecs par quart d'heure et par IP** (IP hachée, table
  `join_attempts`).
- Toutes les entrées sont validées côté serveur (`parseOp`). Un identifiant d'article ne peut pas
  modifier un article d'une autre liste (garde dans `commit_list_changes`).

### Synchronisation et conflits

1. Le client applique l'opération **localement tout de suite** (même réducteur `applyOp` que le
   serveur), puis l'envoie. Les opérations partent dans l'ordre, une par une.
2. Le serveur lit l'état (`get_list_snapshot`), recalcule avec `applyOp`, puis écrit le
   différentiel avec `commit_list_changes(…, expected_version)`. Si un autre client a écrit
   entre-temps, la version ne correspond plus : le serveur **relit et recalcule** (jusqu'à
   6 essais). Aucun ajout simultané n'est perdu ; pour un même champ, la dernière écriture gagne.
3. Après chaque écriture, le serveur diffuse `{ version, snapshot }` sur le canal Broadcast
   `list:{uuid}`. Les clients ne gardent que la version la plus haute.
4. En cas d'échec, l'opération optimiste est retirée (l'écran revient à l'état serveur) et un
   toast s'affiche.
5. **Repli** : si le canal temps réel n'est pas connecté, rafraîchissement toutes les 5 s ; sinon
   toutes les 60 s par sécurité. Rafraîchissement aussi au retour au premier plan et au retour du
   réseau.

## Déployer sur Vercel

1. Pousser le dépôt sur GitHub, puis **Import Project** sur [vercel.com](https://vercel.com).
2. Ajouter les 3 variables d'environnement (Production et Preview).
3. Déployer. HTTPS est fourni par Vercel, ce qui est indispensable pour la PWA, le partage natif et
   le presse-papiers.

### Installer l'app

- **iPhone (Safari)** : Partager → « Sur l'écran d'accueil ».
- **Android (Chrome)** : menu ⋮ → « Installer l'application » (ou la bannière proposée).

## Dépendances ajoutées (hors socle Next/Tailwind/shadcn)

| Paquet | Pourquoi |
|---|---|
| `@supabase/supabase-js` | Base de données et Realtime Broadcast |
| `sonner` | Toasts (composant officiel shadcn) |
| `qrcode-generator` | QR code du lien de partage (environ 50 Ko, sans dépendance, rendu SVG maison) |
| `vitest` | Tests unitaires |
