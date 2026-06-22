-- CreateTable
CREATE TABLE `AiConfig` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `provider` VARCHAR(191) NOT NULL DEFAULT 'lmstudio',
    `lmstudioBaseUrl` VARCHAR(191) NOT NULL DEFAULT 'http://host.docker.internal:1234',
    `lmstudioModelId` VARCHAR(191) NULL,
    `lmstudioTextModelId` VARCHAR(191) NULL,
    `anthropicApiKey` TEXT NULL,
    `ollamaBaseUrl` VARCHAR(191) NOT NULL DEFAULT 'http://localhost:11434',
    `ollamaModel` VARCHAR(191) NOT NULL DEFAULT 'llava',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiModel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiModel_provider_idx`(`provider`),
    UNIQUE INDEX `AiModel_provider_modelId_key`(`provider`, `modelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
