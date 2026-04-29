-- 角色拆分收口：删除 user 表中仅规划师使用的字段（兼容旧版 MySQL）
ALTER TABLE `user`
  DROP COLUMN `title`;

ALTER TABLE `user`
  DROP COLUMN `specialty`;

ALTER TABLE `user`
  DROP COLUMN `contact`;