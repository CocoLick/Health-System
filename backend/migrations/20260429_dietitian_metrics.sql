ALTER TABLE `dietitian`
    ADD COLUMN IF NOT EXISTS `current_service_user_count` INT NOT NULL DEFAULT 0 AFTER `contact`,
    ADD COLUMN IF NOT EXISTS `historical_service_user_count` INT NOT NULL DEFAULT 0 AFTER `current_service_user_count`,
    ADD COLUMN IF NOT EXISTS `historical_avg_rating` DECIMAL(3,1) NOT NULL DEFAULT 0.0 AFTER `historical_service_user_count`,
    ADD COLUMN IF NOT EXISTS `rating_count` INT NOT NULL DEFAULT 0 AFTER `historical_avg_rating`;

CREATE INDEX IF NOT EXISTS `idx_service_request_dietitian_status_user`
    ON `service_request` (`dietitian_id`, `status`, `user_id`);

CREATE INDEX IF NOT EXISTS `idx_user_feedback_target_dietitian_rating`
    ON `user_feedback` (`target_dietitian_id`, `rating`);
