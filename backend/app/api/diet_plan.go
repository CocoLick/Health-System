package api

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"
)

// actorDietitianIDFromContext 当前登录用户为规划师时返回其 user_id，用于纠正请求体中的占位 dietitian_id
func actorDietitianIDFromContext(c *gin.Context) string {
	rt, ok := c.Get("roleType")
	if !ok || rt.(string) != "dietitian" {
		return ""
	}
	uid, ok := c.Get("userID")
	if !ok {
		return ""
	}
	return uid.(string)
}

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
		dietPlanGroup.POST("/ai/generate", h.GenerateAIDietPlan)
		dietPlanGroup.POST("", h.CreateDietPlan)
		dietPlanGroup.GET("/user", h.GetUserDietPlans)
		dietPlanGroup.GET("/:id", h.GetDietPlanDetail)
		dietPlanGroup.PUT("/:id", h.UpdateDietPlan)
		dietPlanGroup.DELETE("/:id", h.DeleteDietPlan)
		dietPlanGroup.PUT("/:id/execute-status", h.UpdateExecuteStatus)
		dietPlanGroup.PUT("/:id/optimization", h.RequestOptimization)
		dietPlanGroup.PUT("/:id/publish", h.PublishDietPlan)
	}
}

// GenerateAIDietPlan 智能推荐生成膳食计划
func (h *DietPlanHandler) GenerateAIDietPlan(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}

	var req schemas.AIDietPlanGenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "请求参数错误"})
		return
	}

	plan, _, err := h.dietPlanService.GenerateAIDietPlan(userID.(string), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "生成成功", Data: plan})
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

	// 验证用户ID是否存在
	if req.UserID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "用户ID不能为空"})
		return
	}

	if id := actorDietitianIDFromContext(c); id != "" {
		req.DietitianID = id
	} else if req.DietitianID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "规划师ID不能为空"})
		return
	}

	// 打印接收到的数据
	fmt.Println("=== 接收到的膳食计划数据 ===")
	fmt.Println("PlanTitle:", req.PlanTitle)
	fmt.Println("CycleDays:", req.CycleDays)
	if len(req.PlanDays) > 0 {
		fmt.Println("第一天数据:")
		fmt.Println("  Calories:", req.PlanDays[0].Calories)
		fmt.Println("  Protein:", req.PlanDays[0].Protein)
		fmt.Println("  Carbohydrate:", req.PlanDays[0].Carbohydrate)
		fmt.Println("  Fat:", req.PlanDays[0].Fat)
	}

	// 验证当前用户是否为规划师（可以根据需要添加权限验证）
	// 这里暂时跳过权限验证，假设所有登录用户都可以创建膳食计划

	plan, err := h.dietPlanService.CreateDietPlan(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: "创建膳食计划失败"})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "创建成功", Data: plan})
}

// GetUserDietPlans 获取用户的膳食计划
// @Summary 获取用户的膳食计划
// @Description 获取指定用户的所有膳食计划（规划师使用）或当前用户的计划（用户使用）
// @Tags 膳食计划
// @Produce json
// @Param user_id query string false "用户ID（规划师使用）"
// @Success 200 {object} schemas.Response{data=[]schemas.DietPlan}
// @Failure 401 {object} schemas.Response
// @Failure 500 {object} schemas.Response
// @Router /api/diet-plans/user [get]
func (h *DietPlanHandler) GetUserDietPlans(c *gin.Context) {
	// 尝试从查询参数获取用户ID（规划师使用）
	targetUserID := c.Query("user_id")

	// 如果没有指定用户ID，则使用当前登录用户的ID
	if targetUserID == "" {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
			return
		}
		targetUserID = userID.(string)
	}

	plans, err := h.dietPlanService.GetUserDietPlans(targetUserID)
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
// @Param user_id query string false "用户ID（规划师使用）"
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

	// 尝试从查询参数获取用户ID（规划师使用）
	targetUserID := c.Query("user_id")

	// 如果没有指定用户ID，则使用当前登录用户的ID
	if targetUserID == "" {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
			return
		}
		targetUserID = userID.(string)
	}

	plan, err := h.dietPlanService.GetDietPlanDetail(planID, targetUserID)
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

	// 从请求体中获取用户ID（前端需要传递）
	// 或者从查询参数中获取
	userID := c.Query("user_id")
	if userID == "" {
		// 尝试从上下文中获取（兼容用户端）
		if uid, exists := c.Get("userID"); exists {
			userID = uid.(string)
		} else {
			c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "用户ID不能为空"})
			return
		}
	}

	actorDietitianID := actorDietitianIDFromContext(c)
	plan, err := h.dietPlanService.UpdateDietPlan(planID, userID, actorDietitianID, req)
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
		switch {
		case errors.Is(err, services.ErrDietPlanNotFound):
			c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: err.Error()})
		case errors.Is(err, services.ErrDietPlanForbidden):
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		}
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

// PublishDietPlan 发布膳食计划
// @Summary 发布膳食计划
// @Description 发布膳食计划，使其对用户可见
// @Tags 膳食计划
// @Produce json
// @Param id path string true "膳食计划ID"
// @Success 200 {object} schemas.Response{data=schemas.DietPlan}
// @Failure 400 {object} schemas.Response
// @Failure 404 {object} schemas.Response
// @Failure 500 {object} schemas.Response
// @Router /api/diet-plans/{id}/publish [put]
func (h *DietPlanHandler) PublishDietPlan(c *gin.Context) {
	planID := c.Param("id")
	if planID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "计划ID不能为空"})
		return
	}

	// 从查询参数中获取用户ID（前端需要传递）
	userID := c.Query("user_id")
	if userID == "" {
		// 尝试从上下文中获取（兼容用户端）
		if uid, exists := c.Get("userID"); exists {
			userID = uid.(string)
		} else {
			c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "用户ID不能为空"})
			return
		}
	}

	actorDietitianID := actorDietitianIDFromContext(c)
	plan, err := h.dietPlanService.PublishDietPlan(planID, userID, actorDietitianID)
	if err != nil {
		c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "膳食计划不存在"})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "发布成功", Data: plan})
}
