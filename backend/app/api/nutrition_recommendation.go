package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"
	"github.com/yourusername/nutrition-system/config"
	"gorm.io/gorm"
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

func resolveActivityLevel(queryVal string, healthDataVal string) string {
	v := strings.TrimSpace(queryVal)
	if v == "" {
		v = strings.TrimSpace(healthDataVal)
	}
	switch v {
	case "sedentary", "lightly_active", "moderately_active", "very_active":
		return v
	default:
		if strings.TrimSpace(healthDataVal) != "" {
			switch strings.TrimSpace(healthDataVal) {
			case "sedentary", "lightly_active", "moderately_active", "very_active":
				return strings.TrimSpace(healthDataVal)
			}
		}
		return "moderately_active"
	}
}

func activityFactor(level string) float64 {
	switch level {
	case "sedentary":
		return 1.2
	case "lightly_active":
		return 1.375
	case "moderately_active":
		return 1.55
	case "very_active":
		return 1.725
	default:
		return 1.55
	}
}

func calorieAdjustByGoal(goal string) float64 {
	switch strings.TrimSpace(goal) {
	case "lose_weight", "weight_loss":
		return -350
	case "healthy_gain", "weight_gain":
		return 250
	case "maintain":
		return 0
	default:
		return 0
	}
}

func buildNutritionRecommendation(hd *models.HealthData, queryActivity string) schemas.NutritionRecommendationResponse {
	var bmr float64
	gender := strings.TrimSpace(hd.Gender)
	if gender == "male" || gender == "男" {
		bmr = 10*hd.Weight + 6.25*hd.Height - 5*float64(hd.Age) + 5
	} else {
		bmr = 10*hd.Weight + 6.25*hd.Height - 5*float64(hd.Age) - 161
	}
	level := resolveActivityLevel(queryActivity, hd.ActivityLevel)
	totalCalories := bmr*activityFactor(level) + calorieAdjustByGoal(hd.NutritionGoal)
	if totalCalories < 1200 {
		totalCalories = 1200
	}
	protein := totalCalories * 0.2 / 4
	fat := totalCalories * 0.25 / 9
	carbohydrate := totalCalories * 0.55 / 4
	return schemas.NutritionRecommendationResponse{
		BMR:           bmr,
		TotalCalories: totalCalories,
		ActivityLevel: level,
		Nutrients: schemas.NutritionTarget{
			Calories:     totalCalories,
			Protein:      protein,
			Carbohydrate: carbohydrate,
			Fat:          fat,
		},
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

	// 获取活动水平参数（若为空则优先使用健康档案中的 activity_level）
	activityLevelStr := c.Query("activity_level")

	// 获取用户最新健康数据
	healthData, err := h.healthDataService.GetLatestHealthData(userID.(string))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, schemas.Response{
				Code:    200,
				Message: "请先完善健康档案",
				Data:    nil,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{
			Code:    500,
			Message: "获取健康数据失败",
		})
		return
	}

	recommendation := buildNutritionRecommendation(healthData, activityLevelStr)

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "获取成功",
		Data:    recommendation,
	})
}

// GetUserNutritionRecommendationByDietitian 规划师/管理员获取指定用户营养推荐
func (h *NutritionRecommendationHandler) GetUserNutritionRecommendationByDietitian(c *gin.Context) {
	roleType := strings.TrimSpace(c.GetString("roleType"))
	if roleType != "dietitian" && roleType != "admin" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "无权限访问"})
		return
	}
	userID := strings.TrimSpace(c.Param("user_id"))
	if userID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "用户ID不能为空"})
		return
	}
	if roleType == "dietitian" {
		dietitianID := strings.TrimSpace(c.GetString("userID"))
		var cnt int64
		_ = config.DB.Model(&models.ServiceRequest{}).
			Where("dietitian_id = ? AND user_id = ? AND status IN ?", dietitianID, userID, []string{"pending", "approved"}).
			Count(&cnt).Error
		if cnt == 0 {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "无服务关系，禁止访问"})
			return
		}
	}
	healthData, err := h.healthDataService.GetLatestHealthData(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "请先完善健康档案", Data: nil})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: "获取健康数据失败"})
		return
	}
	recommendation := buildNutritionRecommendation(healthData, c.Query("activity_level"))
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
		nutritionGroup.GET("/recommendation/user/:user_id", handler.GetUserNutritionRecommendationByDietitian)
	}
}
