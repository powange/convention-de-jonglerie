-- Rattrapage des descriptions d'objets trouvés échappées en base — constat B5.
--
-- Jusqu'à ce lot, la description passait par `sanitizeUserContent` AVANT stockage : « Sac & clés »
-- était écrit « Sac &amp; clés ». L'écran l'affichant par interpolation (que Vue échappe déjà), le
-- lecteur voyait les entités. Le handler n'échappe plus ; les lignes déjà écrites, elles, portent
-- encore les entités et ne se corrigeraient jamais toutes seules.
--
-- ⚠️ L'ORDRE DES TROIS REMPLACEMENTS N'EST PAS INDIFFÉRENT, et la fiche proposait l'inverse.
-- L'échappement traitait `&` EN PREMIER ; le décodage doit donc le traiter EN DERNIER. Autrement,
-- une description contenant littéralement « &lt; » — écrite en base « &amp;lt; » — serait ramenée
-- à « &lt; » par le premier remplacement, puis à « < » par le second : on inventerait un caractère
-- que personne n'a tapé. En décodant `&lt;` et `&gt;` d'abord, « &amp;lt; » n'offre aucune prise
-- (la séquence `&lt;` n'y apparaît pas), et le dernier remplacement rend exactement l'original.
--
-- 📊 Aucune ligne à rattraper sur la base de développement (0 objet trouvé). Cette migration est
-- écrite pour la production, dont je ne peux pas compter les lignes d'ici : elle ne touche que
-- celles qui portent réellement une entité, et ne fait rien s'il n'y en a aucune.
UPDATE `LostFoundItem`
SET `description` = REPLACE(REPLACE(REPLACE(`description`, '&lt;', '<'), '&gt;', '>'), '&amp;', '&')
WHERE `description` LIKE '%&amp;%'
   OR `description` LIKE '%&lt;%'
   OR `description` LIKE '%&gt;%';
