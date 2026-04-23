package models

import "time"

// UserFeedback 用户意见与建议反馈工单
type UserFeedback struct {
	FeedbackID         string     `gorm:"column:feedback_id;primaryKey;size:32" json:"feedback_id"`
	UserID             string     `gorm:"column:user_id;size:32;not null;index" json:"user_id"`
	Category           string     `gorm:"column:category;size:32;not null;index" json:"category"` // diet_plan | dietitian_service | system
	Title              string     `gorm:"column:title;size:200;not null" json:"title"`
	Content            string     `gorm:"column:content;type:text;not null" json:"content"`
	Rating             *int       `gorm:"column:rating" json:"rating,omitempty"`
	RelatedPlanID      string     `gorm:"column:related_plan_id;size:32;index" json:"related_plan_id"`
	TargetDietitianID  string     `gorm:"column:target_dietitian_id;size:32;index" json:"target_dietitian_id"`
	Status             string     `gorm:"column:status;size:20;not null;default:pending;index" json:"status"` // pending | replied | closed
	FirstReplyAt       *time.Time `gorm:"column:first_reply_at" json:"first_reply_at,omitempty"`
	ClosedAt           *time.Time `gorm:"column:closed_at" json:"closed_at,omitempty"`
	CreatedAt          time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt          time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (UserFeedback) TableName() string {
	return "user_feedback"
}

// FeedbackReply 反馈对话记录
type FeedbackReply struct {
	ReplyID      string    `gorm:"column:reply_id;primaryKey;size:32" json:"reply_id"`
	FeedbackID   string    `gorm:"column:feedback_id;size:32;not null;index" json:"feedback_id"`
	SenderType   string    `gorm:"column:sender_type;size:20;not null" json:"sender_type"` // user | dietitian | admin
	SenderUserID string    `gorm:"column:sender_user_id;size:32;not null" json:"sender_user_id"`
	Body         string    `gorm:"column:body;type:text;not null" json:"body"`
	CreatedAt    time.Time `gorm:"column:created_at" json:"created_at"`
}

func (FeedbackReply) TableName() string {
	return "feedback_reply"
}
