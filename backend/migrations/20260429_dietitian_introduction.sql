ALTER TABLE `dietitian`
    ADD COLUMN IF NOT EXISTS `introduction` TEXT NULL AFTER `specialty`;
