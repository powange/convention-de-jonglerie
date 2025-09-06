-- RenameColumn
ALTER TABLE `CarpoolOffer` RENAME COLUMN `departureDate` TO `tripDate`;
ALTER TABLE `CarpoolOffer` RENAME COLUMN `departureCity` TO `locationCity`;
ALTER TABLE `CarpoolOffer` RENAME COLUMN `departureAddress` TO `locationAddress`;

-- RenameColumn
ALTER TABLE `CarpoolRequest` RENAME COLUMN `departureDate` TO `tripDate`;
ALTER TABLE `CarpoolRequest` RENAME COLUMN `departureCity` TO `locationCity`;