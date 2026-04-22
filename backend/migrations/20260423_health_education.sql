-- 健康教育内容表（与规划师「文章」合并；项目启动时 GORM AutoMigrate 会同步结构，本文件便于手工审阅）
-- visibility: public | assigned
-- content_status: draft | published
-- audit_status: none（当前无审核流，发布时写 approved 预留后续 pending_review）

CREATE TABLE IF NOT EXISTS `health_education` (
  `he_id` varchar(32) NOT NULL,
  `dietitian_id` varchar(32) NOT NULL,
  `title` varchar(200) NOT NULL,
  `summary` varchar(500) DEFAULT '',
  `body` longtext NOT NULL,
  `category` varchar(50) DEFAULT '',
  `visibility` varchar(20) NOT NULL DEFAULT 'public',
  `target_user_ids` text,
  `content_status` varchar(20) NOT NULL DEFAULT 'draft',
  `audit_status` varchar(20) NOT NULL DEFAULT 'none',
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`he_id`),
  KEY `idx_health_education_dietitian` (`dietitian_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
