-- Bucket Supabase Storage des photos de couverture des posts.
-- À exécuter une fois dans Supabase : Dashboard → SQL Editor → coller ce fichier → Run.
--
-- Public en lecture : les photos s'affichent dans le feed via leur URL publique.
-- Aucune policy d'écriture sur storage.objects : seul le serveur (clé secrète, post.repository)
-- peut envoyer ou supprimer une photo, après vérification du JWT, du type réel et de la taille.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
