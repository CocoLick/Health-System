package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"
)

// NutritionRecordHandler 营养记录处理器
type NutritionRecordHandler struct {
	nutritionRecordService *services.NutritionRecordService
}

// NewNutritionRecordHandler 创建营养记录处理器实例
func NewNutritionRecordHandler() *NutritionRecordHandler {
	return &NutritionRecordHandler{
		nutritionRecordService: services.NewNutritionRecordService(),
	}
}

// CreateNutritionRecord 创建营养记录
// @Summary 创建营养记录
// @Description 用户创建饮食记录
// @Tags 营养记录
// @Accept json
// @Produce json
// @Param request body schemas.NutritionRecordRequest true "营养记录请求"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/nutrition/record [post]
func (h *NutritionRecordHandler) CreateNutritionRecord(c *gin.Context) {
	var req schemas.NutritionRecordRequest
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

	record, err := h.nutritionRecordService.CreateNutritionRecord(userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "记录创建成功",
		Data:    record,
	})
}

// GetNutritionRecords 获取营养记录列表
// @Summary 获取营养记录列表
// @Description 获取用户的营养记录列表
// @Tags 营养记录
// @Produce json
// @Param date query string false "日期筛选"
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页数量" default(10)
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/nutrition/record [get]
func (h *NutritionRecordHandler) GetNutritionRecords(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{
			Code:    401,
			Message: "用户未登录",
		})
		return
	}

	date := c.Query("date")
	page := 1
	pageSize := 10

	records, total, err := h.nutritionRecordService.GetNutritionRecordsByUserID(userID, date, page, pageSize)
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
		Data: gin.H{
			"records": records,
			"total":   total,
			"page":    page,
			"pageSize": pageSize,
		},
	})
}

// GetTodayNutritionRecords 获取今日营养记录
// @Summary 获取今日营养记录
// @Description 获取用户今天的营养记录
// @Tags 营养记录
// @Produce json
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/nutrition/record/today [get]
func (h *NutritionRecordHandler) GetTodayNutritionRecords(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{
			Code:    401,
			Message: "用户未登录",
		})
		return
	}

	records, err := h.nutritionRecordService.GetTodayNutritionRecords(userID)
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
		Data:    records,
	})
}

// GetNutritionRecordByID 获取单条营养记录
// @Summary 获取单条营养记录
// @Description 根据ID获取营养记录详情
// @Tags 营养记录
// @Produce json
// @Param record_id path string true "记录ID"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/nutrition/record/{record_id} [get]
func (h *NutritionRecordHandler) GetNutritionRecordByID(c *gin.Context) {
	recordID := c.Param("record_id")

	record, err := h.nutritionRecordService.GetNutritionRecordByID(recordID)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "记录不存在",
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "获取成功",
		Data:    record,
	})
}

// DeleteNutritionRecord 删除营养记录
// @Summary 删除营养记录
// @Description 删除用户的营养记录
// @Tags 营养记录
// @Produce json
// @Param record_id path string true "记录ID"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/nutrition/record/{record_id} [delete]
func (h *NutritionRecordHandler) DeleteNutritionRecord(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{
			Code:    401,
			Message: "用户未登录",
		})
		return
	}

	recordID := c.Param("record_id")

	err := h.nutritionRecordService.DeleteNutritionRecord(recordID, userID)
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

// GetNutritionRecordsByDate 获取指定日期的营养记录
// @Summary 获取指定日期的营养记录
// @Description 获取用户指定日期的营养记录
// @Tags 营养记录
// @Produce json
// @Param date query string true "日期，格式：YYYY-MM-DD"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/nutrition/record/date [get]
func (h *NutritionRecordHandler) GetNutritionRecordsByDate(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{
			Code:    401,
			Message: "用户未登录",
		})
		return
	}

	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "日期参数不能为空",
		})
		return
	}

	records, err := h.nutritionRecordService.GetNutritionRecordsByDate(userID, date)
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
		Data:    records,
	})
}

// GetNutritionTrendData 获取营养摄入趋势数据
// @Summary 获取营养摄入趋势数据
// @Description 获取用户营养摄入趋势数据
// @Tags 营养记录
// @Produce json
// @Param days query int false "天数，默认7天"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/nutrition/record/trend [get]
func (h *NutritionRecordHandler) GetNutritionTrendData(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{
			Code:    401,
			Message: "用户未登录",
		})
		return
	}

	days := 7
	daysStr := c.Query("days")
	if daysStr != "" {
		if parsedDays, err := strconv.Atoi(daysStr); err == nil && (parsedDays == 7 || parsedDays == 30) {
			days = parsedDays
		}
	}
	trendData, err := h.nutritionRecordService.GetNutritionTrendData(userID, days)
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
		Data:    trendData,
	})
}

// RegisterNutritionRecordRoutes 注册营养记录路由
func RegisterNutritionRecordRoutes(router *gin.RouterGroup) {
	handler := NewNutritionRecordHandler()

	nutritionRecordGroup := router.Group("/nutrition/record")
	{
		nutritionRecordGroup.POST("", handler.CreateNutritionRecord)
		nutritionRecordGroup.GET("", handler.GetNutritionRecords)
		nutritionRecordGroup.GET("/today", handler.GetTodayNutritionRecords)
		nutritionRecordGroup.GET("/date", handler.GetNutritionRecordsByDate)
		nutritionRecordGroup.GET("/trend", handler.GetNutritionTrendData)
		nutritionRecordGroup.GET("/:record_id", handler.GetNutritionRecordByID)
		nutritionRecordGroup.DELETE("/:record_id", handler.DeleteNutritionRecord)
	}
}
