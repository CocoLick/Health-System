package schemas

import "time"

// HealthEducationCreate 创建草稿
type HealthEducationCreate struct {
	Title         string   `json:"title"`
	Summary       string   `json:"summary"`
	Body          string   `json:"body"`
	Category      string   `json:"category"`
	Visibility    string   `json:"visibility"` // public | assigned
	TargetUserIDs []string `json:"target_user_ids"`
}

// HealthEducationUpdate 更新草稿或已发布内容的基本字段
type HealthEducationUpdate struct {
	Title         string   `json:"title"`
	Summary       string   `json:"summary"`
	Body          string   `json:"body"`
	Category      string   `json:"category"`
	Visibility    string   `json:"visibility"`
	TargetUserIDs []string `json:"target_user_ids"`
}

// HealthEducationPublish 发布时最终确定可见范围（当前无审核流：直接已发布 + 审核通过）
type HealthEducationPublish struct {
	Visibility    string   `json:"visibility" binding:"required"` // public | assigned
	TargetUserIDs []string `json:"target_user_ids"`
}

// HealthEducationListQuery 列表筛选
type HealthEducationListQuery struct {
	ContentStatus string `form:"content_status"` // draft | published | all
	Visibility    string `form:"visibility"`     // public | assigned | all
}

// HealthEducationReaderQuery 用户端阅读列表筛选
type HealthEducationReaderQuery struct {
	Visibility string `form:"visibility"` // all | public | assigned
}

// HealthEducationResponse 列表/详情返回
type HealthEducationResponse struct {
	HEID            string        `json:"he_id"`
	DietitianID     string        `json:"dietitian_id"`
	DietitianName   string        `json:"dietitian_name,omitempty"`
	Title           string        `json:"title"`
	Summary         string        `json:"summary"`
	Body            string        `json:"body,omitempty"`
	Category        string        `json:"category"`
	Visibility      string        `json:"visibility"`
	TargetUserIDs   []string      `json:"target_user_ids,omitempty"`
	TargetUsers     []HEUserBrief `json:"target_users,omitempty"`
	ContentStatus   string        `json:"content_status"`
	AuditStatus     string        `json:"audit_status"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

// HEUserBrief 指派对象摘要
type HEUserBrief struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}
