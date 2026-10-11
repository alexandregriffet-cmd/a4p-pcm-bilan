-- =====================================================================
-- A4P Bilan de Construction Mentale : donner le role administrateur a votre compte
--
-- Avant de lancer ce script :
--   1. Dans Supabase : Authentication, Users, Add user, Create new user.
--      Saisissez votre e-mail et un mot de passe, cochez "Auto Confirm User".
--   2. Remplacez VOTRE_EMAIL@exemple.fr ci-dessous par cet e-mail (en gardant les apostrophes).
--   3. Collez le script dans l'editeur SQL et cliquez sur Run.
--
-- Le script peut etre relance sans risque.
-- =====================================================================

insert into public.profiles (id, email, full_name, role, category, active)
select u.id, lower(u.email), 'Alexandre Griffet', 'admin', null, true
from auth.users u
where lower(u.email) = lower('VOTRE_EMAIL@exemple.fr')
on conflict (id) do update
  set role = 'admin', active = true;

-- Verification : doit afficher une ligne avec le role admin.
select id, email, role, active from public.profiles where role = 'admin';
