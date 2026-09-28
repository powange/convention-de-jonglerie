-- Rattrapage : une annulation venue de HelloAsso vaut remboursement, et une commande dont
-- HelloAsso a annulé toutes les lignes est annulée.
--
-- La synchronisation applique désormais ces deux règles d'elle-même. Cette migration met en
-- accord ce qu'elle a écrit AVANT : sans elle, les lignes concernées attendraient un passage de
-- synchronisation qui, pour la première règle, ne viendrait jamais — la règle ne joue qu'au moment
-- où la source annonce l'annulation, et ces lignes l'ont déjà annoncée.
--
-- « Annulée à la source » : l'état est annulé, et ce n'est pas une annulation faite ICI que la
-- source ignore (`canceledAt` nul), ou la source l'a annoncée elle aussi (`sourceCanceledAt`).

-- 1. Remboursée par la plateforme : sans auteur et sans date, comme au rattrapage du 28/09 — on
--    sait QUE l'argent a été rendu, pas quand. Aucune ligne n'est concernée sur la copie de
--    production mesurée le 28/09 ; la requête couvre les synchronisations faites depuis.
UPDATE `TicketingOrderItem` `i`
JOIN `TicketingOrder` `o` ON `o`.`id` = `i`.`orderId`
SET `i`.`refunded` = true
WHERE `o`.`externalTicketingId` IS NOT NULL
  AND `i`.`state` IN ('Canceled', 'Refunded')
  AND `i`.`refunded` = false
  AND (`i`.`canceledAt` IS NULL OR `i`.`sourceCanceledAt` IS NOT NULL);

-- 2. Commande annulée quand toutes ses lignes le sont à la source. Sept commandes sur la copie de
--    production : elles s'affichaient « Payée », tous leurs billets annulés dessous. Sans effet sur
--    la trésorerie ni les comptages, qui lisent déjà l'état de chaque ligne.
UPDATE `TicketingOrder` `o`
SET `o`.`status` = 'Refunded'
WHERE `o`.`externalTicketingId` IS NOT NULL
  AND `o`.`status` <> 'Refunded'
  AND EXISTS (SELECT 1 FROM `TicketingOrderItem` `i` WHERE `i`.`orderId` = `o`.`id`)
  AND NOT EXISTS (
    SELECT 1 FROM `TicketingOrderItem` `i`
    WHERE `i`.`orderId` = `o`.`id`
      AND NOT (
        `i`.`state` IN ('Canceled', 'Refunded')
        AND (`i`.`canceledAt` IS NULL OR `i`.`sourceCanceledAt` IS NOT NULL)
      )
  );
