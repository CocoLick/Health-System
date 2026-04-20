package services

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"

	"gorm.io/gorm"
)

// ServiceRequestService 服务请求服务
type ServiceRequestService struct {
	db *gorm.DB
}

// NewServiceRequestService 创建服务请求服务实例
func NewServiceRequestService() *ServiceRequestService {
	return &ServiceRequestService{db: config.DB}
}

// CreateServiceRequest 创建服务请求
func (s *ServiceRequestService) CreateServiceRequest(userID string, req schemas.CreateServiceRequestRequest) (*models.ServiceRequest, error) {
	// 生成请求ID
	requestID := fmt.Sprintf("SR%d%s", time.Now().Unix(), userID[len(userID)-4:])

	// 转换HealthData为JSON字符串
	healthDataJSON, err := json.Marshal(req.HealthData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal health data: %w", err)
	}

	// 创建服务请求
	serviceRequest := &models.ServiceRequest{
		RequestID:    requestID,
		UserID:       userID,
		DietitianID:  req.DietitianID,
		ServiceType:  req.ServiceType,
		DietGoal:     req.DietGoal,
		OtherGoal:    req.OtherGoal,
		HealthData:   string(healthDataJSON),
		Status:       "pending",
		CreateTime:   time.Now(),
		UpdateTime:   time.Now(),
	}

	// 保存到数据库
	if err := s.db.Create(serviceRequest).Error; err != nil {
		return nil, fmt.Errorf("failed to create service request: %w", err)
	}

	return serviceRequest, nil
}

// GetUserServiceRequests 获取用户的服务请求列表
func (s *ServiceRequestService) GetUserServiceRequests(userID string) ([]models.ServiceRequest, error) {
	var requests []models.ServiceRequest

	if err := s.db.Where("user_id = ?", userID).Order("create_time DESC").Find(&requests).Error; err != nil {
		return nil, fmt.Errorf("failed to get user service requests: %w", err)
	}

	return requests, nil
}

// GetServiceRequestByID 根据ID获取服务请求
func (s *ServiceRequestService) GetServiceRequestByID(requestID string) (*models.ServiceRequest, error) {
	var request models.ServiceRequest

	if err := s.db.Where("request_id = ?", requestID).First(&request).Error; err != nil {
		return nil, fmt.Errorf("failed to get service request: %w", err)
	}

	return &request, nil
}

// CancelServiceRequest 取消服务请求
func (s *ServiceRequestService) CancelServiceRequest(requestID string, userID string) error {
	// 获取服务请求
	request, err := s.GetServiceRequestByID(requestID)
	if err != nil {
		return err
	}

	// 验证权限
	if request.UserID != userID {
		return fmt.Errorf("unauthorized: user %s cannot cancel request %s", userID, requestID)
	}

	// 验证状态
	if request.Status != "pending" {
		return fmt.Errorf("cannot cancel request with status %s", request.Status)
	}

	// 更新状态
	request.Status = "cancelled"
	request.UpdateTime = time.Now()

	// 保存到数据库
	if err := s.db.Save(request).Error; err != nil {
		return fmt.Errorf("failed to cancel service request: %w", err)
	}

	return nil
}
