-- 营养评估表：与现有 user / service_request / health_data 配合使用
-- 执行前请确认已存在 user、service_request、health_data 表（及相应 user_id 外键约定）

USE nutrition_system;

-- 若 health_data 尚无 activity_level、nutrition_goal，可一并补齐（与 backend/app/models/health_data.go 对齐）
-- ALTER TABLE `health_data` ADD COLUMN `activity_level` VARCHAR(32) NULL COMMENT 'sedentary|lightly_active|moderately_active|very_active' AFTER `allergy_history`;
-- ALTER TABLE `health_data` ADD COLUMN `nutrition_goal` VARCHAR(64) NULL COMMENT '用户端档案中的通用营养目标' AFTER `activity_level`;

CREATE TABLE IF NOT EXISTS `nutrition_evaluation` (
  `evaluation_id`     VARCHAR(32)  NOT NULL COMMENT '主键，如 EV+时间戳+后缀',
  `user_id`           VARCHAR(20)  NOT NULL COMMENT '被评估用户',
  `dietitian_id`      VARCHAR(20)  NOT NULL COMMENT '出具评估的规划师',
  `service_request_id` VARCHAR(32) NULL COMMENT '可选：绑定某次服务申请，便于与膳食计划衔接',
  `source`            VARCHAR(20)  NOT NULL DEFAULT 'professional' COMMENT 'professional|auto 预留自动评估',
  `status`            VARCHAR(20)  NOT NULL DEFAULT 'submitted' COMMENT 'draft|submitted|superseded',

  -- 评估时点的量化摘要（便于列表与过期判断）
  `bmi`               DECIMAL(5,2) NULL,
  `energy_need_kcal`  INT          NULL COMMENT '可选：估算日能量需求',
  `nutrition_status`  VARCHAR(32)  NULL COMMENT '如 normal|excess_energy|low_energy|imbalanced 等枚举或简短标签',

  -- 结构化结论（规划师填写为主；后续可由规则预填）
  `body_composition_text`   TEXT NULL COMMENT '体成分/BMI/腰围等综合判断',
  `dietary_pattern_text`    TEXT NULL COMMENT '饮食结构：供能比、多样性、油盐糖等',
  `micronutrient_text`      TEXT NULL COMMENT '微量营养素/膳食纤维等（数据不足可说明依据有限）',
  `risks_text`              TEXT NULL COMMENT '疾病/用药/过敏相关饮食风险与禁忌摘要',
  `priority_issues_json`    TEXT NULL COMMENT 'JSON 数组：主要问题列表',
  `professional_conclusion` TEXT NOT NULL COMMENT '给用户看的专业评估结论',
  `plan_recommendations`    TEXT NULL COMMENT '对后续膳食设计的约束与优先事项',

  -- 审计快照：写入时冻结关键输入，避免用户改档案后历史评估语义漂移
  `input_snapshot_json`     TEXT NULL COMMENT 'JSON：如 height,weight,activity_level,service_diet_goal,health_data_id 等',

  `valid_until`         DATE NULL COMMENT '可选：有效期，用于规划师面板「已过期」提示',
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`evaluation_id`),
  KEY `idx_nutrition_eval_user_time` (`user_id`, `created_at`),
  KEY `idx_nutrition_eval_request` (`service_request_id`),
  KEY `idx_nutrition_eval_dietitian` (`dietitian_id`),
  CONSTRAINT `fk_ne_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='个性化营养评估与需求分析（先评估、后配餐的业务载体）';
