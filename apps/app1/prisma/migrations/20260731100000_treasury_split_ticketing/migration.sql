-- Sépare le produit de billetterie en trois : les entrées comptées comme participants, les dons,
-- et le reste (ventes annexes, tarifs non comptés). Le partage suit `TicketingTier.countAsParticipant`.
--
-- L'ancienne valeur porte un code d'imputation éventuellement choisi par l'organisateur. Elle
-- est donc reprise vers `TICKETING_PARTICIPANTS`, qui représente l'essentiel du montant, plutôt
-- que supprimée — sans quoi le code comptable serait perdu sans un mot.

-- 1. Ouvrir l'énumération aux deux nouvelles valeurs, l'ancienne restant acceptée le temps de la reprise.
ALTER TABLE `TreasurySourceCode`
  MODIFY `source` ENUM(
    'ARTIST_PAYMENT',
    'ARTIST_REIMBURSEMENT',
    'ARTIST_CONSUMABLES',
    'TICKETING_ORDERS',
    'TICKETING_PARTICIPANTS',
    'TICKETING_DONATIONS',
    'TICKETING_OTHER'
  ) NOT NULL;

-- 2. Reprendre les codes déjà attribués.
UPDATE `TreasurySourceCode` SET `source` = 'TICKETING_PARTICIPANTS' WHERE `source` = 'TICKETING_ORDERS';

-- 3. Retirer l'ancienne valeur, désormais inutilisée.
ALTER TABLE `TreasurySourceCode`
  MODIFY `source` ENUM(
    'ARTIST_PAYMENT',
    'ARTIST_REIMBURSEMENT',
    'ARTIST_CONSUMABLES',
    'TICKETING_PARTICIPANTS',
    'TICKETING_DONATIONS',
    'TICKETING_OTHER'
  ) NOT NULL;

-- 4. Reprendre le total des commandes déjà enregistrées, options comprises.
--
-- Le prix d'une option vit dans sa propre table et n'a jamais été ajouté au total de la
-- commande, calculé comme la seule somme de ses lignes. Le montant affiché était donc inférieur
-- à ce qui avait réellement été encaissé — 70 € annoncés pour 118 € payés sur une commande.
--
-- Un incrément, et non un recalcul : les lignes portent déjà le bon montant, seul l'appoint des
-- options manque. La synchronisation, elle, recalcule le total à chaque passage, si bien qu'un
-- nouveau passage après cette reprise redonnera la même valeur plutôt que de la doubler.
UPDATE `TicketingOrder` o
  JOIN (
    SELECT it.orderId AS orderId, SUM(op.amount) AS options
      FROM `TicketingOrderItemOption` op
      JOIN `TicketingOrderItem` it ON it.id = op.orderItemId
     GROUP BY it.orderId
    HAVING SUM(op.amount) > 0
  ) x ON x.orderId = o.id
   SET o.amount = o.amount + x.options;
