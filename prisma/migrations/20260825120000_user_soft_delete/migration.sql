-- Soft-delete members while keeping reservation history linked to User.
ALTER TABLE `User` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `User_deletedAt_idx` ON `User`(`deletedAt`);
