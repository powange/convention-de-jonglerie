-- CreateIndex
CREATE INDEX `ApiErrorLog_errorType_createdAt_idx` ON `ApiErrorLog`(`errorType`, `createdAt`);

-- CreateIndex
CREATE INDEX `ApiErrorLog_errorType_message_idx` ON `ApiErrorLog`(`errorType`, `message`(191));
