package schemas

// AdminAuditHistoryItem 管理员审核历史条目（基础版：三类业务当前通过/驳回记录汇总）
type AdminAuditHistoryItem struct {
	ID         string `json:"id"`
	SourceID   string `json:"source_id"`
	SourceType string `json:"source_type"` // diet_plan | health_education | ingredient_submission
	Title      string `json:"title"`
	Type       string `json:"type"`   // 膳食计划 | 健康文章 | 新增食材
	Status     string `json:"status"` // 通过 | 驳回
	Auditor    string `json:"auditor"`
	AuditTime  string `json:"audit_time"`
	Reason     string `json:"reason,omitempty"`
}
