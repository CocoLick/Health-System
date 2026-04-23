-- 健康数据历史快照表（方案A）
-- 说明：项目启动时 GORM AutoMigrate 会自动建表，此文件用于手工审阅/执行。

CREATE TABLE IF NOT EXISTS `health_data_history` (
  `history_id` VARCHAR(40) NOT NULL COMMENT '历史快照ID',
  `data_id` VARCHAR(40) NULL COMMENT '关联主表 health_data.data_id',
  `user_id` VARCHAR(50) NOT NULL COMMENT '用户ID',
  `gender` VARCHAR(20) NULL,
  `age` INT NULL,
  `height` DOUBLE NULL,
  `weight` DOUBLE NULL,
  `heart_rate` INT NULL,
  `blood_pressure` VARCHAR(50) NULL,
  `blood_sugar` DOUBLE NULL,
  `allergy_history` TEXT NULL,
  `activity_level` VARCHAR(32) NULL,
  `nutrition_goal` VARCHAR(64) NULL,
  `source` VARCHAR(24) NULL COMMENT 'submit|update',
  `snapshot_at` DATETIME NOT NULL COMMENT '快照时间',
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`history_id`),
  KEY `idx_hdh_user` (`user_id`),
  KEY `idx_hdh_data` (`data_id`),
  KEY `idx_hdh_snapshot_at` (`snapshot_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='健康数据历史快照';
