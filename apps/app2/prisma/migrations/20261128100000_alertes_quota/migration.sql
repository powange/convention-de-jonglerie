-- Alertes de plafond déjà envoyées au propriétaire d'un événement, par compteur (server/utils/quotas.ts) :
-- un courriel à 80 %, un autre à la limite, jamais deux fois le même.
ALTER TABLE `Event` ADD COLUMN `alertesQuota` JSON NULL;
