-- 餐次执行完成标记（与用户「记入饮食」后同步）
ALTER TABLE `meals` ADD COLUMN `executed` TINYINT(1) NOT NULL DEFAULT 0;
