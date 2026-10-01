-- Track which account created a reservation (member, group organizer, or admin).
ALTER TABLE `Reservation` ADD COLUMN `createdById` VARCHAR(191) NULL;
