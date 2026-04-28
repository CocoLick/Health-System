package services

import (
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"
	"gorm.io/gorm"
)

// IngredientService 食材服务
type IngredientService struct{}

// NewIngredientService 创建食材服务实例
func NewIngredientService() *IngredientService {
	return &IngredientService{}
}

// CreateIngredient 创建食材
func (s *IngredientService) CreateIngredient(req schemas.IngredientRequest) (*models.Ingredient, error) {
	ingredient := &models.Ingredient{
		IngredientID: fmt.Sprintf("IG%s", time.Now().Format("20060102150405")),
		Name:         req.Name,
		Category:     req.Category,
		Unit:         req.Unit,
		GramPerUnit:  req.GramPerUnit,
		Scope:        "public",
		SourceType:   "admin_created",
		ReviewStatus: "approved",
		RiskLevel:    "normal",
		Status:       "enabled",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// 转换营养成分详情
	nutritionDetails := models.NutritionDetails{
		Protein:      req.Nutrition100g.Protein,
		Carbohydrate: req.Nutrition100g.Carbohydrate,
		Fat:          req.Nutrition100g.Fat,
		Fiber:        req.Nutrition100g.Fiber,
		VitaminC:     req.Nutrition100g.VitaminC,
		Calcium:      req.Nutrition100g.Calcium,
		Iron:         req.Nutrition100g.Iron,
	}

	if err := ingredient.SetNutritionDetails(nutritionDetails); err != nil {
		return nil, err
	}

	if err := config.DB.Create(ingredient).Error; err != nil {
		return nil, err
	}

	return ingredient, nil
}

// GetIngredientByID 根据ID获取食材
func (s *IngredientService) GetIngredientByID(ingredientID string) (*models.Ingredient, error) {
	var ingredient models.Ingredient
	if err := config.DB.Where("ingredient_id = ?", ingredientID).First(&ingredient).Error; err != nil {
		return nil, err
	}
	return &ingredient, nil
}

// GetIngredientList 获取食材列表
func (s *IngredientService) GetIngredientList(category string, page, pageSize int) ([]models.Ingredient, int64, error) {
	var ingredients []models.Ingredient
	var total int64

	// 构建查询
	query := config.DB.Model(&models.Ingredient{}).Where("status = ?", "enabled").Where("(scope = ? OR scope = '' OR scope IS NULL)", "public")
	if category != "" {
		query = query.Where("category = ?", category)
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&ingredients).Error; err != nil {
		return nil, 0, err
	}

	return ingredients, total, nil
}

// UpdateIngredient 更新食材
func (s *IngredientService) UpdateIngredient(ingredientID string, req schemas.IngredientRequest) (*models.Ingredient, error) {
	ingredient, err := s.GetIngredientByID(ingredientID)
	if err != nil {
		return nil, err
	}

	ingredient.Name = req.Name
	ingredient.Category = req.Category
	ingredient.Unit = req.Unit
	ingredient.GramPerUnit = req.GramPerUnit
	ingredient.UpdatedAt = time.Now()

	// 转换营养成分详情
	nutritionDetails := models.NutritionDetails{
		Protein:      req.Nutrition100g.Protein,
		Carbohydrate: req.Nutrition100g.Carbohydrate,
		Fat:          req.Nutrition100g.Fat,
		Fiber:        req.Nutrition100g.Fiber,
		VitaminC:     req.Nutrition100g.VitaminC,
		Calcium:      req.Nutrition100g.Calcium,
		Iron:         req.Nutrition100g.Iron,
	}

	if err := ingredient.SetNutritionDetails(nutritionDetails); err != nil {
		return nil, err
	}

	if err := config.DB.Save(ingredient).Error; err != nil {
		return nil, err
	}

	return ingredient, nil
}

// UpdateIngredientStatus 更新食材状态
func (s *IngredientService) UpdateIngredientStatus(ingredientID string, status string) error {
	return config.DB.Model(&models.Ingredient{}).Where("ingredient_id = ?", ingredientID).Updates(map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}).Error
}

// DeleteIngredient 删除食材
func (s *IngredientService) DeleteIngredient(ingredientID string) error {
	return config.DB.Where("ingredient_id = ?", ingredientID).Delete(&models.Ingredient{}).Error
}

// SearchIngredients 搜索食材
func (s *IngredientService) SearchIngredients(keyword string, page, pageSize int) ([]models.Ingredient, int64, error) {
	var ingredients []models.Ingredient
	var total int64

	// 计算总数
	baseQuery := config.DB.Model(&models.Ingredient{}).
		Where("status = ?", "enabled").
		Where("(scope = ? OR scope = '' OR scope IS NULL)", "public").
		Where("name LIKE ? OR category LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	if err := baseQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (page - 1) * pageSize
	if err := baseQuery.Offset(offset).Limit(pageSize).Find(&ingredients).Error; err != nil {
		return nil, 0, err
	}

	return ingredients, total, nil
}

func (s *IngredientService) GetUserVisibleIngredients(userID, category string, page, pageSize int) ([]models.Ingredient, int64, error) {
	var ingredients []models.Ingredient
	var total int64
	query := config.DB.Model(&models.Ingredient{}).
		Where("status = ?", "enabled").
		Where("(scope = ? OR (scope = ? AND owner_user_id = ?))", "public", "private", userID)
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&ingredients).Error; err != nil {
		return nil, 0, err
	}
	return ingredients, total, nil
}

func (s *IngredientService) CreateIngredientSubmission(userID string, req schemas.IngredientSubmissionRequest) (*models.IngredientSubmission, *models.Ingredient, error) {
	now := time.Now()
	if req.Unit == "" {
		req.Unit = "g"
	}
	if req.GramPerUnit <= 0 {
		req.GramPerUnit = 100
	}
	autoCalories := req.Nutrition100g.Protein*4 + req.Nutrition100g.Carbohydrate*4 + req.Nutrition100g.Fat*9
	base := req.Calorie100g
	if base <= 0 {
		base = 1
	}
	delta := math.Abs(req.Calorie100g-autoCalories) / base
	checkResult := "pass"
	riskLevel := "normal"
	riskScore := 0
	switch {
	case delta > 0.2:
		checkResult = "abnormal"
		riskLevel = "abnormal"
		riskScore = 90
	}
	nutriJSON, err := json.Marshal(models.NutritionDetails{
		Protein:      req.Nutrition100g.Protein,
		Carbohydrate: req.Nutrition100g.Carbohydrate,
		Fat:          req.Nutrition100g.Fat,
		Fiber:        req.Nutrition100g.Fiber,
		VitaminC:     req.Nutrition100g.VitaminC,
		Calcium:      req.Nutrition100g.Calcium,
		Iron:         req.Nutrition100g.Iron,
	})
	if err != nil {
		return nil, nil, err
	}
	privateIngredientID := fmt.Sprintf("IG%s", now.Format("20060102150405"))
	submissionID := fmt.Sprintf("IS%s", now.Format("20060102150405"))
	privateIngredient := &models.Ingredient{
		IngredientID:       privateIngredientID,
		Name:               req.Name,
		Category:           req.Category,
		Calorie100g:        req.Calorie100g,
		Nutrition100g:      string(nutriJSON),
		Unit:               req.Unit,
		GramPerUnit:        req.GramPerUnit,
		Scope:              "private",
		OwnerUserID:        userID,
		SourceType:         "user_submission",
		SourceSubmissionID: submissionID,
		ReviewStatus:       "pending",
		RiskLevel:          riskLevel,
		RiskScore:          riskScore,
		Status:             "enabled",
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	submission := &models.IngredientSubmission{
		SubmissionID:             submissionID,
		UserID:                   userID,
		IngredientIDPrivate:      privateIngredientID,
		SubmittedName:            req.Name,
		SubmittedCategory:        req.Category,
		SubmittedCaloriesPer100g: req.Calorie100g,
		SubmittedNutrition100g:   string(nutriJSON),
		SubmittedUnit:            req.Unit,
		SubmittedGramPerUnit:     req.GramPerUnit,
		AutoCalcCalories:         autoCalories,
		AutoDeltaRatio:           delta,
		AutoCheckResult:          checkResult,
		WorkflowStatus:           "pending",
		CreatedAt:                now,
		UpdatedAt:                now,
	}
	err = config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(privateIngredient).Error; err != nil {
			return err
		}
		if err := tx.Create(submission).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return submission, privateIngredient, nil
}

func (s *IngredientService) GetIngredientSubmissions(workflowStatus string, page, pageSize int) ([]models.IngredientSubmission, int64, error) {
	var items []models.IngredientSubmission
	var total int64
	query := config.DB.Model(&models.IngredientSubmission{})
	if workflowStatus != "" {
		query = query.Where("workflow_status = ?", workflowStatus)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := query.Order("CASE auto_check_result WHEN 'abnormal' THEN 0 ELSE 1 END, created_at DESC").
		Offset(offset).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (s *IngredientService) GetUserIngredientSubmissions(userID, workflowStatus string, page, pageSize int) ([]models.IngredientSubmission, int64, error) {
	var items []models.IngredientSubmission
	var total int64
	query := config.DB.Model(&models.IngredientSubmission{}).Where("user_id = ?", userID)
	if workflowStatus != "" {
		query = query.Where("workflow_status = ?", workflowStatus)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := query.Order("updated_at DESC").Offset(offset).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (s *IngredientService) ApproveIngredientSubmission(submissionID, reviewerID, reviewNote string) error {
	return config.DB.Transaction(func(tx *gorm.DB) error {
		var submission models.IngredientSubmission
		if err := tx.Where("submission_id = ?", submissionID).First(&submission).Error; err != nil {
			return err
		}
		// 审核通过时直接把用户私有记录升级为公共记录，避免同名双记录
		if err := tx.Model(&models.Ingredient{}).
			Where("ingredient_id = ?", submission.IngredientIDPrivate).
			Updates(map[string]interface{}{
				"scope":         "public",
				"owner_user_id": "",
				"review_status": "approved",
				"status":        "enabled",
				"updated_at":    time.Now(),
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.IngredientSubmission{}).
			Where("submission_id = ?", submissionID).
			Updates(map[string]interface{}{
				"workflow_status": "approved",
				"reviewer_id":     reviewerID,
				"review_note":     reviewNote,
				"updated_at":      time.Now(),
			}).Error; err != nil {
			return err
		}
		return nil
	})
}

func (s *IngredientService) ReturnIngredientSubmission(submissionID, reviewerID, reviewNote string) error {
	return config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.IngredientSubmission{}).
			Where("submission_id = ?", submissionID).
			Updates(map[string]interface{}{
				"workflow_status": "returned",
				"reviewer_id":     reviewerID,
				"review_note":     reviewNote,
				"updated_at":      time.Now(),
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Ingredient{}).
			Where("source_submission_id = ?", submissionID).
			Updates(map[string]interface{}{
				"review_status": "returned",
				"updated_at":    time.Now(),
			}).Error; err != nil {
			return err
		}
		return nil
	})
}

func (s *IngredientService) ResubmitIngredientSubmission(userID, submissionID string, req schemas.IngredientSubmissionRequest) error {
	now := time.Now()
	if req.Unit == "" {
		req.Unit = "g"
	}
	if req.GramPerUnit <= 0 {
		req.GramPerUnit = 100
	}
	autoCalories := req.Nutrition100g.Protein*4 + req.Nutrition100g.Carbohydrate*4 + req.Nutrition100g.Fat*9
	base := req.Calorie100g
	if base <= 0 {
		base = 1
	}
	delta := math.Abs(req.Calorie100g-autoCalories) / base
	checkResult := "pass"
	riskLevel := "normal"
	riskScore := 0
	switch {
	case delta > 0.2:
		checkResult = "abnormal"
		riskLevel = "abnormal"
		riskScore = 90
	}
	nutriJSON, err := json.Marshal(models.NutritionDetails{
		Protein:      req.Nutrition100g.Protein,
		Carbohydrate: req.Nutrition100g.Carbohydrate,
		Fat:          req.Nutrition100g.Fat,
		Fiber:        req.Nutrition100g.Fiber,
		VitaminC:     req.Nutrition100g.VitaminC,
		Calcium:      req.Nutrition100g.Calcium,
		Iron:         req.Nutrition100g.Iron,
	})
	if err != nil {
		return err
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		var submission models.IngredientSubmission
		if err := tx.Where("submission_id = ? AND user_id = ?", submissionID, userID).First(&submission).Error; err != nil {
			return err
		}
		if submission.WorkflowStatus != "returned" {
			return fmt.Errorf("仅已退回的提交可重新提交")
		}
		if err := tx.Model(&models.Ingredient{}).
			Where("ingredient_id = ?", submission.IngredientIDPrivate).
			Updates(map[string]interface{}{
				"name":              req.Name,
				"category":          req.Category,
				"calories_per_100g": req.Calorie100g,
				"nutrition100g":     string(nutriJSON),
				"unit":              req.Unit,
				"gram_per_unit":     req.GramPerUnit,
				"review_status":     "pending",
				"risk_level":        riskLevel,
				"risk_score":        riskScore,
				"status":            "enabled",
				"updated_at":        now,
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.IngredientSubmission{}).
			Where("submission_id = ?", submissionID).
			Updates(map[string]interface{}{
				"submitted_name":             req.Name,
				"submitted_category":         req.Category,
				"submitted_calories_per100g": req.Calorie100g,
				"submitted_nutrition100g":    string(nutriJSON),
				"submitted_unit":             req.Unit,
				"submitted_gram_per_unit":    req.GramPerUnit,
				"auto_calc_calories":         autoCalories,
				"auto_delta_ratio":           delta,
				"auto_check_result":          checkResult,
				"workflow_status":            "pending",
				"reviewer_id":                "",
				"review_note":                "",
				"updated_at":                 now,
			}).Error; err != nil {
			return err
		}
		return nil
	})
}

func (s *IngredientService) ApproveIngredientSubmissionWithEdit(submissionID, reviewerID string, req schemas.IngredientApproveWithEditRequest) error {
	if req.Unit == "" {
		req.Unit = "g"
	}
	if req.GramPerUnit <= 0 {
		req.GramPerUnit = 100
	}
	autoCalories := req.Nutrition100g.Protein*4 + req.Nutrition100g.Carbohydrate*4 + req.Nutrition100g.Fat*9
	base := req.Calorie100g
	if base <= 0 {
		base = 1
	}
	delta := math.Abs(req.Calorie100g-autoCalories) / base
	checkResult := "pass"
	riskLevel := "normal"
	riskScore := 0
	if delta > 0.2 {
		checkResult = "abnormal"
		riskLevel = "abnormal"
		riskScore = 90
	}
	nutriJSON, err := json.Marshal(models.NutritionDetails{
		Protein:      req.Nutrition100g.Protein,
		Carbohydrate: req.Nutrition100g.Carbohydrate,
		Fat:          req.Nutrition100g.Fat,
		Fiber:        req.Nutrition100g.Fiber,
		VitaminC:     req.Nutrition100g.VitaminC,
		Calcium:      req.Nutrition100g.Calcium,
		Iron:         req.Nutrition100g.Iron,
	})
	if err != nil {
		return err
	}
	return config.DB.Transaction(func(tx *gorm.DB) error {
		var submission models.IngredientSubmission
		if err := tx.Where("submission_id = ?", submissionID).First(&submission).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Ingredient{}).
			Where("ingredient_id = ?", submission.IngredientIDPrivate).
			Updates(map[string]interface{}{
				"name":              req.Name,
				"category":          req.Category,
				"calories_per_100g": req.Calorie100g,
				"nutrition100g":     string(nutriJSON),
				"unit":              req.Unit,
				"gram_per_unit":     req.GramPerUnit,
				"scope":             "public",
				"owner_user_id":     "",
				"review_status":     "approved",
				"risk_level":        riskLevel,
				"risk_score":        riskScore,
				"status":            "enabled",
				"updated_at":        time.Now(),
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.IngredientSubmission{}).
			Where("submission_id = ?", submissionID).
			Updates(map[string]interface{}{
				"submitted_name":             req.Name,
				"submitted_category":         req.Category,
				"submitted_calories_per100g": req.Calorie100g,
				"submitted_nutrition100g":    string(nutriJSON),
				"submitted_unit":             req.Unit,
				"submitted_gram_per_unit":    req.GramPerUnit,
				"auto_calc_calories":         autoCalories,
				"auto_delta_ratio":           delta,
				"auto_check_result":          checkResult,
				"workflow_status":            "approved",
				"reviewer_id":                reviewerID,
				"review_note":                req.ReviewNote,
				"updated_at":                 time.Now(),
			}).Error; err != nil {
			return err
		}
		return nil
	})
}
