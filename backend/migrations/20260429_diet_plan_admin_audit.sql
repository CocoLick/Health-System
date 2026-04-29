ALTER TABLE diet_plan
  ADD COLUMN audit_note VARCHAR(500) NULL AFTER audit_status,
  ADD COLUMN audited_by VARCHAR(20) NULL AFTER audit_note,
  ADD COLUMN audited_at DATETIME NULL AFTER audited_by;

