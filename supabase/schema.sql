-- =====================================================================
-- A4P PCM Bilan : schema Supabase
-- A coller en entier dans l'editeur SQL de Supabase (SQL Editor, New query, Run).
-- Le script est idempotent : il peut etre execute plusieurs fois sans erreur ni perte de donnees.
--
-- Principe de securite :
--   * un client n'a AUCUN droit sur les resultats (test_results) ni sur les notes (admin_notes) ;
--   * un client ne lit que sa propre ligne profiles, sans pouvoir modifier role, categorie,
--     statut, nombre de passages ni accord du representant legal ;
--   * les resultats ne sont inseres que par la route serveur (cle de service), qui recalcule tout,
--     et un declencheur de la base verifie encore les regles de passation.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'client' check (role in ('admin', 'client')),
  category text check (category in ('adulte-sport', 'adulte-hors-sport', 'manager', 'ado-etudes')),
  active boolean not null default true,
  guardian_consent boolean not null default false,
  consent_at timestamptz,
  attempts_allowed integer not null default 1 check (attempts_allowed >= 1),
  created_at timestamptz not null default now(),
  constraint profiles_client_has_category check (role <> 'client' or category is not null)
);

create unique index if not exists profiles_email_lower_key on public.profiles (lower(email));

create table if not exists public.test_drafts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 60000),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempt integer not null check (attempt >= 1),
  category text not null check (category in ('adulte-sport', 'adulte-hors-sport', 'manager', 'ado-etudes')),
  answers jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint test_results_user_attempt_key unique (user_id, attempt)
);

create index if not exists test_results_user_idx on public.test_results (user_id);

create table if not exists public.admin_notes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 20000),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Fonction is_admin() : vrai si la personne connectee est un administrateur actif.
-- security definer pour lire profiles sans recursion de politique.
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Declencheurs : regles appliquees par la base elle-meme
-- ---------------------------------------------------------------------

-- Profils : identifiant fige, categorie figee une fois le test termine, brouillon vide si la categorie change,
-- nombre de passages jamais inferieur au nombre de resultats deja enregistres.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n_results integer;
begin
  if new.id <> old.id then
    raise exception 'profiles.id est immuable' using errcode = 'P0001';
  end if;

  select count(*) into n_results from public.test_results where user_id = old.id;

  if new.attempts_allowed < n_results then
    raise exception 'Le nombre de passages autorises ne peut pas etre inferieur au nombre de resultats' using errcode = 'P0001';
  end if;

  if new.category is distinct from old.category then
    if old.role = 'client' and n_results >= old.attempts_allowed then
      raise exception 'La categorie ne peut plus etre modifiee : le test est termine' using errcode = 'P0001';
    end if;
    delete from public.test_drafts where user_id = old.id;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- Resultats : controle ultime a l'insertion, meme pour la cle de service.
create or replace function public.test_results_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  n_results integer;
begin
  select * into p from public.profiles where id = new.user_id;
  if not found or p.role <> 'client' then
    raise exception 'Seul un client peut avoir un resultat' using errcode = 'P0001';
  end if;
  if not p.active then
    raise exception 'Compte desactive' using errcode = 'P0001';
  end if;
  if p.consent_at is null then
    raise exception 'Consentement absent' using errcode = 'P0001';
  end if;
  if p.category is distinct from new.category then
    raise exception 'La categorie du resultat ne correspond pas a celle du client' using errcode = 'P0001';
  end if;
  if p.category = 'ado-etudes' and not p.guardian_consent then
    raise exception 'Accord du representant legal absent' using errcode = 'P0001';
  end if;
  select count(*) into n_results from public.test_results where user_id = new.user_id;
  if new.attempt <> n_results + 1 or new.attempt > p.attempts_allowed then
    raise exception 'Nombre de passages autorises depasse' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists test_results_guard on public.test_results;
create trigger test_results_guard
  before insert on public.test_results
  for each row execute function public.test_results_guard();

-- Resultats : jamais modifies apres coup (la suppression par cascade reste possible).
create or replace function public.test_results_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Un resultat enregistre ne peut pas etre modifie' using errcode = 'P0001';
end;
$$;

drop trigger if exists test_results_immutable on public.test_results;
create trigger test_results_immutable
  before update on public.test_results
  for each row execute function public.test_results_immutable();

-- ---------------------------------------------------------------------
-- Droits (GRANT) : on part de zero, puis on accorde le strict necessaire
-- ---------------------------------------------------------------------

revoke all on public.profiles from public, anon, authenticated;
revoke all on public.test_drafts from public, anon, authenticated;
revoke all on public.test_results from public, anon, authenticated;
revoke all on public.admin_notes from public, anon, authenticated;

-- profiles : lecture (filtree par RLS) et, pour le client, la seule colonne consent_at.
grant select on public.profiles to authenticated;
grant update (consent_at) on public.profiles to authenticated;

-- test_drafts : le client gere uniquement son brouillon (RLS).
grant select, insert, update, delete on public.test_drafts to authenticated;

-- test_results et admin_notes : lecture/ecriture ouvertes au role connecte, mais les politiques
-- (permissive ET restrictive) ne laissent passer que les administrateurs. Aucune ecriture sur
-- test_results pour le role connecte : l'insertion passe uniquement par la cle de service.
grant select on public.test_results to authenticated;
grant select, insert, update, delete on public.admin_notes to authenticated;

grant all on public.profiles, public.test_drafts, public.test_results, public.admin_notes to service_role;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.test_drafts enable row level security;
alter table public.test_results enable row level security;
alter table public.admin_notes enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- test_drafts
drop policy if exists drafts_select on public.test_drafts;
create policy drafts_select on public.test_drafts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists drafts_insert on public.test_drafts;
create policy drafts_insert on public.test_drafts
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists drafts_update on public.test_drafts;
create policy drafts_update on public.test_drafts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists drafts_delete on public.test_drafts;
create policy drafts_delete on public.test_drafts
  for delete to authenticated
  using (user_id = auth.uid());

-- test_results : lecture reservee aux administrateurs. La politique restrictive s'ajoute a toute
-- politique permissive : meme une erreur future ne pourrait pas ouvrir les resultats a un client.
drop policy if exists results_admin_select on public.test_results;
create policy results_admin_select on public.test_results
  for select to authenticated
  using (public.is_admin());

drop policy if exists results_admin_only on public.test_results;
create policy results_admin_only on public.test_results
  as restrictive
  for all to authenticated
  using (public.is_admin())
  with check (false);

-- admin_notes : administrateurs uniquement
drop policy if exists notes_admin_all on public.admin_notes;
create policy notes_admin_all on public.admin_notes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists notes_admin_only on public.admin_notes;
create policy notes_admin_only on public.admin_notes
  as restrictive
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
