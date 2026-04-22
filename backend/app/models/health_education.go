package models

import "time"

// HealthEducation 规划师健康教育内容（与「文章」合并为同一实体；预留审核字段）
type HealthEducation struct {
	HEID            string    `gorm:"column:he_id;primaryKey;size:32" json:"he_id"`
	DietitianID     string    `gorm:"column:dietitian_id;size:32;not null;index" json:"dietitian_id"`
	Title           string    `gorm:"column:title;size:200;not null" json:"title"`
	Summary         string    `gorm:"column:summary;size:500" json:"summary"`
	Body            string    `gorm:"column:body;type:longtext;not null" json:"body"`
	Category        string    `gorm:"column:category;size:50" json:"category"`
	Visibility      string    `gorm:"column:visibility;size:20;not null;default:public" json:"visibility"` // public | assigned
	TargetUserIDs   string    `gorm:"column:target_user_ids;type:text" json:"target_user_ids"`           // JSON []string，assigned 时使用
	ContentStatus   string    `gorm:"column:content_status;size:20;not null;default:draft" json:"content_status"` // draft | published
	AuditStatus     string    `gorm:"column:audit_status;size:20;not null;default:none" json:"audit_status"`      // none | pending_review | approved | rejected
	CreatedAt       time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt       time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (HealthEducation) TableName() string {
	return "health_education"
}
