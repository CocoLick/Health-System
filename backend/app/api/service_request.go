package api

import (
	"encoding/json"
	"net/http"

	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"

	"github.com/gin-gonic/gin"
)

// ServiceRequestHandler 服务请求处理器
type ServiceRequestHandler struct {
	serviceRequestService *services.ServiceRequestService
}

// NewServiceRequestHandler 创建服务请求处理器实例
func NewServiceRequestHandler() *ServiceRequestHandler {
	return &ServiceRequestHandler{
		serviceRequestService: services.NewServiceRequestService(),
	}
}

// CreateServiceRequest 创建服务请求
func (h *ServiceRequestHandler) CreateServiceRequest(c *gin.Context) {
	// 从上下文获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权"})
		return
	}

	// 绑定请求数据
	var req schemas.CreateServiceRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误"})
		return
	}

	// 创建服务请求
	serviceRequest, err := h.serviceRequestService.CreateServiceRequest(userID.(string), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "创建服务请求失败"})
		return
	}

	// 构建响应
	var healthData map[string]interface{}
	if serviceRequest.HealthData != "" {
		json.Unmarshal([]byte(serviceRequest.HealthData), &healthData)
	}

	response := schemas.ServiceRequestResponse{
		RequestID:    serviceRequest.RequestID,
		UserID:       serviceRequest.UserID,
		DietitianID:  serviceRequest.DietitianID,
		ServiceType:  serviceRequest.ServiceType,
		DietGoal:     serviceRequest.DietGoal,
		OtherGoal:    serviceRequest.OtherGoal,
		HealthData:   healthData,
		Status:       serviceRequest.Status,
		CreateTime:   serviceRequest.CreateTime,
		UpdateTime:   serviceRequest.UpdateTime,
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "data": response, "message": "服务请求创建成功"})
}

// GetUserServiceRequests 获取用户的服务请求列表
func (h *ServiceRequestHandler) GetUserServiceRequests(c *gin.Context) {
	// 从上下文获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权"})
		return
	}

	// 获取服务请求列表
	requests, err := h.serviceRequestService.GetUserServiceRequests(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取服务请求列表失败"})
		return
	}

	// 构建响应
	response := make([]schemas.ServiceRequestListResponse, 0, len(requests))
	for _, req := range requests {
		// 解析HealthData JSON字符串
		var healthData map[string]interface{}
		if req.HealthData != "" {
			json.Unmarshal([]byte(req.HealthData), &healthData)
		}
		response = append(response, schemas.ServiceRequestListResponse{
			RequestID:    req.RequestID,
			UserID:       req.UserID,
			DietitianID:  req.DietitianID,
			ServiceType:  req.ServiceType,
			DietGoal:     req.DietGoal,
			OtherGoal:    req.OtherGoal,
			HealthData:   healthData,
			Status:       req.Status,
			CreateTime:   req.CreateTime,
			UpdateTime:   req.UpdateTime,
		})
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "data": response, "message": "获取服务请求列表成功"})
}

// GetServiceRequestByID 根据ID获取服务请求
func (h *ServiceRequestHandler) GetServiceRequestByID(c *gin.Context) {
	// 从上下文获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权"})
		return
	}

	// 获取请求ID
	requestID := c.Param("id")
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误"})
		return
	}

	// 获取服务请求
	request, err := h.serviceRequestService.GetServiceRequestByID(requestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取服务请求失败"})
		return
	}

	// 验证权限
	if request.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "无权访问此服务请求"})
		return
	}

	// 构建响应
	var healthData map[string]interface{}
	if request.HealthData != "" {
		json.Unmarshal([]byte(request.HealthData), &healthData)
	}

	response := schemas.ServiceRequestResponse{
		RequestID:    request.RequestID,
		UserID:       request.UserID,
		DietitianID:  request.DietitianID,
		ServiceType:  request.ServiceType,
		DietGoal:     request.DietGoal,
		OtherGoal:    request.OtherGoal,
		HealthData:   healthData,
		Status:       request.Status,
		CreateTime:   request.CreateTime,
		UpdateTime:   request.UpdateTime,
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "data": response, "message": "获取服务请求成功"})
}

// CancelServiceRequest 取消服务请求
func (h *ServiceRequestHandler) CancelServiceRequest(c *gin.Context) {
	// 从上下文获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权"})
		return
	}

	// 获取请求ID
	requestID := c.Param("id")
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误"})
		return
	}

	// 取消服务请求
	err := h.serviceRequestService.CancelServiceRequest(requestID, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "取消服务请求失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "服务请求已取消"})
}

// GetDietitianServiceRequests 获取规划师的服务请求列表
func (h *ServiceRequestHandler) GetDietitianServiceRequests(c *gin.Context) {
	// 从上下文获取规划师ID
	dietitianID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权"})
		return
	}

	// 获取服务请求列表
	requests, err := h.serviceRequestService.GetDietitianServiceRequests(dietitianID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取服务请求列表失败"})
		return
	}

	// 构建响应
	response := make([]schemas.ServiceRequestListResponse, 0, len(requests))
	for _, req := range requests {
		// 解析HealthData JSON字符串
		var healthData map[string]interface{}
		if req.HealthData != "" {
			json.Unmarshal([]byte(req.HealthData), &healthData)
		}
		response = append(response, schemas.ServiceRequestListResponse{
			RequestID:    req.RequestID,
			UserID:       req.UserID,
			DietitianID:  req.DietitianID,
			ServiceType:  req.ServiceType,
			DietGoal:     req.DietGoal,
			OtherGoal:    req.OtherGoal,
			HealthData:   healthData,
			Status:       req.Status,
			CreateTime:   req.CreateTime,
			UpdateTime:   req.UpdateTime,
		})
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "data": response, "message": "获取服务请求列表成功"})
}

// ApproveServiceRequest 批准服务请求
func (h *ServiceRequestHandler) ApproveServiceRequest(c *gin.Context) {
	// 从上下文获取规划师ID
	dietitianID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权"})
		return
	}

	// 获取请求ID
	requestID := c.Param("id")
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误"})
		return
	}

	// 批准服务请求
	err := h.serviceRequestService.ApproveServiceRequest(requestID, dietitianID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "批准服务请求失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "服务请求已批准"})
}

// RejectServiceRequest 拒绝服务请求
func (h *ServiceRequestHandler) RejectServiceRequest(c *gin.Context) {
	// 从上下文获取规划师ID
	dietitianID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权"})
		return
	}

	// 获取请求ID
	requestID := c.Param("id")
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "请求参数错误"})
		return
	}

	// 拒绝服务请求
	err := h.serviceRequestService.RejectServiceRequest(requestID, dietitianID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "拒绝服务请求失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "message": "服务请求已拒绝"})
}

// GetDietitianServiceUsers 获取规划师的服务用户列表
func (h *ServiceRequestHandler) GetDietitianServiceUsers(c *gin.Context) {
	// 从上下文获取规划师ID
	dietitianID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权"})
		return
	}

	// 获取服务用户列表
	users, err := h.serviceRequestService.GetDietitianServiceUsers(dietitianID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "获取服务用户列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 200, "data": users, "message": "获取服务用户列表成功"})
}
