-- Admin date+hour slot availability overrides.
CREATE TABLE `SlotOverride` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `startHour` INTEGER NOT NULL,
    `mode` ENUM('BLOCKED', 'FORCE_OPEN') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `SlotOverride_date_startHour_key` ON `SlotOverride`(`date`, `startHour`);
CREATE INDEX `SlotOverride_date_idx` ON `SlotOverride`(`date`);
