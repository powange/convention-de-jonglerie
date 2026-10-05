-- Rattrapage des lignes ANTÉRIEURES à l'ajout de `latitude`/`longitude` sur le covoiturage.
--
-- ⚠️ UNE MIGRATION NE PEUT PAS GÉOCODER : elle n'appelle aucun service. Les 31 coordonnées
-- ci-dessous ont donc été obtenues UNE FOIS, le 05/10/2026, en interrogeant Nominatim depuis un
-- script, puis figées ici. L'avantage de ce gel est qu'elles sont relisibles et déterministes :
-- la migration donne le même résultat dans tous les environnements, sans dépendre d'un service
-- extérieur au moment du déploiement.
--
-- 📍 LE FILTRE EST CELUI DU FORMULAIRE — settlements seulement (`city`, `town`, `village`) —, sans
-- quoi la coordonnée de rattrapage ne serait pas celle qu'une annonce neuve obtient, et une même
-- ville porterait deux points sur la carte.
--
-- ⚠️ DÉSAMBIGUÏSATION PAR PROXIMITÉ, et elle était nécessaire. Interrogé sur le seul nom,
-- Nominatim rend « Vienne, Autriche » — à 800 km. Les deux annonces concernées portent pourtant
-- « Gare de Vienne » en adresse et appartiennent à l'édition de Noyarey, en Isère. Le script a
-- donc retenu, parmi les cinq premiers candidats de chaque ville, CELUI LE PLUS PROCHE DE
-- L'ÉDITION : Vienne (Isère), à 67 km. Vérifié : aucune ville ne reçoit deux choix contradictoires
-- selon l'édition, ce qui autorise la clé sur le seul nom ci-dessous.
--
-- Les départs lointains ne sont pas des erreurs pour autant : Marseille est à 896 km de son
-- édition (slovène) et Bruxelles à 630 km de la sienne. La proximité n'a servi qu'à trancher entre
-- des homonymes, jamais à écarter un candidat unique.
--
-- `latitude IS NULL` : on ne touche jamais une coordonnée déjà posée. Une ville absente de cette
-- table reste sans point — c'est voulu, l'écran la nomme au lieu de la perdre, et le géocodage
-- côté serveur s'en charge à la prochaine écriture.

UPDATE `CarpoolOffer` AS o
JOIN (
    SELECT 'Aix-en-Provence' AS ville, 43.5298424 AS lat, 5.4474738 AS lon
    UNION ALL SELECT 'Angoulême', 45.6484505, 0.1561947
    UNION ALL SELECT 'Annecy', 45.8992348, 6.1288847
    UNION ALL SELECT 'Brive-la-Gaillarde', 45.1584982, 1.5332389
    UNION ALL SELECT 'Bruxelles', 50.8467372, 4.352493
    UNION ALL SELECT 'Chambéry', 45.5662672, 5.9203636
    UNION ALL SELECT 'Clermont-Ferrand', 45.7774551, 3.0819427
    UNION ALL SELECT 'Collonges-la-Rouge', 45.0604597, 1.6551231
    UNION ALL SELECT 'Eymoutiers', 45.7389214, 1.7432748
    UNION ALL SELECT 'Grenoble', 45.1875602, 5.7357819
    UNION ALL SELECT 'Le Muy', 43.4713932, 6.566111
    UNION ALL SELECT 'Les Vans', 44.405479, 4.1332861
    UNION ALL SELECT 'Lyon', 45.7578137, 4.8320114
    UNION ALL SELECT 'Lézignan-Corbières', 43.2008841, 2.7574981
    UNION ALL SELECT 'Marseille', 43.2963986, 5.3777888
    UNION ALL SELECT 'Mazamet', 43.4902317, 2.3764363
    UNION ALL SELECT 'Meyssac', 45.0557371, 1.6741893
    UNION ALL SELECT 'Montpellier', 43.6112422, 3.8767337
    UNION ALL SELECT 'Namur', 50.4665284, 4.8661892
    UNION ALL SELECT 'Narbonne', 43.1837757, 3.0041906
    UNION ALL SELECT 'Niort', 46.3239233, -0.4646064
    UNION ALL SELECT 'Nîmes', 43.8374249, 4.3600687
    UNION ALL SELECT 'Paris', 48.8534951, 2.3483915
    UNION ALL SELECT 'Pertuis', 43.6951468, 5.5032671
    UNION ALL SELECT 'Romans-sur-Isère', 45.0458886, 5.0528681
    UNION ALL SELECT 'Saint-Girons', 42.9841865, 1.1464455
    UNION ALL SELECT 'Toulouse', 43.6044638, 1.4442433
    UNION ALL SELECT 'Tulette', 44.2865287, 4.9301519
    UNION ALL SELECT 'Vallet', 47.1610036, -1.2657431
    UNION ALL SELECT 'Vienne', 45.52524, 4.87477
    UNION ALL SELECT 'Échirolles', 45.1481694, 5.718687
) AS v ON v.ville = o.`locationCity`
SET o.`latitude` = v.lat, o.`longitude` = v.lon
WHERE o.`latitude` IS NULL;

UPDATE `CarpoolRequest` AS r
JOIN (
    SELECT 'Aix-en-Provence' AS ville, 43.5298424 AS lat, 5.4474738 AS lon
    UNION ALL SELECT 'Angoulême', 45.6484505, 0.1561947
    UNION ALL SELECT 'Annecy', 45.8992348, 6.1288847
    UNION ALL SELECT 'Brive-la-Gaillarde', 45.1584982, 1.5332389
    UNION ALL SELECT 'Bruxelles', 50.8467372, 4.352493
    UNION ALL SELECT 'Chambéry', 45.5662672, 5.9203636
    UNION ALL SELECT 'Clermont-Ferrand', 45.7774551, 3.0819427
    UNION ALL SELECT 'Collonges-la-Rouge', 45.0604597, 1.6551231
    UNION ALL SELECT 'Eymoutiers', 45.7389214, 1.7432748
    UNION ALL SELECT 'Grenoble', 45.1875602, 5.7357819
    UNION ALL SELECT 'Le Muy', 43.4713932, 6.566111
    UNION ALL SELECT 'Les Vans', 44.405479, 4.1332861
    UNION ALL SELECT 'Lyon', 45.7578137, 4.8320114
    UNION ALL SELECT 'Lézignan-Corbières', 43.2008841, 2.7574981
    UNION ALL SELECT 'Marseille', 43.2963986, 5.3777888
    UNION ALL SELECT 'Mazamet', 43.4902317, 2.3764363
    UNION ALL SELECT 'Meyssac', 45.0557371, 1.6741893
    UNION ALL SELECT 'Montpellier', 43.6112422, 3.8767337
    UNION ALL SELECT 'Namur', 50.4665284, 4.8661892
    UNION ALL SELECT 'Narbonne', 43.1837757, 3.0041906
    UNION ALL SELECT 'Niort', 46.3239233, -0.4646064
    UNION ALL SELECT 'Nîmes', 43.8374249, 4.3600687
    UNION ALL SELECT 'Paris', 48.8534951, 2.3483915
    UNION ALL SELECT 'Pertuis', 43.6951468, 5.5032671
    UNION ALL SELECT 'Romans-sur-Isère', 45.0458886, 5.0528681
    UNION ALL SELECT 'Saint-Girons', 42.9841865, 1.1464455
    UNION ALL SELECT 'Toulouse', 43.6044638, 1.4442433
    UNION ALL SELECT 'Tulette', 44.2865287, 4.9301519
    UNION ALL SELECT 'Vallet', 47.1610036, -1.2657431
    UNION ALL SELECT 'Vienne', 45.52524, 4.87477
    UNION ALL SELECT 'Échirolles', 45.1481694, 5.718687
) AS v ON v.ville = r.`locationCity`
SET r.`latitude` = v.lat, r.`longitude` = v.lon
WHERE r.`latitude` IS NULL;
