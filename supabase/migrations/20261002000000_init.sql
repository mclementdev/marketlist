-- Panier : schéma initial.
-- Le client n'accède jamais directement aux tables : toutes les lectures et
-- écritures passent par le serveur Next.js avec la clé service_role.
-- La RLS est activée sans aucune policy, donc les clés anon/publishable ne voient rien.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  -- 6 caractères, sans O/0 ni I/1/L
  share_code  text not null unique check (share_code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  -- Incrémentée à chaque écriture : sert au contrôle de concurrence optimiste
  -- et permet aux clients d'ignorer les événements obsolètes.
  version     bigint not null default 0,
  created_at  timestamptz not null default now()
);

create table public.list_recipes (
  list_id    uuid not null references public.lists (id) on delete cascade,
  recipe_id  text not null,
  servings   integer not null check (servings between 1 and 50),
  added_by   text,
  added_at   timestamptz not null default now(),
  primary key (list_id, recipe_id)
);

create table public.list_items (
  id             uuid primary key default gen_random_uuid(),
  list_id        uuid not null references public.lists (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  ingredient_id  text,
  quantity       numeric check (quantity is null or quantity > 0),
  unit           text check (unit is null or unit in ('g','kg','ml','cl','l','piece','cas','cac','pincee')),
  category       text not null,
  source         text not null check (source in ('recipe', 'manual')),
  recipe_ids     text[] not null default '{}',
  checked        boolean not null default false,
  checked_by     text,
  checked_at     timestamptz,
  added_by       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index list_items_list_id_idx on public.list_items (list_id);

-- Tentatives de saisie de code échouées, pour limiter le bruteforce.
create table public.join_attempts (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);

create index join_attempts_ip_created_idx on public.join_attempts (ip_hash, created_at);

-- ---------------------------------------------------------------------------
-- Sécurité : RLS sans policy publique
-- ---------------------------------------------------------------------------

alter table public.lists         enable row level security;
alter table public.list_recipes  enable row level security;
alter table public.list_items    enable row level security;
alter table public.join_attempts enable row level security;

revoke all on public.lists, public.list_recipes, public.list_items, public.join_attempts
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions
-- ---------------------------------------------------------------------------

create function public.iso_utc(ts timestamptz) returns text
language sql immutable
set search_path = ''
as $$
  select to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- Lecture cohérente d'une liste complète, en une seule requête.
create function public.get_list_snapshot(p_list_id uuid) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'list', jsonb_build_object('id', l.id, 'name', l.name, 'shareCode', l.share_code),
    'version', l.version,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'name', i.name,
        'ingredientId', i.ingredient_id,
        'quantity', i.quantity,
        'unit', i.unit,
        'category', i.category,
        'source', i.source,
        'recipeIds', to_jsonb(i.recipe_ids),
        'checked', i.checked,
        'checkedBy', i.checked_by,
        'checkedAt', public.iso_utc(i.checked_at),
        'addedBy', i.added_by,
        'updatedAt', public.iso_utc(i.updated_at)
      ) order by i.created_at, i.id)
      from public.list_items i where i.list_id = l.id
    ), '[]'::jsonb),
    'recipes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'recipeId', r.recipe_id,
        'servings', r.servings,
        'addedBy', r.added_by
      ) order by r.added_at, r.recipe_id)
      from public.list_recipes r where r.list_id = l.id
    ), '[]'::jsonb)
  )
  from public.lists l
  where l.id = p_list_id
$$;

-- Applique un lot de modifications dans une transaction.
-- Retourne la nouvelle version, -1 si p_expected_version ne correspond plus
-- (un autre client a écrit entre-temps : le serveur relit et recalcule),
-- ou null si la liste n'existe pas.
create function public.commit_list_changes(
  p_list_id            uuid,
  p_expected_version   bigint,
  p_upsert_items       jsonb,
  p_delete_item_ids    uuid[],
  p_upsert_recipes     jsonb,
  p_delete_recipe_ids  text[]
) returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v bigint;
begin
  select version into v from public.lists where id = p_list_id for update;
  if not found then
    return null;
  end if;
  if p_expected_version is not null and v <> p_expected_version then
    return -1;
  end if;

  delete from public.list_items
  where list_id = p_list_id and id = any (coalesce(p_delete_item_ids, '{}'));

  insert into public.list_items as t (
    id, list_id, name, ingredient_id, quantity, unit, category, source,
    recipe_ids, checked, checked_by, checked_at, added_by, updated_at
  )
  select
    (x ->> 'id')::uuid,
    p_list_id,
    x ->> 'name',
    x ->> 'ingredientId',
    (x ->> 'quantity')::numeric,
    x ->> 'unit',
    x ->> 'category',
    x ->> 'source',
    coalesce(array(select jsonb_array_elements_text(x -> 'recipeIds')), '{}'),
    coalesce((x ->> 'checked')::boolean, false),
    x ->> 'checkedBy',
    (x ->> 'checkedAt')::timestamptz,
    x ->> 'addedBy',
    coalesce((x ->> 'updatedAt')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_upsert_items, '[]'::jsonb)) as x
  on conflict (id) do update set
    name          = excluded.name,
    ingredient_id = excluded.ingredient_id,
    quantity      = excluded.quantity,
    unit          = excluded.unit,
    category      = excluded.category,
    source        = excluded.source,
    recipe_ids    = excluded.recipe_ids,
    checked       = excluded.checked,
    checked_by    = excluded.checked_by,
    checked_at    = excluded.checked_at,
    added_by      = excluded.added_by,
    updated_at    = excluded.updated_at
  -- Un identifiant ne peut jamais servir à modifier l'article d'une autre liste.
  where t.list_id = p_list_id;

  delete from public.list_recipes
  where list_id = p_list_id and recipe_id = any (coalesce(p_delete_recipe_ids, '{}'));

  insert into public.list_recipes as t (list_id, recipe_id, servings, added_by)
  select p_list_id, x ->> 'recipeId', (x ->> 'servings')::integer, x ->> 'addedBy'
  from jsonb_array_elements(coalesce(p_upsert_recipes, '[]'::jsonb)) as x
  on conflict (list_id, recipe_id) do update set
    servings = excluded.servings,
    added_by = excluded.added_by;

  update public.lists set version = version + 1 where id = p_list_id
  returning version into v;
  return v;
end;
$$;

create function public.rename_list(p_list_id uuid, p_name text) returns bigint
language sql
set search_path = ''
as $$
  update public.lists set name = p_name, version = version + 1
  where id = p_list_id
  returning version
$$;

revoke execute on function public.iso_utc(timestamptz) from public, anon, authenticated;
revoke execute on function public.get_list_snapshot(uuid) from public, anon, authenticated;
revoke execute on function public.commit_list_changes(uuid, bigint, jsonb, uuid[], jsonb, text[]) from public, anon, authenticated;
revoke execute on function public.rename_list(uuid, text) from public, anon, authenticated;

grant execute on function public.iso_utc(timestamptz) to service_role;
grant execute on function public.get_list_snapshot(uuid) to service_role;
grant execute on function public.commit_list_changes(uuid, bigint, jsonb, uuid[], jsonb, text[]) to service_role;
grant execute on function public.rename_list(uuid, text) to service_role;
