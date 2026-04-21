package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"
)

// DietPlanHandler 膳食计划处理器
type DietPlanHandler struct {
	dietPlanService *services.DietPlanService
}

// NewDietPlanHandler 创建膳食计划处理器
func NewDietPlanHandler(dietPlanService *services.DietPlanService) *DietPlanHandler {
	return &DietPlanHandler{
		dietPlanService: dietPlanService,
	}
}

// RegisterRoutes 注册路由
func (h *DietPlanHandler) RegisterRoutes(router *gin.RouterGroup) {
	dietPlanGroup := router.Group("/diet-plans")
	{
		dietPlanGroup.POST("", h.CreateDietPlan)
		dietPlanGroup.GET("/user", h.GetUserDietPlans)
		dietPlanGroup.GET("/:id", h.GetDietPlanDetail)
		dietPlanGroup.PUT("/:id", h.UpdateDietPlan)
		dietPlanGroup.DELETE("/:id", h.DeleteDietPlan)
		dietPlanGroup.PUT("/:id/execute-status", h.UpdateExecuteStatus)
		dietPlanGroup.PUT("/:id/optimization", h.RequestOptimization)
	}
}

// CreateDietPlan 创建膳食计划
// @Summary 创建膳食计划
// @Description 创建新的膳食计划
// @Tags 膳食计划
// @Accept json
// @Produce json
// @Param dietPlan body schemas.DietPlanCreate true "膳食计划信息"
// @Success 200 {object} schemas.Response{data=schemas.DietPlan}
// @Failure 400 {object} schemas.Response
// @Failure 500 {object} schemas.Response
// @Router /api/diet-plans [post]
func (h *DietPlanHandler) CreateDietPlan(c *gin.Context) {
	var req schemas.DietPlanCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "请求参数错误"})
		return
	}

	// 获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}
	req.UserID = userID.(string)

	plan, err := h.dietPlanService.CreateDietPlan(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: "创建膳食计划失败"})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "创建成功", Data: plan})
}

// GetUserDietPlans 获取用户的膳食计划
// @Summary 获取用户的膳食计划
// @Description 获取当前用户的所有膳食计划
// @Tags 膳食计划
// @Produce json
// @Success 200 {object} schemas.Response{data=[]schemas.DietPlan}
// @Failure 401 {object} schemas.Response
// @Failure 500 {object} schemas.Response
// @Router /api/diet-plans/user [get]
func (h *DietPlanHandler) GetUserDietPlans(c *gin.Context) {
	// 获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}

	plans, err := h.dietPlanService.GetUserDietPlans(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: "获取膳食计划失败"})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "获取成功", Data: plans})
}

// GetDietPlanDetail 获取膳食计划详情
// @Summary 获取膳食计划详情
// @Description 根据ID获取膳食计划的详细信息
// @Tags 膳食计划
// @Produce json
// @Param id path string true "膳食计划ID"
// @Success 200 {object} schemas.Response{data=schemas.DietPlanDetail}
// @Failure 400 {object} schemas.Response
// @Failure 404 {object} schemas.Response
// @Failure 500 {object} schemas.Response
// @Router /api/diet-plans/{id} [get]
func (h *DietPlanHandler) GetDietPlanDetail(c *gin.Context) {
	planID := c.Param("id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "计划ID不能为空"})
		return
	}

	// 获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}

	plan, err := h.dietPlanService.GetDietPlanDetail(planID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "膳食计划不存在"})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "获取成功", Data: plan})
}

// UpdateDietPlan 更新膳食计划
// @Summary 更新膳食计划
// @Description 更新现有膳食计划的信息
// @Tags 膳食计划
// @Accept json
// @Produce json
// @Param id path string true "膳食计划ID"
// @Param dietPlan body schemas.DietPlanUpdate true "膳食计划更新信息"
// @Success 200 {object} schemas.Response{data=schemas.DietPlan}
// @Failure 400 {object} schemas.Response
// @Failure 404 {object} schemas.Response
// @Failure 500 {object} schemas.Response
// @Router /api/diet-plans/{id} [put]
func (h *DietPlanHandler) UpdateDietPlan(c *gin.Context) {
	planID := c.Param("id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "计划ID不能为空"})
		return
	}

	var req schemas.DietPlanUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "请求参数错误"})
		return
	}

	// 获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}

	plan, err := h.dietPlanService.UpdateDietPlan(planID, userID.(string), req)
	if err != nil {
		c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "膳食计划不存在"})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "更新成功", Data: plan})
}

// DeleteDietPlan 删除膳食计划
// @Summary 删除膳食计划
// @Description 根据ID删除膳食计划
// @Tags 膳食计划
// @Produce json
// @Param id path string true "膳食计划ID"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Failure 404 {object} schemas.Response
// @Failure 500 {object} schemas.Response
// @Router /api/diet-plans/{id} [delete]
func (h *DietPlanHandler) DeleteDietPlan(c *gin.Context) {
	planID := c.Param("id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "计划ID不能为空"})
		return
	}

	// 获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}

	err := h.dietPlanService.DeleteDietPlan(planID, userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "膳食计划不存在"})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "删除成功"})
}

// UpdateExecuteStatus 更新执行状态
// @Summary 更新执行状态
// @Description 更新膳食计划的执行状态
// @Tags 膳食计划
// @Accept json
// @Produce json
// @Param id path string true "膳食计划ID"
// @Param status body schemas.ExecutionStatusUpdate true "执行状态更新信息"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Failure 404 {object} schemas.Response
// @Failure 500 {object} schemas.Response
// @Router /api/diet-plans/{id}/execute-status [put]
func (h *DietPlanHandler) UpdateExecuteStatus(c *gin.Context) {
	planID := c.Param("id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "计划ID不能为空"})
		return
	}

	var req schemas.ExecutionStatusUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "请求参数错误"})
		return
	}

	// 获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}

	err := h.dietPlanService.UpdateExecuteStatus(planID, userID.(string), req)
	if err != nil {
		c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "执行记录不存在"})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "更新成功"})
}

// RequestOptimization 申请优化
// @Summary 申请优化
// @Description 申请优化膳食计划
// @Tags 膳食计划
// @Accept json
// @Produce json
// @Param id path string true "膳食计划ID"
// @Param request body schemas.OptimizationRequest true "优化请求信息"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Failure 404 {object} schemas.Response
// @Failure 500 {object} schemas.Response
// @Router /api/diet-plans/{id}/optimization [put]
func (h *DietPlanHandler) RequestOptimization(c *gin.Context) {
	planID := c.Param("id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "计划ID不能为空"})
		return
	}

	var req schemas.OptimizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "请求参数错误"})
		return
	}

	// 获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}

	err := h.dietPlanService.RequestOptimization(planID, userID.(string), req)
	if err != nil {
		c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "膳食计划不存在"})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "申请成功"})
}