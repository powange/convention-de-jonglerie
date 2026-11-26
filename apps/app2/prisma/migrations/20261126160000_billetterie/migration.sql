-- Billetterie (lot 6). Le DROP sur TicketingHandoutItem retire une colonne `eventId` superflue,
-- inventée par `prisma format` au lot 4 quand cette table dormante avait perdu sa relation à
-- l'événement ; la table est VIDE partout (articles à remettre fermés dans Flowvent jusqu'ici).

-- DropForeignKey
ALTER TABLE `TicketingHandoutItem` DROP FOREIGN KEY `TicketingHandoutItem_eventId_fkey`;

-- DropIndex
DROP INDEX `TicketingHandoutItem_eventId_fkey` ON `TicketingHandoutItem`;

-- AlterTable
ALTER TABLE `TicketingHandoutItem` DROP COLUMN `eventId`;

-- CreateTable
CREATE TABLE `ExternalTicketing` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` INTEGER NOT NULL,
    `provider` ENUM('HELLOASSO', 'INFOMANIAK', 'BILLETWEB', 'WEEZEVENT', 'OTHER') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ERROR') NOT NULL DEFAULT 'ACTIVE',
    `lastSyncAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExternalTicketing_editionId_key`(`editionId`),
    INDEX `ExternalTicketing_editionId_idx`(`editionId`),
    INDEX `ExternalTicketing_provider_idx`(`provider`),
    INDEX `ExternalTicketing_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HelloAssoConfig` (
    `id` VARCHAR(191) NOT NULL,
    `externalTicketingId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `clientSecret` VARCHAR(191) NOT NULL,
    `organizationSlug` VARCHAR(191) NOT NULL,
    `formType` VARCHAR(191) NOT NULL,
    `formSlug` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HelloAssoConfig_externalTicketingId_key`(`externalTicketingId`),
    INDEX `HelloAssoConfig_externalTicketingId_idx`(`externalTicketingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SumupConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `affiliateKey` TEXT NOT NULL,
    `appId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SumupConfig_editionId_key`(`editionId`),
    INDEX `SumupConfig_editionId_idx`(`editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InfomaniakConfig` (
    `id` VARCHAR(191) NOT NULL,
    `externalTicketingId` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NOT NULL,
    `apiKeyGuichet` VARCHAR(191) NULL,
    `applicationPassword` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT '2',
    `eventId` INTEGER NULL,
    `eventName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InfomaniakConfig_externalTicketingId_key`(`externalTicketingId`),
    INDEX `InfomaniakConfig_externalTicketingId_idx`(`externalTicketingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalTicketingId` VARCHAR(191) NULL,
    `helloAssoTierId` INTEGER NULL,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `customName` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `price` INTEGER NOT NULL,
    `minAmount` INTEGER NULL,
    `maxAmount` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `countAsParticipant` BOOLEAN NOT NULL DEFAULT true,
    `validFrom` DATETIME(3) NULL,
    `validUntil` DATETIME(3) NULL,
    `presenceFrom` DATETIME(3) NULL,
    `presenceUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingTier_externalTicketingId_idx`(`externalTicketingId`),
    INDEX `TicketingTier_editionId_idx`(`editionId`),
    UNIQUE INDEX `TicketingTier_externalTicketingId_helloAssoTierId_key`(`externalTicketingId`, `helloAssoTierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `quantity` INTEGER NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingQuota_editionId_idx`(`editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionVolunteerHandoutItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `handoutItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `teamId` VARCHAR(191) NULL,
    `phases` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionVolunteerHandoutItem_editionId_idx`(`editionId`),
    INDEX `EditionVolunteerHandoutItem_handoutItemId_idx`(`handoutItemId`),
    INDEX `EditionVolunteerHandoutItem_teamId_idx`(`teamId`),
    UNIQUE INDEX `EditionVolunteerHandoutItem_editionId_handoutItemId_teamId_key`(`editionId`, `handoutItemId`, `teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionArtistHandoutItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `handoutItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionArtistHandoutItem_editionId_idx`(`editionId`),
    INDEX `EditionArtistHandoutItem_handoutItemId_idx`(`handoutItemId`),
    UNIQUE INDEX `EditionArtistHandoutItem_editionId_handoutItemId_key`(`editionId`, `handoutItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionOrganizerHandoutItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `handoutItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `organizerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionOrganizerHandoutItem_editionId_idx`(`editionId`),
    INDEX `EditionOrganizerHandoutItem_handoutItemId_idx`(`handoutItemId`),
    INDEX `EditionOrganizerHandoutItem_organizerId_idx`(`organizerId`),
    UNIQUE INDEX `EditionOrganizerHandoutItem_editionId_handoutItemId_organize_key`(`editionId`, `handoutItemId`, `organizerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionOrganizerQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,
    `organizerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionOrganizerQuota_editionId_idx`(`editionId`),
    INDEX `EditionOrganizerQuota_quotaId_idx`(`quotaId`),
    INDEX `EditionOrganizerQuota_organizerId_idx`(`organizerId`),
    UNIQUE INDEX `EditionOrganizerQuota_editionId_quotaId_organizerId_key`(`editionId`, `quotaId`, `organizerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionVolunteerQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,
    `teamId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionVolunteerQuota_editionId_idx`(`editionId`),
    INDEX `EditionVolunteerQuota_quotaId_idx`(`quotaId`),
    INDEX `EditionVolunteerQuota_teamId_idx`(`teamId`),
    UNIQUE INDEX `EditionVolunteerQuota_editionId_quotaId_teamId_key`(`editionId`, `quotaId`, `teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionArtistQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,
    `showId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionArtistQuota_editionId_idx`(`editionId`),
    INDEX `EditionArtistQuota_quotaId_idx`(`quotaId`),
    INDEX `EditionArtistQuota_showId_idx`(`showId`),
    UNIQUE INDEX `EditionArtistQuota_editionId_quotaId_showId_key`(`editionId`, `quotaId`, `showId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,

    INDEX `TicketingTierQuota_tierId_idx`(`tierId`),
    INDEX `TicketingTierQuota_quotaId_idx`(`quotaId`),
    UNIQUE INDEX `TicketingTierQuota_tierId_quotaId_key`(`tierId`, `quotaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierHandoutItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `handoutItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    INDEX `TicketingTierHandoutItem_tierId_idx`(`tierId`),
    INDEX `TicketingTierHandoutItem_handoutItemId_idx`(`handoutItemId`),
    UNIQUE INDEX `TicketingTierHandoutItem_tierId_handoutItemId_key`(`tierId`, `handoutItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,

    INDEX `TicketingTierOption_tierId_idx`(`tierId`),
    INDEX `TicketingTierOption_optionId_idx`(`optionId`),
    UNIQUE INDEX `TicketingTierOption_tierId_optionId_key`(`tierId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOptionQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `optionId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,

    INDEX `TicketingOptionQuota_optionId_idx`(`optionId`),
    INDEX `TicketingOptionQuota_quotaId_idx`(`quotaId`),
    UNIQUE INDEX `TicketingOptionQuota_optionId_quotaId_key`(`optionId`, `quotaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOptionHandoutItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `optionId` INTEGER NOT NULL,
    `handoutItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    INDEX `TicketingOptionHandoutItem_optionId_idx`(`optionId`),
    INDEX `TicketingOptionHandoutItem_handoutItemId_idx`(`handoutItemId`),
    UNIQUE INDEX `TicketingOptionHandoutItem_optionId_handoutItemId_key`(`optionId`, `handoutItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalTicketingId` VARCHAR(191) NULL,
    `helloAssoOptionId` VARCHAR(191) NULL,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `choices` JSON NULL,
    `price` INTEGER NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOption_externalTicketingId_idx`(`externalTicketingId`),
    INDEX `TicketingOption_editionId_idx`(`editionId`),
    UNIQUE INDEX `TicketingOption_externalTicketingId_helloAssoOptionId_key`(`externalTicketingId`, `helloAssoOptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalTicketingId` VARCHAR(191) NULL,
    `helloAssoOrderId` INTEGER NULL,
    `editionId` INTEGER NOT NULL,
    `payerFirstName` VARCHAR(191) NOT NULL,
    `payerLastName` VARCHAR(191) NOT NULL,
    `payerEmail` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `checkNumber` VARCHAR(191) NULL,
    `orderDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOrder_externalTicketingId_idx`(`externalTicketingId`),
    INDEX `TicketingOrder_editionId_idx`(`editionId`),
    INDEX `TicketingOrder_payerEmail_idx`(`payerEmail`),
    UNIQUE INDEX `TicketingOrder_externalTicketingId_helloAssoOrderId_key`(`externalTicketingId`, `helloAssoOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `helloAssoItemId` INTEGER NULL,
    `tierId` INTEGER NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `type` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `qrCode` VARCHAR(191) NULL,
    `customFields` JSON NULL,
    `entryValidated` BOOLEAN NOT NULL DEFAULT false,
    `entryValidatedAt` DATETIME(3) NULL,
    `entryValidatedBy` INTEGER NULL,
    `canceledAt` DATETIME(3) NULL,
    `canceledById` INTEGER NULL,
    `discountAmount` INTEGER NOT NULL DEFAULT 0,
    `discountedAt` DATETIME(3) NULL,
    `discountedById` INTEGER NULL,
    `discountPaidBack` BOOLEAN NOT NULL DEFAULT false,
    `discountPaidBackAt` DATETIME(3) NULL,
    `discountPaidBackById` INTEGER NULL,
    `refunded` BOOLEAN NOT NULL DEFAULT false,
    `refundedAt` DATETIME(3) NULL,
    `refundedById` INTEGER NULL,
    `sourceCanceledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOrderItem_orderId_idx`(`orderId`),
    INDEX `TicketingOrderItem_tierId_idx`(`tierId`),
    INDEX `TicketingOrderItem_helloAssoItemId_idx`(`helloAssoItemId`),
    INDEX `TicketingOrderItem_email_idx`(`email`),
    INDEX `TicketingOrderItem_qrCode_idx`(`qrCode`),
    INDEX `TicketingOrderItem_entryValidated_idx`(`entryValidated`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierCustomField` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `helloAssoCustomFieldId` INTEGER NULL,
    `externalTicketingId` VARCHAR(191) NULL,
    `editionId` INTEGER NOT NULL,
    `label` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `values` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingTierCustomField_externalTicketingId_idx`(`externalTicketingId`),
    INDEX `TicketingTierCustomField_editionId_idx`(`editionId`),
    UNIQUE INDEX `TicketingTierCustomField_externalTicketingId_helloAssoCustom_key`(`externalTicketingId`, `helloAssoCustomFieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierCustomFieldAssociation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `customFieldId` INTEGER NOT NULL,

    INDEX `TicketingTierCustomFieldAssociation_tierId_idx`(`tierId`),
    INDEX `TicketingTierCustomFieldAssociation_customFieldId_idx`(`customFieldId`),
    UNIQUE INDEX `TicketingTierCustomFieldAssociation_tierId_customFieldId_key`(`tierId`, `customFieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierCustomFieldQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customFieldId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,
    `choiceValue` VARCHAR(191) NULL,

    INDEX `TicketingTierCustomFieldQuota_customFieldId_idx`(`customFieldId`),
    INDEX `TicketingTierCustomFieldQuota_quotaId_idx`(`quotaId`),
    UNIQUE INDEX `TicketingTierCustomFieldQuota_customFieldId_quotaId_choiceVa_key`(`customFieldId`, `quotaId`, `choiceValue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierCustomFieldHandoutItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customFieldId` INTEGER NOT NULL,
    `handoutItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `choiceValue` VARCHAR(191) NULL,

    INDEX `TicketingTierCustomFieldHandoutItem_customFieldId_idx`(`customFieldId`),
    INDEX `TicketingTierCustomFieldHandoutItem_handoutItemId_idx`(`handoutItemId`),
    UNIQUE INDEX `TicketingTierCustomFieldHandoutItem_customFieldId_handoutIte_key`(`customFieldId`, `handoutItemId`, `choiceValue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOrderItemOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderItemId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL DEFAULT 0,
    `customFields` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOrderItemOption_orderItemId_idx`(`orderItemId`),
    INDEX `TicketingOrderItemOption_optionId_idx`(`optionId`),
    UNIQUE INDEX `TicketingOrderItemOption_orderItemId_optionId_key`(`orderItemId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingCounter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastActorId` INTEGER NULL,

    UNIQUE INDEX `TicketingCounter_token_key`(`token`),
    INDEX `TicketingCounter_editionId_idx`(`editionId`),
    INDEX `TicketingCounter_token_idx`(`token`),
    INDEX `TicketingCounter_lastActorId_idx`(`lastActorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EntryValidationLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `participantKind` ENUM('TICKET', 'VOLUNTEER', 'ARTIST', 'ORGANIZER') NOT NULL,
    `participantId` INTEGER NOT NULL,
    `movement` ENUM('VALIDATED', 'INVALIDATED') NOT NULL,
    `actorId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EntryValidationLog_editionId_createdAt_idx`(`editionId`, `createdAt`),
    INDEX `EntryValidationLog_participantKind_participantId_idx`(`participantKind`, `participantId`),
    INDEX `EntryValidationLog_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerMealSelection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `volunteerId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `accepted` BOOLEAN NOT NULL DEFAULT true,
    `afterShow` BOOLEAN NOT NULL DEFAULT false,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerMealSelection_volunteerId_idx`(`volunteerId`),
    INDEX `VolunteerMealSelection_mealId_idx`(`mealId`),
    UNIQUE INDEX `VolunteerMealSelection_volunteerId_mealId_key`(`volunteerId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizerMealSelection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionOrganizerId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `accepted` BOOLEAN NOT NULL DEFAULT true,
    `afterShow` BOOLEAN NOT NULL DEFAULT false,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrganizerMealSelection_editionOrganizerId_idx`(`editionOrganizerId`),
    INDEX `OrganizerMealSelection_mealId_idx`(`mealId`),
    UNIQUE INDEX `OrganizerMealSelection_editionOrganizerId_mealId_key`(`editionOrganizerId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerMealHandoutItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mealId` INTEGER NOT NULL,
    `handoutItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerMealHandoutItem_mealId_idx`(`mealId`),
    INDEX `VolunteerMealHandoutItem_handoutItemId_idx`(`handoutItemId`),
    UNIQUE INDEX `VolunteerMealHandoutItem_mealId_handoutItemId_key`(`mealId`, `handoutItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierMeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingTierMeal_tierId_idx`(`tierId`),
    INDEX `TicketingTierMeal_mealId_idx`(`mealId`),
    UNIQUE INDEX `TicketingTierMeal_tierId_mealId_key`(`tierId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOptionMeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `optionId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOptionMeal_optionId_idx`(`optionId`),
    INDEX `TicketingOptionMeal_mealId_idx`(`mealId`),
    UNIQUE INDEX `TicketingOptionMeal_optionId_mealId_key`(`optionId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOrderItemMeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderItemId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOrderItemMeal_orderItemId_idx`(`orderItemId`),
    INDEX `TicketingOrderItemMeal_mealId_idx`(`mealId`),
    UNIQUE INDEX `TicketingOrderItemMeal_orderItemId_mealId_key`(`orderItemId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiErrorLog` (
    `id` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `statusCode` INTEGER NOT NULL,
    `stack` LONGTEXT NULL,
    `errorType` VARCHAR(191) NULL,
    `method` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `userAgent` TEXT NULL,
    `ip` VARCHAR(191) NULL,
    `referer` TEXT NULL,
    `origin` VARCHAR(191) NULL,
    `headers` JSON NULL,
    `body` JSON NULL,
    `queryParams` JSON NULL,
    `prismaDetails` JSON NULL,
    `userId` INTEGER NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedBy` INTEGER NULL,
    `resolvedAt` DATETIME(3) NULL,
    `adminNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ApiErrorLog_createdAt_idx`(`createdAt`),
    INDEX `ApiErrorLog_statusCode_idx`(`statusCode`),
    INDEX `ApiErrorLog_path_idx`(`path`),
    INDEX `ApiErrorLog_userId_idx`(`userId`),
    INDEX `ApiErrorLog_resolved_idx`(`resolved`),
    INDEX `ApiErrorLog_resolved_createdAt_idx`(`resolved`, `createdAt`),
    INDEX `ApiErrorLog_errorType_createdAt_idx`(`errorType`, `createdAt`),
    INDEX `ApiErrorLog_errorType_message_idx`(`errorType`, `message`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TicketingHandoutItem` ADD CONSTRAINT `TicketingHandoutItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExternalTicketing` ADD CONSTRAINT `ExternalTicketing_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HelloAssoConfig` ADD CONSTRAINT `HelloAssoConfig_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SumupConfig` ADD CONSTRAINT `SumupConfig_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InfomaniakConfig` ADD CONSTRAINT `InfomaniakConfig_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTier` ADD CONSTRAINT `TicketingTier_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTier` ADD CONSTRAINT `TicketingTier_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingQuota` ADD CONSTRAINT `TicketingQuota_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerHandoutItem` ADD CONSTRAINT `EditionVolunteerHandoutItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerHandoutItem` ADD CONSTRAINT `EditionVolunteerHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerHandoutItem` ADD CONSTRAINT `EditionVolunteerHandoutItem_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtistHandoutItem` ADD CONSTRAINT `EditionArtistHandoutItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtistHandoutItem` ADD CONSTRAINT `EditionArtistHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerHandoutItem` ADD CONSTRAINT `EditionOrganizerHandoutItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerHandoutItem` ADD CONSTRAINT `EditionOrganizerHandoutItem_organizerId_fkey` FOREIGN KEY (`organizerId`) REFERENCES `EditionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerHandoutItem` ADD CONSTRAINT `EditionOrganizerHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerQuota` ADD CONSTRAINT `EditionOrganizerQuota_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerQuota` ADD CONSTRAINT `EditionOrganizerQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerQuota` ADD CONSTRAINT `EditionOrganizerQuota_organizerId_fkey` FOREIGN KEY (`organizerId`) REFERENCES `EditionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerQuota` ADD CONSTRAINT `EditionVolunteerQuota_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerQuota` ADD CONSTRAINT `EditionVolunteerQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerQuota` ADD CONSTRAINT `EditionVolunteerQuota_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtistQuota` ADD CONSTRAINT `EditionArtistQuota_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtistQuota` ADD CONSTRAINT `EditionArtistQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtistQuota` ADD CONSTRAINT `EditionArtistQuota_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierQuota` ADD CONSTRAINT `TicketingTierQuota_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierQuota` ADD CONSTRAINT `TicketingTierQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierHandoutItem` ADD CONSTRAINT `TicketingTierHandoutItem_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierHandoutItem` ADD CONSTRAINT `TicketingTierHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierOption` ADD CONSTRAINT `TicketingTierOption_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierOption` ADD CONSTRAINT `TicketingTierOption_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionQuota` ADD CONSTRAINT `TicketingOptionQuota_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionQuota` ADD CONSTRAINT `TicketingOptionQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionHandoutItem` ADD CONSTRAINT `TicketingOptionHandoutItem_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionHandoutItem` ADD CONSTRAINT `TicketingOptionHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOption` ADD CONSTRAINT `TicketingOption_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOption` ADD CONSTRAINT `TicketingOption_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrder` ADD CONSTRAINT `TicketingOrder_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrder` ADD CONSTRAINT `TicketingOrder_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItem` ADD CONSTRAINT `TicketingOrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `TicketingOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItem` ADD CONSTRAINT `TicketingOrderItem_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomField` ADD CONSTRAINT `TicketingTierCustomField_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomField` ADD CONSTRAINT `TicketingTierCustomField_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldAssociation` ADD CONSTRAINT `TicketingTierCustomFieldAssociation_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldAssociation` ADD CONSTRAINT `TicketingTierCustomFieldAssociation_customFieldId_fkey` FOREIGN KEY (`customFieldId`) REFERENCES `TicketingTierCustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldQuota` ADD CONSTRAINT `TicketingTierCustomFieldQuota_customFieldId_fkey` FOREIGN KEY (`customFieldId`) REFERENCES `TicketingTierCustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldQuota` ADD CONSTRAINT `TicketingTierCustomFieldQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldHandoutItem` ADD CONSTRAINT `TicketingTierCustomFieldHandoutItem_customFieldId_fkey` FOREIGN KEY (`customFieldId`) REFERENCES `TicketingTierCustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldHandoutItem` ADD CONSTRAINT `TicketingTierCustomFieldHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItemOption` ADD CONSTRAINT `TicketingOrderItemOption_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `TicketingOrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItemOption` ADD CONSTRAINT `TicketingOrderItemOption_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingCounter` ADD CONSTRAINT `TicketingCounter_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingCounter` ADD CONSTRAINT `TicketingCounter_lastActorId_fkey` FOREIGN KEY (`lastActorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntryValidationLog` ADD CONSTRAINT `EntryValidationLog_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntryValidationLog` ADD CONSTRAINT `EntryValidationLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMealSelection` ADD CONSTRAINT `VolunteerMealSelection_volunteerId_fkey` FOREIGN KEY (`volunteerId`) REFERENCES `EditionVolunteerApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMealSelection` ADD CONSTRAINT `VolunteerMealSelection_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizerMealSelection` ADD CONSTRAINT `OrganizerMealSelection_editionOrganizerId_fkey` FOREIGN KEY (`editionOrganizerId`) REFERENCES `EditionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizerMealSelection` ADD CONSTRAINT `OrganizerMealSelection_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMealHandoutItem` ADD CONSTRAINT `VolunteerMealHandoutItem_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMealHandoutItem` ADD CONSTRAINT `VolunteerMealHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierMeal` ADD CONSTRAINT `TicketingTierMeal_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierMeal` ADD CONSTRAINT `TicketingTierMeal_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionMeal` ADD CONSTRAINT `TicketingOptionMeal_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionMeal` ADD CONSTRAINT `TicketingOptionMeal_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItemMeal` ADD CONSTRAINT `TicketingOrderItemMeal_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `TicketingOrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItemMeal` ADD CONSTRAINT `TicketingOrderItemMeal_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiErrorLog` ADD CONSTRAINT `ApiErrorLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

