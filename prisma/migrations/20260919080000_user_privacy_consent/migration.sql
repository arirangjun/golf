-- Member privacy / friend-search consent columns
ALTER TABLE `User` ADD COLUMN `privacyConsentAt` DATETIME(3) NULL;
ALTER TABLE `User` ADD COLUMN `friendSearchConsent` BOOLEAN NOT NULL DEFAULT false;
