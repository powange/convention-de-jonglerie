-- Migration: add volunteersAskAllergies to Edition and allergies to EditionVolunteerApplication
-- Generated manually

ALTER TABLE `Edition`
  ADD COLUMN `volunteersAskAllergies` BOOLEAN NOT NULL DEFAULT 0 AFTER `volunteersAskDiet`;

ALTER TABLE `EditionVolunteerApplication`
  ADD COLUMN `allergies` TEXT NULL AFTER `motivation`;
