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
	RequestID     string                 `json:"request_id"`
	UserID        string                 `json:"user_id"`
	DietitianID   string                 `json:"dietitian_id"`
	DietitianName string                 `json:"dietitian_name"` // 展示用：优先 name，否则 username
	ServiceType   string                 `json:"service_type"`
	DietGoal      string                 `json:"diet_goal"`
	OtherGoal     string                 `json:"other_goal"`
	HealthData    map[string]interface{} `json:"health_data"`
	Status        string                 `json:"status"`
	CreateTime    time.Time              `json:"create_time"`
	UpdateTime    time.Time              `json:"update_time"`
}

// ServiceRequestListResponse 服务请求列表的响应结构
type ServiceRequestListResponse struct {
	RequestID     string                 `json:"request_id"`
	UserID        string                 `json:"user_id"`
	DietitianID   string                 `json:"dietitian_id"`
	DietitianName string                 `json:"dietitian_name"`
	ServiceType   string                 `json:"service_type"`
	DietGoal      string                 `json:"diet_goal"`
	OtherGoal     string                 `json:"other_goal"`
	HealthData    map[string]interface{} `json:"health_data"`
	Status        string                 `json:"status"`
	CreateTime    time.Time              `json:"create_time"`
	UpdateTime    time.Time              `json:"update_time"`
}

// DietitianServiceUser 规划师服务用户的响应结构
type DietitianServiceUser struct {
	UserID          string `json:"user_id"`
	Username        string `json:"username"`
	UsernameInitial string `json:"username_initial"`
	HasProfile      bool   `json:"has_profile"`
	HasEvaluation   bool   `json:"has_evaluation"`
	HasPlan         bool   `json:"has_plan"`
	LastServiceTime string `json:"last_service_time"`
}
