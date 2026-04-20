package models

import (
	"time"
)

// ServiceRequest 服务请求模型
type ServiceRequest struct {
	RequestID    string    `gorm:"column:request_id;primaryKey;size:20" json:"request_id"`
	UserID       string    `gorm:"column:user_id;size:20;not null;index" json:"user_id"`
	DietitianID  string    `gorm:"column:dietitian_id;size:20;not null;index" json:"dietitian_id"`
	ServiceType  string    `gorm:"column:service_type;size:50;not null" json:"service_type"`
	DietGoal     string    `gorm:"column:diet_goal;size:50;not null" json:"diet_goal"`
	OtherGoal    string    `gorm:"column:other_goal;size:255" json:"other_goal"`
	HealthData   string    `gorm:"column:health_data;type:text" json:"health_data"`
	Status       string    `gorm:"column:status;size:20;not null;default:pending" json:"status"`
	CreateTime   time.Time `gorm:"column:create_time;not null;index" json:"create_time"`
	UpdateTime   time.Time `gorm:"column:update_time;not null" json:"update_time"`
	
	// 关联 - 暂时注释掉以避免外键约束问题
	// User       User `gorm:"foreignKey:UserID;references:UserID" json:"-"`
	// Dietitian  User `gorm:"foreignKey:DietitianID;references:UserID" json:"-"`
}

// TableName 设置表名
func (ServiceRequest) TableName() string {
	return "service_request"
}
