-- 创建数据库
CREATE DATABASE IF NOT EXISTS nutrition_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE nutrition_system;

-- 创建用户表
CREATE TABLE IF NOT EXISTS `user` (
    `user_id` VARCHAR(20) PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `gender` VARCHAR(10) NOT NULL,
    `age` INT NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `role_type` VARCHAR(20) NOT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL
);



-- 创建健康数据表
CREATE TABLE IF NOT EXISTS `health_data` (
    `data_id` VARCHAR(20) PRIMARY KEY,
    `user_id` VARCHAR(20) NOT NULL,
    `height` DECIMAL(5,2) NOT NULL,
    `weight` DECIMAL(5,2) NOT NULL,
    `blood_pressure` VARCHAR(20) NOT NULL,
    `blood_sugar` DECIMAL(5,2) NOT NULL,
    `heart_rate` INT NOT NULL,
    `allergy_history` TEXT NOT NULL,
    `recorded_at` DATETIME NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`)
);

-- 创建营养记录表
CREATE TABLE IF NOT EXISTS `nutrition_record` (
    `record_id` VARCHAR(20) PRIMARY KEY,
    `user_id` VARCHAR(20) NOT NULL,
    `intake_date` DATE NOT NULL,
    `intake_time` VARCHAR(20) NOT NULL,
    `food_name` VARCHAR(100) NOT NULL,
    `calories` DECIMAL(6,2) NOT NULL,
    `protein` DECIMAL(6,2) NOT NULL,
    `carbohydrate` DECIMAL(6,2) NOT NULL,
    `fat` DECIMAL(6,2) NOT NULL,
    `fiber` DECIMAL(6,2) NOT NULL,
    `recorded_at` DATETIME NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`)
);

-- 创建膳食计划表
CREATE TABLE IF NOT EXISTS `diet_plan` (
    `plan_id` VARCHAR(20) PRIMARY KEY,
    `user_id` VARCHAR(20) NOT NULL,
    `dietitian_id` VARCHAR(20) NOT NULL,
    `plan_title` VARCHAR(100) NOT NULL,
    `diet_goal` VARCHAR(50) NOT NULL,
    `plan_content` TEXT NOT NULL,
    `audit_status` VARCHAR(20) NOT NULL,
    `published_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`),
    FOREIGN KEY (`dietitian_id`) REFERENCES `user`(`user_id`)
);

-- 创建食材表
CREATE TABLE IF NOT EXISTS `ingredient` (
    `ingredient_id` VARCHAR(20) PRIMARY KEY,
    `ingredient_name` VARCHAR(100) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `nutrition_detail` TEXT NOT NULL,
    `unit` VARCHAR(20) NOT NULL,
    `calories_per_100g` DECIMAL(6,2) NOT NULL,
    `status` VARCHAR(20) NOT NULL
);

-- 创建计划食材关联表
CREATE TABLE IF NOT EXISTS `plan_ingredient_rel` (
    `rel_id` VARCHAR(20) PRIMARY KEY,
    `plan_id` VARCHAR(20) NOT NULL,
    `ingredient_id` VARCHAR(20) NOT NULL,
    FOREIGN KEY (`plan_id`) REFERENCES `diet_plan`(`plan_id`),
    FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`ingredient_id`)
);

-- 创建健康教育表
CREATE TABLE IF NOT EXISTS `health_edu` (
    `content_id` VARCHAR(20) PRIMARY KEY,
    `dietitian_id` VARCHAR(20) NOT NULL,
    `article_title` VARCHAR(100) NOT NULL,
    `health_category` VARCHAR(50) NOT NULL,
    `content_detail` TEXT NOT NULL,
    `audit_status` VARCHAR(20) NOT NULL,
    `published_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    FOREIGN KEY (`dietitian_id`) REFERENCES `user`(`user_id`)
);

-- 创建意见反馈表
CREATE TABLE IF NOT EXISTS `feedback` (
    `feedback_id` VARCHAR(20) PRIMARY KEY,
    `user_id` VARCHAR(20) NOT NULL,
    `dietitian_id` VARCHAR(20) NOT NULL,
    `feedback_title` VARCHAR(100) NOT NULL,
    `feedback_content` TEXT NOT NULL,
    `feedback_type` VARCHAR(50) NOT NULL,
    `handle_status` VARCHAR(20) NOT NULL,
    `feedback_time` DATETIME NOT NULL,
    `reply_content` TEXT NULL,
    `replied_at` DATETIME NULL,
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`),
    FOREIGN KEY (`dietitian_id`) REFERENCES `user`(`user_id`)
);

-- 插入测试数据
-- 插入管理员用户
INSERT INTO `user` (`user_id`, `username`, `password`, `phone`, `gender`, `age`, `email`, `role_type`, `created_at`, `updated_at`)
VALUES ('U20260325001', 'admin', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '13800138000', '男', 30, 'admin@example.com', 'admin', NOW(), NOW());

-- 插入测试用户
INSERT INTO `user` (`user_id`, `username`, `password`, `phone`, `gender`, `age`, `email`, `role_type`, `created_at`, `updated_at`)
VALUES ('U20260325002', 'test', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '13800138001', '女', 25, 'test@example.com', 'user', NOW(), NOW());

-- 插入测试规划师（作为用户角色）
INSERT INTO `user` (`user_id`, `username`, `password`, `phone`, `gender`, `age`, `email`, `role_type`, `created_at`, `updated_at`)
VALUES ('D20260325001', 'D20260325001', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', '13800138002', '男', 35, 'dietitian@example.com', 'dietitian', NOW(), NOW());
