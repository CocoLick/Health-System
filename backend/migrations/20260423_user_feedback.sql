-- 用户意见反馈与回复（GORM AutoMigrate 会建表，本文件便于审阅与手工执行）

CREATE TABLE IF NOT EXISTS `user_feedback` (
  `feedback_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `category` varchar(32) NOT NULL COMMENT 'diet_plan|dietitian_service|system',
  `title` varchar(200) NOT NULL,
  `content` text NOT NULL,
  `rating` int DEFAULT NULL,
  `related_plan_id` varchar(32) DEFAULT '',
  `target_dietitian_id` varchar(32) DEFAULT '',
  `status` varchar(20) NOT NULL DEFAULT 'pending' COMMENT 'pending|replied|closed',
  `first_reply_at` datetime(3) DEFAULT NULL,
  `closed_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`feedback_id`),
  KEY `idx_fb_user` (`user_id`),
  KEY `idx_fb_target_status` (`target_dietitian_id`,`status`),
  KEY `idx_fb_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `feedback_reply` (
  `reply_id` varchar(32) NOT NULL,
  `feedback_id` varchar(32) NOT NULL,
  `sender_type` varchar(20) NOT NULL COMMENT 'user|dietitian|admin',
  `sender_user_id` varchar(32) NOT NULL,
  `body` text NOT NULL,
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`reply_id`),
  KEY `idx_fr_feedback` (`feedback_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
