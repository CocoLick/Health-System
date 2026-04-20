package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"
)

// NutritionRecommendationHandler 营养推荐处理器
type NutritionRecommendationHandler struct {
	healthDataService *services.HealthDataService
}

// NewNutritionRecommendationHandler 创建营养推荐处理器实例
func NewNutritionRecommendationHandler() *NutritionRecommendationHandler {
	return &NutritionRecommendationHandler{
		healthDataService: services.NewHealthDataService(),
	}
}

// GetNutritionRecommendation 获取营养推荐标准
// @Summary 获取营养推荐标准
// @Description 根据用户健康数据计算个人化营养推荐标准
// @Tags 营养推荐
// @Accept json
// @Produce json
// @Param activity_level query string false "活动水平：sedentary(1.2), lightly_active(1.375), moderately_active(1.55), very_active(1.725)"
// @Success 200 {object} schemas.Response{data=schemas.NutritionRecommendationResponse}
// @Failure 400 {object} schemas.Response
// @Failure 401 {object} schemas.Response
// @Router /api/nutrition/recommendation [get]
func (h *NutritionRecommendationHandler) GetNutritionRecommendation(c *gin.Context) {
	// 获取用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, schemas.Response{
			Code:    401,
			Message: "用户未登录",
		})
		return
	}

	// 获取活动水平参数
	activityLevelStr := c.DefaultQuery("activity_level", "moderately_active")

	// 获取用户最新健康数据
	healthData, err := h.healthDataService.GetLatestHealthData(userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "获取健康数据失败",
		})
		return
	}

	// 计算BMR
	var bmr float64
	if healthData.Gender == "male" {
		bmr = 10*healthData.Weight + 6.25*healthData.Height - 5*float64(healthData.Age) + 5
	} else {
		bmr = 10*healthData.Weight + 6.25*healthData.Height - 5*float64(healthData.Age) - 161
	}

	// 活动系数
	activityFactor := 1.55 // 默认中度活动
	switch activityLevelStr {
	case "sedentary":
		activityFactor = 1.2
	case "lightly_active":
		activityFactor = 1.375
	case "moderately_active":
		activityFactor = 1.55
	case "very_active":
		activityFactor = 1.725
	}

	// 计算总热量
	totalCalories := bmr * activityFactor

	// 计算营养素（克）
	protein := totalCalories * 0.2 / 4
	fat := totalCalories * 0.25 / 9
	carbohydrate := totalCalories * 0.55 / 4

	// 构建响应
	recommendation := schemas.NutritionRecommendationResponse{
		BMR:           bmr,
		TotalCalories: totalCalories,
		ActivityLevel: activityLevelStr,
		Nutrients: schemas.NutritionTarget{
			Calories:     totalCalories,
			Protein:      protein,
			Carbohydrate: carbohydrate,
			Fat:          fat,
		},
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "获取成功",
		Data:    recommendation,
	})
}

// RegisterNutritionRecommendationRoutes 注册营养推荐路由
func RegisterNutritionRecommendationRoutes(router *gin.RouterGroup) {
	handler := NewNutritionRecommendationHandler()

	nutritionGroup := router.Group("/nutrition")
	{
		nutritionGroup.GET("/recommendation", handler.GetNutritionRecommendation)
	}
}
