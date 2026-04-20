package schemas

import (
	"time"
)

// CreateServiceRequestRequest 创建服务请求的请求结构
type CreateServiceRequestRequest struct {
	DietitianID string                 `json:"dietitian_id" binding:"required"`
	ServiceType string                 `json:"service_type" binding:"required"`
	DietGoal    string                 `json:"diet_goal" binding:"required"`
	OtherGoal   string                 `json:"other_goal"`
	HealthData  map[string]interface{} `json:"health_data"`
}

// ServiceRequestResponse 服务请求的响应结构
type ServiceRequestResponse struct {
	RequestID    string                 `json:"request_id"`
	UserID       string                 `json:"user_id"`
	DietitianID  string                 `json:"dietitian_id"`
	ServiceType  string                 `json:"service_type"`
	DietGoal     string                 `json:"diet_goal"`
	OtherGoal    string                 `json:"other_goal"`
	HealthData   map[string]interface{} `json:"health_data"`
	Status       string                 `json:"status"`
	CreateTime   time.Time              `json:"create_time"`
	UpdateTime   time.Time              `json:"update_time"`
}

// ServiceRequestListResponse 服务请求列表的响应结构
type ServiceRequestListResponse struct {
	RequestID    string    `json:"request_id"`
	DietitianID  string    `json:"dietitian_id"`
	ServiceType  string    `json:"service_type"`
	DietGoal     string    `json:"diet_goal"`
	OtherGoal    string    `json:"other_goal"`
	Status       string    `json:"status"`
	CreateTime   time.Time `json:"create_time"`
	UpdateTime   time.Time `json:"update_time"`
}
