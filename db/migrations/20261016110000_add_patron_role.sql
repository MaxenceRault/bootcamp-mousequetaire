-- Nouveau badge « Mécène » (rôle sans droits particuliers, comme voyageur, globe-trotteur et rêveur).

set role brb_admin;

alter type user_role add value 'patron' before 'admin';

reset role;
