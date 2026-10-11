-- Tests de securite de schema.sql sur un PostgreSQL avec simulation Supabase (voir 00-simulation-supabase.sql).
-- Chaque verification ecrit PASS ou FAIL dans t.log ; le script se termine par un bilan.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset pager off

drop schema if exists t cascade;
create schema t;
create table t.log (n serial, label text, expected text, got text, ok boolean);
grant usage on schema t to public;
grant all on t.log to public;
grant all on sequence t.log_n_seq to public;

create function t.try(q text) returns text language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return 'ok:' || n;
exception when others then
  return 'err:' || sqlstate;
end $$;

create function t.cnt(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || q || ') s' into n;
  return n;
exception when others then
  return -1;
end $$;

create function t.val(q text) returns text language plpgsql as $$
declare v text;
begin
  execute q into v;
  return v;
exception when others then
  return 'err:' || sqlstate;
end $$;

create procedure t.check(label text, expected text, got text) language sql as $$
  insert into t.log (label, expected, got, ok) values (label, expected, got, expected = got);
$$;
grant execute on all functions in schema t to public;
grant execute on all procedures in schema t to public;

-- Jeu de donnees (en tant que superutilisateur, comme l'editeur SQL de Supabase)
\set admin   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set clientA '''aaaaaaaa-0000-0000-0000-00000000000a'''
\set clientB '''aaaaaaaa-0000-0000-0000-00000000000b'''
\set clientC '''aaaaaaaa-0000-0000-0000-00000000000c'''
\set clientD '''aaaaaaaa-0000-0000-0000-00000000000d'''
\set inactiveAdmin '''aaaaaaaa-0000-0000-0000-00000000000e'''

insert into auth.users (id, email) values
  (:admin, 'admin@t.fr'), (:clientA, 'a@t.fr'), (:clientB, 'b@t.fr'), (:clientC, 'c@t.fr'), (:clientD, 'd@t.fr'),
  (:inactiveAdmin, 'oldadmin@t.fr');

insert into public.profiles (id, email, full_name, role, category, consent_at, active) values
  (:admin, 'admin@t.fr', 'Admin', 'admin', null, null, true),
  (:inactiveAdmin, 'oldadmin@t.fr', 'Ancien admin', 'admin', null, null, false);
insert into public.profiles (id, email, full_name, role, category, consent_at, guardian_consent, attempts_allowed) values
  (:clientA, 'a@t.fr', 'Client A', 'client', 'adulte-sport', now(), false, 1),
  (:clientB, 'b@t.fr', 'Client B', 'client', 'manager', now(), false, 1),
  (:clientC, 'c@t.fr', 'Client C', 'client', 'ado-etudes', now(), false, 1),
  (:clientD, 'd@t.fr', 'Client D', 'client', 'adulte-hors-sport', null, false, 1);

insert into public.test_drafts (user_id, answers) values (:clientA, '{"Q1":[0,1,2]}'), (:clientB, '{"Q1":[3,4,5]}');
insert into public.admin_notes (user_id, note) values (:clientA, 'note privee A');

-- Resultat de A et de B insere par la cle de service
set role service_role;
insert into public.test_results (user_id, attempt, category, answers, result) values
  (:clientA, 1, 'adulte-sport', '{}', '{"secret":"A"}'),
  (:clientB, 1, 'manager', '{}', '{"secret":"B"}');
reset role;

-- =========================== CLIENT A ===========================
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000a';

call t.check('client: lecture de test_results (les siens compris) = 0 ligne', '0', t.cnt('select * from public.test_results')::text);
call t.check('client: lecture de test_results WHERE user_id = soi = 0 ligne', '0', t.cnt($$select * from public.test_results where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$)::text);
call t.check('client: lecture de admin_notes = 0 ligne', '0', t.cnt('select * from public.admin_notes')::text);
call t.check('client: profiles = une seule ligne', '1', t.cnt('select * from public.profiles')::text);
call t.check('client: la ligne visible est la sienne', '1', t.cnt($$select * from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$)::text);
call t.check('client: lecture du profil d''un autre = 0', '0', t.cnt($$select * from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$$)::text);

call t.check('client: UPDATE role refuse', 'err:42501', t.try($$update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('client: UPDATE category refuse', 'err:42501', t.try($$update public.profiles set category = 'manager' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('client: UPDATE active refuse', 'err:42501', t.try($$update public.profiles set active = false where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('client: UPDATE attempts_allowed refuse', 'err:42501', t.try($$update public.profiles set attempts_allowed = 9 where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('client: UPDATE guardian_consent refuse', 'err:42501', t.try($$update public.profiles set guardian_consent = true where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('client: UPDATE email refuse', 'err:42501', t.try($$update public.profiles set email = 'x@x.fr' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('client: UPDATE id refuse', 'err:42501', t.try($$update public.profiles set id = gen_random_uuid() where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('client: UPDATE consent_at de sa ligne autorise', 'ok:1', t.try($$update public.profiles set consent_at = now() where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('client: UPDATE consent_at de la ligne d''un autre = 0 ligne', 'ok:0', t.try($$update public.profiles set consent_at = now() where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$$));
call t.check('client: INSERT profiles refuse', 'err:42501', t.try($$insert into public.profiles (id, email, role) values (gen_random_uuid(), 'z@z.fr', 'admin')$$));
call t.check('client: DELETE profiles refuse', 'err:42501', t.try($$delete from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));

call t.check('client: INSERT test_results refuse', 'err:42501', t.try($$insert into public.test_results (user_id, attempt, category, answers, result) values ('aaaaaaaa-0000-0000-0000-00000000000a', 2, 'adulte-sport', '{}', '{}')$$));
call t.check('client: UPDATE test_results refuse', 'err:42501', t.try($$update public.test_results set result = '{}'$$));
call t.check('client: DELETE test_results refuse', 'err:42501', t.try($$delete from public.test_results$$));
call t.check('client: INSERT admin_notes refuse', 'err:42501', t.try($$insert into public.admin_notes (user_id, note) values ('aaaaaaaa-0000-0000-0000-00000000000b', 'x')$$));
call t.check('client: UPDATE admin_notes = 0 ligne', 'ok:0', t.try($$update public.admin_notes set note = 'x'$$));
call t.check('client: DELETE admin_notes = 0 ligne', 'ok:0', t.try($$delete from public.admin_notes$$));

call t.check('client: lit son brouillon', '1', t.cnt('select * from public.test_drafts')::text);
call t.check('client: ne lit pas le brouillon de B', '0', t.cnt($$select * from public.test_drafts where user_id = 'aaaaaaaa-0000-0000-0000-00000000000b'$$)::text);
call t.check('client: modifie son brouillon', 'ok:1', t.try($$update public.test_drafts set answers = '{"Q1":[1,2,3]}' where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('client: ne modifie pas le brouillon de B', 'ok:0', t.try($$update public.test_drafts set answers = '{"Q1":[0,0,0]}' where user_id = 'aaaaaaaa-0000-0000-0000-00000000000b'$$));
call t.check('client: ne supprime pas le brouillon de B', 'ok:0', t.try($$delete from public.test_drafts where user_id = 'aaaaaaaa-0000-0000-0000-00000000000b'$$));
call t.check('client: n''insere pas un brouillon au nom de B', 'err:42501', t.try($$insert into public.test_drafts (user_id, answers) values ('aaaaaaaa-0000-0000-0000-00000000000b', '{}') on conflict (user_id) do update set answers = '{"pirate":1}'$$));
call t.check('client: is_admin() = false', 'false', public.is_admin()::text);
call t.check('client: brouillon trop gros refuse', 'err:23514', t.try($$update public.test_drafts set answers = jsonb_build_object('x', repeat('a', 70000)) where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('client: supprime son propre brouillon', 'ok:1', t.try($$delete from public.test_drafts where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('client: recree son brouillon', 'ok:1', t.try($$insert into public.test_drafts (user_id, answers) values ('aaaaaaaa-0000-0000-0000-00000000000a', '{"Q1":[0,1,2]}')$$));
reset role;

-- =========================== ANONYME ===========================
set role anon;
call t.check('anon: profiles refuse', 'err:42501', t.try('select * from public.profiles'));
call t.check('anon: test_results refuse', 'err:42501', t.try('select * from public.test_results'));
call t.check('anon: admin_notes refuse', 'err:42501', t.try('select * from public.admin_notes'));
call t.check('anon: test_drafts refuse', 'err:42501', t.try('select * from public.test_drafts'));
reset role;

-- =========================== ADMIN ===========================
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
call t.check('admin: is_admin() = true', 'true', public.is_admin()::text);
call t.check('admin: lit tous les profils', '6', t.cnt('select * from public.profiles')::text);
call t.check('admin: lit tous les resultats', '2', t.cnt('select * from public.test_results')::text);
call t.check('admin: lit tous les brouillons', '2', t.cnt('select * from public.test_drafts')::text);
call t.check('admin: lit les notes', '1', t.cnt('select * from public.admin_notes')::text);
call t.check('admin: ecrit une note', 'ok:1', t.try($$insert into public.admin_notes (user_id, note) values ('aaaaaaaa-0000-0000-0000-00000000000b', 'note B')$$));
call t.check('admin: modifie une note', 'ok:1', t.try($$update public.admin_notes set note = 'note B bis' where user_id = 'aaaaaaaa-0000-0000-0000-00000000000b'$$));
call t.check('admin (session): ne peut pas inserer un resultat', 'err:42501', t.try($$insert into public.test_results (user_id, attempt, category, answers, result) values ('aaaaaaaa-0000-0000-0000-00000000000b', 2, 'manager', '{}', '{}')$$));
call t.check('admin (session): ne modifie pas les profils directement', 'err:42501', t.try($$update public.profiles set active = false where id = 'aaaaaaaa-0000-0000-0000-00000000000b'$$));
reset role;

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000e';
call t.check('administrateur desactive: is_admin() = false', 'false', public.is_admin()::text);
call t.check('administrateur desactive: ne lit pas les resultats', '0', t.cnt('select * from public.test_results')::text);
reset role;

-- La politique restrictive tient meme si une politique permissive trop large est ajoutee par erreur
begin;
create policy erreur_future on public.test_results for select to authenticated using (true);
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000a';
select t.cnt('select * from public.test_results') as r_restrictive \gset
reset role;
rollback;
call t.check('politique restrictive: un client ne lit toujours rien malgre une politique permissive trop large (rollback ensuite)', '0', :'r_restrictive');

-- =========================== SERVICE (route serveur) : unicite et regles de la base ===========================
-- La contrainte unique agit seule : on neutralise un instant le declencheur (course entre deux envois simultanes).
begin;
alter table public.test_results disable trigger test_results_guard;
set role service_role;
select t.try($$insert into public.test_results (user_id, attempt, category, answers, result) values ('aaaaaaaa-0000-0000-0000-00000000000a', 1, 'adulte-sport', '{}', '{}')$$) as r_unique \gset
reset role;
rollback;
call t.check('service: doublon (user, attempt) refuse par la contrainte unique seule', 'err:23505', :'r_unique');

set role service_role;
call t.check('service: tentative 2 refusee quand un seul passage est autorise', 'err:P0001',
  t.try($$insert into public.test_results (user_id, attempt, category, answers, result) values ('aaaaaaaa-0000-0000-0000-00000000000a', 2, 'adulte-sport', '{}', '{}')$$));
call t.check('service: categorie differente de celle du profil refusee', 'err:P0001',
  t.try($$insert into public.test_results (user_id, attempt, category, answers, result) values ('aaaaaaaa-0000-0000-0000-00000000000d', 1, 'manager', '{}', '{}')$$));
call t.check('service: resultat sans consentement refuse', 'err:P0001',
  t.try($$insert into public.test_results (user_id, attempt, category, answers, result) values ('aaaaaaaa-0000-0000-0000-00000000000d', 1, 'adulte-hors-sport', '{}', '{}')$$));
call t.check('service: ado sans accord du representant legal refuse', 'err:P0001',
  t.try($$insert into public.test_results (user_id, attempt, category, answers, result) values ('aaaaaaaa-0000-0000-0000-00000000000c', 1, 'ado-etudes', '{}', '{}')$$));
call t.check('service: resultat pour un administrateur refuse', 'err:P0001',
  t.try($$insert into public.test_results (user_id, attempt, category, answers, result) values ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'manager', '{}', '{}')$$));
call t.check('service: UPDATE d''un resultat refuse (immuable)', 'err:P0001', t.try($$update public.test_results set result = '{"x":1}'$$));
reset role;

-- Accord du representant legal puis passage ado accepte
update public.profiles set guardian_consent = true where id = :clientC;
set role service_role;
call t.check('service: ado avec accord accepte', 'ok:1',
  t.try($$insert into public.test_results (user_id, attempt, category, answers, result) values ('aaaaaaaa-0000-0000-0000-00000000000c', 1, 'ado-etudes', '{}', '{}')$$));
reset role;

-- Categorie figee apres le test, libre avant, brouillon efface au changement
call t.check('categorie: changement refuse apres le test termine', 'err:P0001', t.try($$update public.profiles set category = 'manager' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
insert into public.test_drafts (user_id, answers) values (:clientD, '{"Q1":[0,1,2]}');
call t.check('categorie: changement accepte avant le test (client D)', 'ok:1', t.try($$update public.profiles set category = 'manager' where id = 'aaaaaaaa-0000-0000-0000-00000000000d'$$));
call t.check('categorie: le brouillon est efface au changement de categorie', '0', t.cnt($$select * from public.test_drafts where user_id = 'aaaaaaaa-0000-0000-0000-00000000000d'$$)::text);

-- Nouveau passage autorise : le nombre de passages monte a 2, l'ancien resultat est conserve
call t.check('attempts_allowed: valeur 0 refusee', 'err:23514', t.try($$update public.profiles set attempts_allowed = 0 where id = 'aaaaaaaa-0000-0000-0000-00000000000d'$$));
call t.check('attempts_allowed: passage a 2 accepte', 'ok:1', t.try($$update public.profiles set attempts_allowed = 2 where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('categorie: changement accepte quand un nouveau passage est en attente', 'ok:1', t.try($$update public.profiles set category = 'adulte-hors-sport' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('categorie: le premier resultat garde sa propre categorie', 'adulte-sport',
  t.val($$select category from public.test_results where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a' and attempt = 1$$));
update public.profiles set category = 'adulte-sport' where id = :clientA;
set role service_role;
call t.check('service: tentative 3 refusee (saut de numero)', 'err:P0001',
  t.try($$insert into public.test_results (user_id, attempt, category, answers, result) values ('aaaaaaaa-0000-0000-0000-00000000000a', 3, 'adulte-sport', '{}', '{}')$$));
call t.check('service: tentative 2 acceptee apres autorisation', 'ok:1',
  t.try($$insert into public.test_results (user_id, attempt, category, answers, result) values ('aaaaaaaa-0000-0000-0000-00000000000a', 2, 'adulte-sport', '{}', '{"secret":"A2"}')$$));
call t.check('service: tentative 3 refusee (limite atteinte)', 'err:P0001',
  t.try($$insert into public.test_results (user_id, attempt, category, answers, result) values ('aaaaaaaa-0000-0000-0000-00000000000a', 3, 'adulte-sport', '{}', '{}')$$));
reset role;
call t.check('anciennes tentatives conservees', '2', t.cnt($$select * from public.test_results where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$)::text);
call t.check('attempts_allowed: reduction sous le nombre de resultats refusee', 'err:P0001', t.try($$update public.profiles set attempts_allowed = 1 where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));
call t.check('categorie: de nouveau figee quand toutes les tentatives sont utilisees', 'err:P0001', t.try($$update public.profiles set category = 'manager' where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$));

-- Contraintes de profils
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-0000000000f1', 'dup@t.fr');
call t.check('profiles: deux e-mails identiques a la casse pres refuses', 'err:23505',
  t.try($$insert into public.profiles (id, email, role, category) values ('aaaaaaaa-0000-0000-0000-0000000000f1', 'A@T.FR', 'client', 'manager')$$));
call t.check('profiles: un client sans categorie est refuse', 'err:23514', t.try($$insert into public.profiles (id, email, role) values (gen_random_uuid(), 'nocat@t.fr', 'client')$$));

-- Suppression en cascade (suppression d'un client et de toutes ses donnees)
delete from auth.users where id = :clientA;
call t.check('cascade: profil supprime', '0', t.cnt($$select * from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$)::text);
call t.check('cascade: resultats supprimes', '0', t.cnt($$select * from public.test_results where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$)::text);
call t.check('cascade: brouillon supprime', '0', t.cnt($$select * from public.test_drafts where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$)::text);
call t.check('cascade: note supprimee', '0', t.cnt($$select * from public.admin_notes where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$$)::text);

-- Bilan
\set QUIET 0
select case when ok then 'PASS' else 'FAIL' end as resultat, label, expected as attendu, got as obtenu from t.log order by n;
select count(*) filter (where ok) as reussis, count(*) filter (where not ok) as echecs, count(*) as total from t.log;
