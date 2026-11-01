-- CreateTable
CREATE TABLE `CandidatEvenement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source` VARCHAR(40) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `identifiantSource` VARCHAR(60) NULL,
    `titre` VARCHAR(300) NOT NULL,
    `debut` DATETIME(3) NULL,
    `jours` INTEGER NULL,
    `pays` VARCHAR(120) NULL,
    `lieu` VARCHAR(300) NULL,
    `adresse` TEXT NULL,
    `verdict` ENUM('A_EXAMINER', 'CONVENTION', 'REFUSE') NOT NULL DEFAULT 'A_EXAMINER',
    `verdictLe` DATETIME(3) NULL,
    `decouvertLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `majLe` DATETIME(3) NOT NULL,
    UNIQUE INDEX `CandidatEvenement_url_key`(`url`),
    INDEX `CandidatEvenement_source_verdict_idx`(`source`, `verdict`),
    INDEX `CandidatEvenement_verdict_debut_idx`(`verdict`, `debut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
