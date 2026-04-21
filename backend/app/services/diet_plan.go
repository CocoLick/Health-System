package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"
)

// DietPlanService 膳食计划服务
type DietPlanService struct {
	// 这里可以添加数据库连接等依赖
}

// NewDietPlanService 创建膳食计划服务
func NewDietPlanService() *DietPlanService {
	return &DietPlanService{}
}

// CreateDietPlan 创建膳食计划
func (s *DietPlanService) CreateDietPlan(req schemas.DietPlanCreate) (schemas.DietPlan, error) {
	// 生成计划ID
	planID := fmt.Sprintf("P%s", time.Now().Format("060102150405"))

	// 创建膳食计划
	plan := models.DietPlan{
		PlanID:          planID,
		UserID:          req.UserID,
		ServiceRequestID: req.ServiceRequestID,
		DietitianID:     req.DietitianID,
		PlanTitle:       req.PlanTitle,
		Source:          req.Source,
		DietGoal:        req.DietGoal,
		CycleDays:       req.CycleDays,
		AuditStatus:     "published", // 默认为已发布
		PublishedAt:     time.Now(),
		UpdatedAt:       time.Now(),
	}

	// 保存膳食计划
	if err := config.DB.Create(&plan).Error; err != nil {
		return schemas.DietPlan{}, err
	}

	// 创建天计划
	for i, dayReq := range req.PlanDays {
		dayID := fmt.Sprintf("D%s%d", planID, i+1)
		planDate, err := time.Parse("2006-01-02", dayReq.PlanDate)
		if err != nil {
			return schemas.DietPlan{}, err
		}

		day := models.PlanDay{
			DayID:        dayID,
			PlanID:       planID,
			DayIndex:     dayReq.DayIndex,
			PlanDate:     planDate,
			Calories:     dayReq.Calories,
			Protein:      dayReq.Protein,
			Carbohydrate: dayReq.Carbohydrate,
			Fat:          dayReq.Fat,
		}

		// 保存天计划
		if err := config.DB.Create(&day).Error; err != nil {
			return schemas.DietPlan{}, err
		}

		// 创建餐次
		for j, mealReq := range dayReq.Meals {
			mealID := fmt.Sprintf("M%s%d", dayID, j+1)

			meal := models.Meal{
				MealID:   mealID,
				DayID:    dayID,
				Type:     mealReq.Type,
				Time:     mealReq.Time,
				Calories: mealReq.Calories,
			}

			// 保存餐次
			if err := config.DB.Create(&meal).Error; err != nil {
				return schemas.DietPlan{}, err
			}

			// 创建食物
			for k, foodReq := range mealReq.Foods {
				foodID := fmt.Sprintf("F%s%d", mealID, k+1)

				food := models.Food{
					FoodID:   foodID,
					MealID:   mealID,
					Name:     foodReq.Name,
					Amount:   foodReq.Amount,
					Calories: foodReq.Calories,
				}

				// 保存食物
				if err := config.DB.Create(&food).Error; err != nil {
					return schemas.DietPlan{}, err
				}
			}
		}
	}

	return schemas.DietPlan{
		PlanID:          plan.PlanID,
		UserID:          plan.UserID,
		ServiceRequestID: plan.ServiceRequestID,
		DietitianID:     plan.DietitianID,
		PlanTitle:       plan.PlanTitle,
		Source:          plan.Source,
		DietGoal:        plan.DietGoal,
		CycleDays:       plan.CycleDays,
		AuditStatus:     plan.AuditStatus,
		PublishedAt:     plan.PublishedAt,
		UpdatedAt:       plan.UpdatedAt,
	}, nil
}

// GetUserDietPlans 获取用户的膳食计划
func (s *DietPlanService) GetUserDietPlans(userID string) ([]schemas.DietPlan, error) {
	// 从数据库查询
	var plans []models.DietPlan
	if err := config.DB.Where("user_id = ?", userID).Find(&plans).Error; err != nil {
		return nil, err
	}

	// 转换为响应格式
	result := make([]schemas.DietPlan, len(plans))
	for i, plan := range plans {
		result[i] = schemas.DietPlan{
			PlanID:          plan.PlanID,
			UserID:          plan.UserID,
			ServiceRequestID: plan.ServiceRequestID,
			DietitianID:     plan.DietitianID,
			PlanTitle:       plan.PlanTitle,
			Source:          plan.Source,
			DietGoal:        plan.DietGoal,
			CycleDays:       plan.CycleDays,
			AuditStatus:     plan.AuditStatus,
			PublishedAt:     plan.PublishedAt,
			UpdatedAt:       plan.UpdatedAt,
		}
	}

	return result, nil
}

// GetDietPlanDetail 获取膳食计划详情
func (s *DietPlanService) GetDietPlanDetail(planID, userID string) (schemas.DietPlanDetail, error) {
	// 从数据库查询膳食计划
	var plan models.DietPlan
	if err := config.DB.Where("plan_id = ? AND user_id = ?", planID, userID).First(&plan).Error; err != nil {
		return schemas.DietPlanDetail{}, err
	}

	// 查询计划天数
	var planDays []models.PlanDay
	if err := config.DB.Where("plan_id = ?", planID).Order("day_index").Find(&planDays).Error; err != nil {
		return schemas.DietPlanDetail{}, err
	}

	// 转换为响应格式
	planDaysDetail := make([]schemas.PlanDayDetail, len(planDays))
	for i, day := range planDays {
		// 查询餐次
		var meals []models.Meal
		if err := config.DB.Where("day_id = ?", day.DayID).Find(&meals).Error; err != nil {
			return schemas.DietPlanDetail{}, err
		}

		// 转换餐次为响应格式
		mealsDetail := make([]schemas.MealDetail, len(meals))
		for j, meal := range meals {
			// 查询食物
			var foods []models.Food
			if err := config.DB.Where("meal_id = ?", meal.MealID).Find(&foods).Error; err != nil {
				return schemas.DietPlanDetail{}, err
			}

			// 转换食物为响应格式
			foodsDetail := make([]schemas.FoodDetail, len(foods))
			for k, food := range foods {
				foodsDetail[k] = schemas.FoodDetail{
					FoodID:   food.FoodID,
					MealID:   food.MealID,
					Name:     food.Name,
					Amount:   food.Amount,
					Calories: food.Calories,
				}
			}

			mealsDetail[j] = schemas.MealDetail{
				MealID:   meal.MealID,
				DayID:    meal.DayID,
				Type:     meal.Type,
				Time:     meal.Time,
				Calories: meal.Calories,
				Executed: false, // 默认未执行
				Foods:    foodsDetail,
			}
		}

		planDaysDetail[i] = schemas.PlanDayDetail{
			DayID:        day.DayID,
			PlanID:       day.PlanID,
			DayIndex:     day.DayIndex,
			PlanDate:     day.PlanDate.Format("2006-01-02"),
			Calories:     day.Calories,
			Protein:      day.Protein,
			Carbohydrate: day.Carbohydrate,
			Fat:          day.Fat,
			Meals:        mealsDetail,
		}
	}

	// 构建响应
	planDetail := schemas.DietPlanDetail{
		PlanID:          plan.PlanID,
		UserID:          plan.UserID,
		ServiceRequestID: plan.ServiceRequestID,
		DietitianID:     plan.DietitianID,
		PlanTitle:       plan.PlanTitle,
		Source:          plan.Source,
		DietGoal:        plan.DietGoal,
		CycleDays:       plan.CycleDays,
		AuditStatus:     plan.AuditStatus,
		PublishedAt:     plan.PublishedAt,
		UpdatedAt:       plan.UpdatedAt,
		PlanDays:        planDaysDetail,
	}

	return planDetail, nil
}

// UpdateDietPlan 更新膳食计划
func (s *DietPlanService) UpdateDietPlan(planID, userID string, req schemas.DietPlanUpdate) (schemas.DietPlan, error) {
	// 这里应该从数据库查询并更新，现在返回模拟数据
	if planID != "P20260421120000" {
		return schemas.DietPlan{}, errors.New("膳食计划不存在")
	}

	return schemas.DietPlan{
		PlanID:          planID,
		UserID:          userID,
		ServiceRequestID: "SR20260421110000",
		DietitianID:     "D20260325001",
		PlanTitle:       req.PlanTitle,
		Source:          "ai",
		DietGoal:        req.DietGoal,
		CycleDays:       7,
		AuditStatus:     "published",
		PublishedAt:     time.Now(),
		UpdatedAt:       time.Now(),
	}, nil
}

// DeleteDietPlan 删除膳食计划
func (s *DietPlanService) DeleteDietPlan(planID, userID string) error {
	// 检查膳食计划是否存在
	var plan models.DietPlan
	if err := config.DB.Where("plan_id = ? AND user_id = ?", planID, userID).First(&plan).Error; err != nil {
		return err
	}

	// 开始事务
	tx := config.DB.Begin()

	// 删除相关的食物
	if err := tx.Exec("DELETE f FROM foods f JOIN meals m ON f.meal_id = m.meal_id JOIN plan_days pd ON m.day_id = pd.day_id WHERE pd.plan_id = ?", planID).Error; err != nil {
		tx.Rollback()
		return err
	}

	// 删除相关的餐次
	if err := tx.Exec("DELETE m FROM meals m JOIN plan_days pd ON m.day_id = pd.day_id WHERE pd.plan_id = ?", planID).Error; err != nil {
		tx.Rollback()
		return err
	}

	// 删除相关的天计划
	if err := tx.Where("plan_id = ?", planID).Delete(&models.PlanDay{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	// 删除膳食计划
	if err := tx.Delete(&plan).Error; err != nil {
		tx.Rollback()
		return err
	}

	// 提交事务
	return tx.Commit().Error
}

// UpdateExecuteStatus 更新执行状态
func (s *DietPlanService) UpdateExecuteStatus(planID, userID string, req schemas.ExecutionStatusUpdate) error {
	// 这里应该从数据库更新，现在返回模拟数据
	return nil
}

// RequestOptimization 申请优化
func (s *DietPlanService) RequestOptimization(planID, userID string, req schemas.OptimizationRequest) error {
	// 这里应该从数据库更新，现在返回模拟数据
	if planID != "P20260421120000" {
		return errors.New("膳食计划不存在")
	}
	return nil
}