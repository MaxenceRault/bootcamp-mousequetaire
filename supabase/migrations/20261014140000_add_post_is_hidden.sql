-- Posts masqués par leur auteur : retirés du feed et de toute lecture publique,
-- toujours visibles par l'auteur dans son profil (lecture côté serveur, clé secrète).
-- À exécuter une fois dans Supabase : Dashboard → SQL Editor → coller ce fichier → Run.
-- ⚠️ À exécuter AVANT de déployer le code qui lit cette colonne (feed et profil la sélectionnent).

alter table public.post
  add column is_hidden boolean not null default false;

-- Le feed ne lit que les posts visibles, du plus récent au plus ancien (curseur sur l'id).
create index post_visible_id_idx on public.post (id desc) where not is_hidden;

-- La clé publishable (anon / authenticated) ne doit plus lire les posts masqués ni leurs tags.
drop policy "Posts lisibles par tous" on public.post;
create policy "Posts visibles lisibles par tous"
  on public.post for select to anon, authenticated using (not is_hidden);

drop policy "Liens post-tag lisibles par tous" on public.post_tag;
create policy "Liens post-tag des posts visibles lisibles par tous"
  on public.post_tag for select to anon, authenticated
  using (exists (select 1 from public.post where post.id = post_tag.post_id and not post.is_hidden));
