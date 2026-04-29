CREATE TABLE IF NOT EXISTS `dietitian` (
    `account_id` VARCHAR(20) PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NULL,
    `password` VARCHAR(100) NOT NULL,
    `role_type` VARCHAR(20) NOT NULL,
    `title` VARCHAR(100) NULL,
    `specialty` VARCHAR(100) NULL,
    `contact` VARCHAR(50) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT '启用',
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    UNIQUE KEY `uk_dietitian_username` (`username`),
    KEY `idx_dietitian_role_status` (`role_type`, `status`)
);

INSERT INTO `dietitian` (
    `account_id`, `username`, `name`, `password`, `role_type`,
    `title`, `specialty`, `contact`, `status`, `created_at`, `updated_at`
)
SELECT
    u.user_id,
    u.username,
    u.name,
    u.password,
    u.role_type,
    u.title,
    u.specialty,
    COALESCE(NULLIF(u.contact, ''), u.phone),
    COALESCE(NULLIF(u.status, ''), '启用'),
    u.created_at,
    u.updated_at
FROM `user` u
WHERE u.role_type IN ('dietitian', 'admin')
  AND NOT EXISTS (
      SELECT 1
      FROM `dietitian` d
      WHERE d.account_id = u.user_id OR d.username = u.username
  );
