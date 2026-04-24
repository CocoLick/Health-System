package services

import (
	"encoding/json"
	"fmt"
	"strings"
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

// DietitianNamesByIDs 批量查询规划师展示名（优先 name，否则 username）
func (s *ServiceRequestService) DietitianNamesByIDs(ids []string) map[string]string {
	seen := make(map[string]bool)
	var uniq []string
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		uniq = append(uniq, id)
	}
	out := make(map[string]string)
	if len(uniq) == 0 {
		return out
	}
	var users []models.User
	if err := s.db.Select("user_id", "name", "username").Where("user_id IN ?", uniq).Find(&users).Error; err != nil {
		return out
	}
	for _, u := range users {
		n := strings.TrimSpace(u.Name)
		if n == "" {
			n = strings.TrimSpace(u.Username)
		}
		out[u.UserID] = n
	}
	return out
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
		RequestID:   requestID,
		UserID:      userID,
		DietitianID: req.DietitianID,
		ServiceType: req.ServiceType,
		DietGoal:    req.DietGoal,
		OtherGoal:   req.OtherGoal,
		HealthData:  string(healthDataJSON),
		Status:      "pending",
		CreateTime:  time.Now(),
		UpdateTime:  time.Now(),
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

// GetDietitianServiceRequests 获取规划师的服务请求列表
func (s *ServiceRequestService) GetDietitianServiceRequests(dietitianID string) ([]models.ServiceRequest, error) {
	var requests []models.ServiceRequest

	if err := s.db.Where("dietitian_id = ?", dietitianID).Order("create_time DESC").Find(&requests).Error; err != nil {
		return nil, fmt.Errorf("failed to get dietitian service requests: %w", err)
	}

	return requests, nil
}

// ApproveServiceRequest 批准服务请求
func (s *ServiceRequestService) ApproveServiceRequest(requestID string, dietitianID string) error {
	// 获取服务请求
	request, err := s.GetServiceRequestByID(requestID)
	if err != nil {
		return err
	}

	// 验证权限
	if request.DietitianID != dietitianID {
		return fmt.Errorf("unauthorized: dietitian %s cannot approve request %s", dietitianID, requestID)
	}

	// 验证状态
	if request.Status != "pending" {
		return fmt.Errorf("cannot approve request with status %s", request.Status)
	}

	// 更新状态
	request.Status = "approved"
	request.UpdateTime = time.Now()

	// 保存到数据库
	if err := s.db.Save(request).Error; err != nil {
		return fmt.Errorf("failed to approve service request: %w", err)
	}

	return nil
}

// RejectServiceRequest 拒绝服务请求
func (s *ServiceRequestService) RejectServiceRequest(requestID string, dietitianID string) error {
	// 获取服务请求
	request, err := s.GetServiceRequestByID(requestID)
	if err != nil {
		return err
	}

	// 验证权限
	if request.DietitianID != dietitianID {
		return fmt.Errorf("unauthorized: dietitian %s cannot reject request %s", dietitianID, requestID)
	}

	// 验证状态
	if request.Status != "pending" {
		return fmt.Errorf("cannot reject request with status %s", request.Status)
	}

	// 更新状态
	request.Status = "rejected"
	request.UpdateTime = time.Now()

	// 保存到数据库
	if err := s.db.Save(request).Error; err != nil {
		return fmt.Errorf("failed to reject service request: %w", err)
	}

	return nil
}

// GetDietitianServiceUsers 获取规划师的服务用户列表
func (s *ServiceRequestService) GetDietitianServiceUsers(dietitianID string) ([]schemas.DietitianServiceUser, error) {
	// 查询所有状态为approved且dietitian_id为指定值的服务请求
	var requests []models.ServiceRequest
	if err := s.db.Where("dietitian_id = ? AND status = ?", dietitianID, "approved").Find(&requests).Error; err != nil {
		return nil, fmt.Errorf("failed to get dietitian service requests: %w", err)
	}

	// 提取唯一的user_id
	userIDs := make(map[string]bool)
	for _, req := range requests {
		userIDs[req.UserID] = true
	}

	// 转换为切片
	var uniqueUserIDs []string
	for userID := range userIDs {
		uniqueUserIDs = append(uniqueUserIDs, userID)
	}

	// 查询每个用户的信息
	var users []schemas.DietitianServiceUser
	for _, userID := range uniqueUserIDs {
		// 查询用户信息
		var user models.User
		if err := s.db.Where("user_id = ?", userID).First(&user).Error; err != nil {
			// 如果用户不存在，跳过
			continue
		}

		// 查询用户是否有健康档案
		var hasProfile bool
		var healthData models.HealthData
		healthDataErr := s.db.Where("user_id = ?", userID).First(&healthData).Error
		hasProfile = healthDataErr == nil

		// 查询本规划师是否已为该用户创建过膳食计划（同用户多规划师时须按 dietitian_id 区分）
		var hasPlan bool
		var dietPlan models.DietPlan
		dietPlanErr := s.db.Where("user_id = ? AND dietitian_id = ?", userID, dietitianID).First(&dietPlan).Error
		hasPlan = dietPlanErr == nil

		evalSvc := NewNutritionEvaluationService()
		hasEvaluation := evalSvc.UserHasEvaluationFromDietitian(dietitianID, userID)

		// 查询最近的服务时间
		var lastServiceTime string
		var lastRequest models.ServiceRequest
		if err := s.db.Where("user_id = ? AND dietitian_id = ?", userID, dietitianID).Order("update_time DESC").First(&lastRequest).Error; err == nil {
			lastServiceTime = lastRequest.UpdateTime.Format("2006-01-02")
		}

		// 创建用户对象
		serviceUser := schemas.DietitianServiceUser{
			UserID:          user.UserID,
			Username:        user.Username,
			UsernameInitial: string(user.Username[0]),
			HasProfile:      hasProfile,
			HasEvaluation:   hasEvaluation,
			HasPlan:         hasPlan,
			LastServiceTime: lastServiceTime,
		}

		users = append(users, serviceUser)
	}

	return users, nil
}
