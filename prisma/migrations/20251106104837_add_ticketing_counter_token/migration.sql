/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `TicketingCounter` will be added. If there are existing duplicate values, this will fail.
  - The required column `token` was added to the `TicketingCounter` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE `TicketingCounter` ADD COLUMN `token` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `TicketingCounter_token_key` ON `TicketingCounter`(`token`);

-- CreateIndex
CREATE INDEX `TicketingCounter_token_idx` ON `TicketingCounter`(`token`);
