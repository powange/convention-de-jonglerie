-- Justificatif sur une entrée de trésorerie.
--
-- Une ligne comptable saisie à la main n'avait que son intitulé et son montant pour l'expliquer.
-- Retrouver à quoi correspondait une dépense trois mois plus tard supposait de remettre la main
-- sur le ticket de caisse, quand il n'avait pas disparu.
--
-- La colonne accueille le chemin public d'une image — la photo du ticket ou de la facture, prise
-- au moment même de la saisie. Optionnelle : rien n'oblige à joindre un justificatif, et les
-- lignes existantes n'en ont aucun.

ALTER TABLE `TreasuryEntry` ADD COLUMN `imageUrl` VARCHAR(191) NULL;
