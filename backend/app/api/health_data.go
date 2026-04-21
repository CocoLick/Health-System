package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"
)

// HealthDataHandler 健康数据处理器
type HealthDataHandler struct {
	healthDataService *services.HealthDataService
}

// NewHealthDataHandler 创建健康数据处理器实例
func NewHealthDataHandler() *HealthDataHandler {
	return &HealthDataHandler{
		healthDataService: services.NewHealthDataService(),
	}
}

// SubmitHealthData 提交健康数据
// @Summary 提交健康数据
// @Description 用户提交健康数据
// @Tags 健康数据
// @Accept json
// @Produce json
// @Param request body schemas.HealthDataRequest true "健康数据请求"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/health-data [post]
func (h *HealthDataHandler) SubmitHealthData(c *gin.Context) {
	var req schemas.HealthDataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "请求参数错误",
		})
		return
	}

	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{
			Code:    401,
			Message: "用户未登录",
		})
		return
	}

	healthData, err := h.healthDataService.SubmitHealthData(userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "健康数据提交成功",
		Data:    healthData,
	})
}

// GetLatestHealthData 获取最新健康数据
// @Summary 获取最新健康数据
// @Description 获取用户最新的一条健康数据
// @Tags 健康数据
// @Produce json
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/health-data/latest [get]
func (h *HealthDataHandler) GetLatestHealthData(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{
			Code:    401,
			Message: "用户未登录",
		})
		return
	}

	healthData, err := h.healthDataService.GetLatestHealthData(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "暂无健康数据",
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "获取成功",
		Data:    healthData,
	})
}

// GetHealthDataList 获取健康数据列表
// @Summary 获取健康数据列表
// @Description 获取用户的所有健康数据记录
// @Tags 健康数据
// @Produce json
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/health-data [get]
func (h *HealthDataHandler) GetHealthDataList(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{
			Code:    401,
			Message: "用户未登录",
		})
		return
	}

	healthDataList, err := h.healthDataService.GetHealthDataList(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "获取成功",
		Data:    healthDataList,
	})
}

// GetUserHealthDataByDietitian 获取指定用户的最新健康数据（规划师使用）
// @Summary 获取指定用户的健康数据
// @Description 规划师通过用户ID获取该用户的最新健康数据
// @Tags 健康数据
// @Produce json
// @Param user_id path string true "用户ID"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/health-data/user/{user_id} [get]
func (h *HealthDataHandler) GetUserHealthDataByDietitian(c *gin.Context) {
	userID := c.Param("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "用户ID不能为空",
		})
		return
	}

	healthData, err := h.healthDataService.GetLatestHealthData(userID)
	if err != nil {
		c.JSON(http.StatusOK, schemas.Response{
			Code:    200,
			Message: "暂无健康数据",
			Data:    nil,
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "获取成功",
		Data:    healthData,
	})
}

// UpdateHealthData 更新健康数据
// @Summary 更新健康数据
// @Description 更新用户健康数据
// @Tags 健康数据
// @Accept json
// @Produce json
// @Param data_id path string true "数据ID"
// @Param request body schemas.UpdateHealthDataRequest true "更新健康数据请求"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/health-data/{data_id} [put]
func (h *HealthDataHandler) UpdateHealthData(c *gin.Context) {
	dataID := c.Param("data_id")
	var req schemas.UpdateHealthDataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "请求参数错误",
		})
		return
	}

	err := h.healthDataService.UpdateHealthData(dataID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "更新成功",
	})
}

// DeleteHealthData 删除健康数据
// @Summary 删除健康数据
// @Description 删除用户健康数据
// @Tags 健康数据
// @Produce json
// @Param data_id path string true "数据ID"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/health-data/{data_id} [delete]
func (h *HealthDataHandler) DeleteHealthData(c *gin.Context) {
	dataID := c.Param("data_id")

	err := h.healthDataService.DeleteHealthData(dataID)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "删除成功",
	})
}

// RegisterHealthDataRoutes 注册健康数据路由
func RegisterHealthDataRoutes(router *gin.RouterGroup) {
	handler := NewHealthDataHandler()

	healthDataGroup := router.Group("/health-data")
	{
		healthDataGroup.POST("", handler.SubmitHealthData)
		healthDataGroup.GET("", handler.GetHealthDataList)
		healthDataGroup.GET("/latest", handler.GetLatestHealthData)
		healthDataGroup.GET("/user/:user_id", handler.GetUserHealthDataByDietitian)
		healthDataGroup.PUT("/:data_id", handler.UpdateHealthData)
		healthDataGroup.DELETE("/:data_id", handler.DeleteHealthData)
	}
}