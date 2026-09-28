-- Rattrapage des lignes existantes.
--
-- La migration précédente n'a fait qu'ajouter les colonnes : par défaut, elles décrivent
-- correctement les billets À VENIR, et faussement ceux qui existent déjà. D'où cette seconde
-- migration, séparée — une retouche de la première casserait son empreinte.

-- 1. Un billet annulé CHEZ HELLOASSO a été remboursé par HelloAsso : la plateforme n'annule une
--    ligne qu'une fois l'argent rendu. Sans ce rattrapage, ces billets apparaîtraient dans la
--    liste « à rembourser » comme une dette qui n'existe pas.
--
--    `refundedAt` reste NULL à dessein : on sait QUE l'argent a été rendu, pas quand. Y écrire
--    `updatedAt` afficherait la date de la dernière synchronisation comme date de remboursement.
UPDATE `TicketingOrderItem`
SET `refunded` = true
WHERE `state` = 'Canceled' AND `helloAssoItemId` IS NOT NULL;

-- 2. Les billets d'une commande annulée portent désormais eux-mêmes l'annulation.
--
--    L'annulation d'une commande n'écrivait que son `status`, et la porte lisait les deux niveaux
--    pour savoir si un billet valait encore. Tout se lit maintenant sur le billet, et ces lignes
--    doivent donc le dire. `canceledAt` reste NULL : ces annulations sont antérieures à la trace.
--
--    Leur `refunded` reste à `false` : rien n'indique que l'argent a été rendu, et le prétendre
--    effacerait une dette réelle. Elles apparaîtront dans la liste « à rembourser », ce qui est
--    exactement l'effet recherché — quelqu'un ira vérifier.
UPDATE `TicketingOrderItem` `i`
JOIN `TicketingOrder` `o` ON `o`.`id` = `i`.`orderId`
SET `i`.`state` = 'Canceled'
WHERE `o`.`status` = 'Refunded' AND `i`.`state` <> 'Canceled';
