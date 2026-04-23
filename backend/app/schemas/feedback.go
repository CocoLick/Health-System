package schemas

import "time"

// FeedbackCreate 用户提交反馈（用户端接口，供后续接入；也可用于联调）
type FeedbackCreate struct {
	Category           string `json:"category" binding:"required"` // diet_plan | dietitian_service | system
	Title              string `json:"title" binding:"required"`
	Content            string `json:"content" binding:"required"`
	Rating             *int   `json:"rating"`
	RelatedPlanID      string `json:"related_plan_id"`
	TargetDietitianID  string `json:"target_dietitian_id"` // dietitian_service 时必填
}

// FeedbackDietitianListQuery 规划师列表筛选
type FeedbackDietitianListQuery struct {
	Status string `form:"status"` // pending | replied | all ；replied 含 closed
}

// FeedbackReplyCreate 规划师回复
type FeedbackReplyCreate struct {
	Body string `json:"body" binding:"required"`
}

// FeedbackUserListItem 用户端「我的反馈」列表项
type FeedbackUserListItem struct {
	FeedbackID        string    `json:"feedback_id"`
	Category          string    `json:"category"`
	CategoryLabel     string    `json:"category_label"`
	Title             string    `json:"title"`
	ContentPreview    string    `json:"content_preview"`
	Status            string    `json:"status"`
	StatusLabel       string    `json:"status_label"`
	RelatedPlanID     string    `json:"related_plan_id,omitempty"`
	TargetDietitianID string    `json:"target_dietitian_id,omitempty"`
	RepliesCount      int64     `json:"replies_count"`
	LastReplyPreview  string    `json:"last_reply_preview,omitempty"`
	LastReplyAt       *time.Time `json:"last_reply_at,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// FeedbackListItem 规划师列表项
type FeedbackListItem struct {
	FeedbackID      string    `json:"feedback_id"`
	UserID          string    `json:"user_id"`
	Username        string    `json:"username"`
	UserInitial     string    `json:"user_initial"`
	Category        string    `json:"category"`
	CategoryLabel   string    `json:"category_label"`
	Title           string    `json:"title"`
	ContentPreview  string    `json:"content_preview"`
	Status          string    `json:"status"`
	StatusLabel     string    `json:"status_label"`
	RelatedPlanID   string    `json:"related_plan_id,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// FeedbackReplyItem 单条回复
type FeedbackReplyItem struct {
	ReplyID      string    `json:"reply_id"`
	SenderType   string    `json:"sender_type"`
	SenderUserID string    `json:"sender_user_id"`
	SenderName   string    `json:"sender_name"`
	Body         string    `json:"body"`
	CreatedAt    time.Time `json:"created_at"`
}

// FeedbackDetailResponse 规划师查看详情
type FeedbackDetailResponse struct {
	FeedbackID        string               `json:"feedback_id"`
	UserID            string               `json:"user_id"`
	Username          string               `json:"username"`
	Category          string               `json:"category"`
	CategoryLabel     string               `json:"category_label"`
	Title             string               `json:"title"`
	Content           string               `json:"content"`
	Rating            *int                 `json:"rating,omitempty"`
	RelatedPlanID     string               `json:"related_plan_id,omitempty"`
	PlanTitle         string               `json:"plan_title,omitempty"`
	Status            string               `json:"status"`
	StatusLabel       string               `json:"status_label"`
	FirstReplyAt      *time.Time           `json:"first_reply_at,omitempty"`
	CreatedAt         time.Time            `json:"created_at"`
	UpdatedAt         time.Time            `json:"updated_at"`
	Replies           []FeedbackReplyItem  `json:"replies"`
}
