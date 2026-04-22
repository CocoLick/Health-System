package services

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"

	"gorm.io/gorm"
)

var (
	// ErrDietPlanNotFound 计划不存在（按 plan_id 在库中也不存在）
	ErrDietPlanNotFound = errors.New("膳食计划不存在")
	// ErrDietPlanForbidden 计划存在但不属于当前用户，无权删除
	ErrDietPlanForbidden = errors.New("无权删除该膳食计划")
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
		PlanID:           planID,
		UserID:           req.UserID,
		ServiceRequestID: strings.TrimSpace(req.ServiceRequestID),
		DietitianID:      req.DietitianID,
		PlanTitle:        req.PlanTitle,
		Source:           req.Source,
		DietGoal:         strings.TrimSpace(req.DietGoal),
		CycleDays:        req.CycleDays,
		AuditStatus:      "draft", // 默认为草稿
		UpdatedAt:        time.Now(),
	}

	if err := fillDietPlanFromApprovedServiceRequest(config.DB, &plan, req.ServiceRequestID, req.DietGoal); err != nil {
		return schemas.DietPlan{}, err
	}
	if strings.TrimSpace(plan.DietGoal) == "" {
		plan.DietGoal = "—"
	}

	// 保存膳食计划
	if err := config.DB.Create(&plan).Error; err != nil {
		return schemas.DietPlan{}, err
	}

	ingredients, err := loadIngredientList(config.DB)
	if err != nil {
		return schemas.DietPlan{}, err
	}
	ingIdx := indexIngredientsByName(ingredients)

	// 创建天计划
	for i, dayReq := range req.PlanDays {
		dayID := fmt.Sprintf("D%s%d", planID, i+1)
		planDate, err := time.Parse("2006-01-02", dayReq.PlanDate)
		if err != nil {
			return schemas.DietPlan{}, err
		}

		var dayCal int
		var dayProtein, dayCarb, dayFat float64

		day := models.PlanDay{
			DayID:    dayID,
			PlanID:   planID,
			DayIndex: dayReq.DayIndex,
			PlanDate: planDate,
		}

		// 保存天计划（营养素在写入餐食后回填）
		if err := config.DB.Create(&day).Error; err != nil {
			return schemas.DietPlan{}, err
		}

		// 创建餐次
		for j, mealReq := range dayReq.Meals {
			mealID := fmt.Sprintf("M%s%d", dayID, j+1)

			var mealCal int
			var mealProtein, mealCarb, mealFat float64

			meal := models.Meal{
				MealID: mealID,
				DayID:  dayID,
				Type:   mealReq.Type,
				Time:   mealReq.Time,
			}

			if err := config.DB.Create(&meal).Error; err != nil {
				return schemas.DietPlan{}, err
			}

			for k, foodReq := range mealReq.Foods {
				foodID := fmt.Sprintf("F%s%d", mealID, k+1)
				ing := ingIdx[strings.ToLower(strings.TrimSpace(foodReq.Name))]
				cal, protein, carbohydrate, fat := nutrientsForPortion(ing, foodReq.Amount, foodReq.Calories, foodReq.Protein, foodReq.Carbohydrate, foodReq.Fat)

				food := models.Food{
					FoodID:       foodID,
					MealID:       mealID,
					Name:         foodReq.Name,
					Amount:       foodReq.Amount,
					Calories:     cal,
					Protein:      roundNutrient1(protein),
					Carbohydrate: roundNutrient1(carbohydrate),
					Fat:          roundNutrient1(fat),
				}

				if err := config.DB.Create(&food).Error; err != nil {
					return schemas.DietPlan{}, err
				}
				mealCal += cal
				mealProtein += protein
				mealCarb += carbohydrate
				mealFat += fat
			}

			meal.Calories = mealCal
			meal.Protein = roundNutrient1(mealProtein)
			meal.Carbohydrate = roundNutrient1(mealCarb)
			meal.Fat = roundNutrient1(mealFat)
			if err := config.DB.Save(&meal).Error; err != nil {
				return schemas.DietPlan{}, err
			}

			dayCal += mealCal
			dayProtein += mealProtein
			dayCarb += mealCarb
			dayFat += mealFat
		}

		day.Calories = dayCal
		day.Protein = roundNutrient1(dayProtein)
		day.Carbohydrate = roundNutrient1(dayCarb)
		day.Fat = roundNutrient1(dayFat)
		if err := config.DB.Save(&day).Error; err != nil {
			return schemas.DietPlan{}, err
		}
	}

	dietitianNames := NewServiceRequestService().DietitianNamesByIDs([]string{plan.DietitianID})
	return schemas.DietPlan{
		PlanID:          plan.PlanID,
		UserID:          plan.UserID,
		ServiceRequestID: plan.ServiceRequestID,
		DietitianID:     plan.DietitianID,
		DietitianName:   dietitianNames[plan.DietitianID],
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

	dietitianIDs := make([]string, 0, len(plans))
	for _, plan := range plans {
		dietitianIDs = append(dietitianIDs, plan.DietitianID)
	}
	nameMap := NewServiceRequestService().DietitianNamesByIDs(dietitianIDs)

	// 转换为响应格式
	result := make([]schemas.DietPlan, len(plans))
	for i, plan := range plans {
		result[i] = schemas.DietPlan{
			PlanID:          plan.PlanID,
			UserID:          plan.UserID,
			ServiceRequestID: plan.ServiceRequestID,
			DietitianID:     plan.DietitianID,
			DietitianName:   nameMap[plan.DietitianID],
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

	dietitianNames := NewServiceRequestService().DietitianNamesByIDs([]string{plan.DietitianID})

	// 构建响应
	planDetail := schemas.DietPlanDetail{
		PlanID:          plan.PlanID,
		UserID:          plan.UserID,
		ServiceRequestID: plan.ServiceRequestID,
		DietitianID:     plan.DietitianID,
		DietitianName:   dietitianNames[plan.DietitianID],
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
func (s *DietPlanService) UpdateDietPlan(planID, userID, actorDietitianID string, req schemas.DietPlanUpdate) (schemas.DietPlan, error) {
	// 检查膳食计划是否存在
	var plan models.DietPlan
	if err := config.DB.Where("plan_id = ? AND user_id = ?", planID, userID).First(&plan).Error; err != nil {
		return schemas.DietPlan{}, err
	}

	if actorDietitianID != "" {
		plan.DietitianID = actorDietitianID
	}

	// 开始事务
	tx := config.DB.Begin()

	// 更新膳食计划基本信息
	plan.PlanTitle = req.PlanTitle
	plan.CycleDays = req.CycleDays
	plan.UpdatedAt = time.Now()

	if err := fillDietPlanFromApprovedServiceRequest(tx, &plan, plan.ServiceRequestID, req.DietGoal); err != nil {
		tx.Rollback()
		return schemas.DietPlan{}, err
	}

	if err := tx.Save(&plan).Error; err != nil {
		tx.Rollback()
		return schemas.DietPlan{}, err
	}

	// 删除旧的计划天数、餐次和食物
	// 删除食物
	if err := tx.Exec("DELETE f FROM foods f JOIN meals m ON f.meal_id = m.meal_id JOIN plan_days pd ON m.day_id = pd.day_id WHERE pd.plan_id = ?", planID).Error; err != nil {
		tx.Rollback()
		return schemas.DietPlan{}, err
	}

	// 删除餐次
	if err := tx.Exec("DELETE m FROM meals m JOIN plan_days pd ON m.day_id = pd.day_id WHERE pd.plan_id = ?", planID).Error; err != nil {
		tx.Rollback()
		return schemas.DietPlan{}, err
	}

	// 删除计划天数
	if err := tx.Where("plan_id = ?", planID).Delete(&models.PlanDay{}).Error; err != nil {
		tx.Rollback()
		return schemas.DietPlan{}, err
	}

	ingredients, err := loadIngredientList(tx)
	if err != nil {
		tx.Rollback()
		return schemas.DietPlan{}, err
	}
	ingIdx := indexIngredientsByName(ingredients)

	// 创建新的计划天数、餐次和食物
	for i, dayReq := range req.PlanDays {
		dayID := fmt.Sprintf("D%s%d", planID, i+1)
		planDate, err := time.Parse("2006-01-02", dayReq.PlanDate)
		if err != nil {
			tx.Rollback()
			return schemas.DietPlan{}, err
		}

		var dayCal int
		var dayProtein, dayCarb, dayFat float64

		day := models.PlanDay{
			DayID:    dayID,
			PlanID:   planID,
			DayIndex: dayReq.DayIndex,
			PlanDate: planDate,
		}

		if err := tx.Create(&day).Error; err != nil {
			tx.Rollback()
			return schemas.DietPlan{}, err
		}

		for j, mealReq := range dayReq.Meals {
			mealID := fmt.Sprintf("M%s%d", dayID, j+1)

			var mealCal int
			var mealProtein, mealCarb, mealFat float64

			meal := models.Meal{
				MealID: mealID,
				DayID:  dayID,
				Type:   mealReq.Type,
				Time:   mealReq.Time,
			}

			if err := tx.Create(&meal).Error; err != nil {
				tx.Rollback()
				return schemas.DietPlan{}, err
			}

			for k, foodReq := range mealReq.Foods {
				foodID := fmt.Sprintf("F%s%d", mealID, k+1)
				ing := ingIdx[strings.ToLower(strings.TrimSpace(foodReq.Name))]
				cal, protein, carbohydrate, fat := nutrientsForPortion(ing, foodReq.Amount, foodReq.Calories, foodReq.Protein, foodReq.Carbohydrate, foodReq.Fat)

				food := models.Food{
					FoodID:       foodID,
					MealID:       mealID,
					Name:         foodReq.Name,
					Amount:       foodReq.Amount,
					Calories:     cal,
					Protein:      roundNutrient1(protein),
					Carbohydrate: roundNutrient1(carbohydrate),
					Fat:          roundNutrient1(fat),
				}

				if err := tx.Create(&food).Error; err != nil {
					tx.Rollback()
					return schemas.DietPlan{}, err
				}
				mealCal += cal
				mealProtein += protein
				mealCarb += carbohydrate
				mealFat += fat
			}

			meal.Calories = mealCal
			meal.Protein = roundNutrient1(mealProtein)
			meal.Carbohydrate = roundNutrient1(mealCarb)
			meal.Fat = roundNutrient1(mealFat)
			if err := tx.Save(&meal).Error; err != nil {
				tx.Rollback()
				return schemas.DietPlan{}, err
			}

			dayCal += mealCal
			dayProtein += mealProtein
			dayCarb += mealCarb
			dayFat += mealFat
		}

		day.Calories = dayCal
		day.Protein = roundNutrient1(dayProtein)
		day.Carbohydrate = roundNutrient1(dayCarb)
		day.Fat = roundNutrient1(dayFat)
		if err := tx.Save(&day).Error; err != nil {
			tx.Rollback()
			return schemas.DietPlan{}, err
		}
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return schemas.DietPlan{}, err
	}

	dietitianNames := NewServiceRequestService().DietitianNamesByIDs([]string{plan.DietitianID})
	return schemas.DietPlan{
		PlanID:          plan.PlanID,
		UserID:          plan.UserID,
		ServiceRequestID: plan.ServiceRequestID,
		DietitianID:     plan.DietitianID,
		DietitianName:   dietitianNames[plan.DietitianID],
		PlanTitle:       plan.PlanTitle,
		Source:          plan.Source,
		DietGoal:        plan.DietGoal,
		CycleDays:       plan.CycleDays,
		AuditStatus:     plan.AuditStatus,
		PublishedAt:     plan.PublishedAt,
		UpdatedAt:       plan.UpdatedAt,
	}, nil
}

// PublishDietPlan 发布膳食计划
func (s *DietPlanService) PublishDietPlan(planID, userID, actorDietitianID string) (schemas.DietPlan, error) {
	// 检查膳食计划是否存在
	var plan models.DietPlan
	if err := config.DB.Where("plan_id = ? AND user_id = ?", planID, userID).First(&plan).Error; err != nil {
		return schemas.DietPlan{}, err
	}

	if actorDietitianID != "" {
		plan.DietitianID = actorDietitianID
	}

	// 更新状态为已发布
	plan.AuditStatus = "published"
	plan.PublishedAt = time.Now()
	plan.UpdatedAt = time.Now()

	if err := fillDietPlanFromApprovedServiceRequest(config.DB, &plan, plan.ServiceRequestID, ""); err != nil {
		return schemas.DietPlan{}, err
	}
	if strings.TrimSpace(plan.DietGoal) == "" {
		plan.DietGoal = "—"
	}

	if err := config.DB.Save(&plan).Error; err != nil {
		return schemas.DietPlan{}, err
	}

	dietitianNames := NewServiceRequestService().DietitianNamesByIDs([]string{plan.DietitianID})
	return schemas.DietPlan{
		PlanID:          plan.PlanID,
		UserID:          plan.UserID,
		ServiceRequestID: plan.ServiceRequestID,
		DietitianID:     plan.DietitianID,
		DietitianName:   dietitianNames[plan.DietitianID],
		PlanTitle:       plan.PlanTitle,
		Source:          plan.Source,
		DietGoal:        plan.DietGoal,
		CycleDays:       plan.CycleDays,
		AuditStatus:     plan.AuditStatus,
		PublishedAt:     plan.PublishedAt,
		UpdatedAt:       plan.UpdatedAt,
	}, nil
}

// markServiceRequestsCompletedForUserPlan 用户删除膳食计划时，将关联服务申请置为 completed（任务结束）
func markServiceRequestsCompletedForUserPlan(tx *gorm.DB, plan *models.DietPlan, userID string) error {
	if plan == nil {
		return nil
	}
	rid := strings.TrimSpace(plan.ServiceRequestID)
	if rid != "" {
		res := tx.Model(&models.ServiceRequest{}).
			Where("request_id = ? AND user_id = ?", rid, userID).
			Where("status NOT IN ?", []string{"completed", "cancelled", "rejected"}).
			Updates(map[string]interface{}{
				"status":      "completed",
				"update_time": time.Now(),
			})
		return res.Error
	}
	if strings.TrimSpace(plan.DietitianID) == "" {
		return nil
	}
	res := tx.Model(&models.ServiceRequest{}).
		Where("user_id = ? AND dietitian_id = ? AND status IN ?", userID, plan.DietitianID, []string{"approved", "pending"}).
		Updates(map[string]interface{}{
			"status":      "completed",
			"update_time": time.Now(),
		})
	return res.Error
}

// DeleteDietPlan 删除膳食计划
func (s *DietPlanService) DeleteDietPlan(planID, userID string) error {
	var plan models.DietPlan
	err := config.DB.Where("plan_id = ? AND user_id = ?", planID, userID).First(&plan).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			var anyPlan models.DietPlan
			if err2 := config.DB.Where("plan_id = ?", planID).First(&anyPlan).Error; err2 == nil {
				return ErrDietPlanForbidden
			}
			return ErrDietPlanNotFound
		}
		return err
	}

	// 开始事务
	tx := config.DB.Begin()

	if err := markServiceRequestsCompletedForUserPlan(tx, &plan, userID); err != nil {
		tx.Rollback()
		return err
	}

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