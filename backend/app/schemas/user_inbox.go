package schemas

import "time"

// UserInboxMessage 用户首页消息（聚合）
type UserInboxMessage struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Title   string `json:"title"`
	Summary string `json:"summary,omitempty"`
	RefID   string `json:"ref_id"`
	Time    string `json:"time"` // RFC3339
}

// FormatUserInboxTime 统一时间序列化
func FormatUserInboxTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(time.RFC3339)
}
