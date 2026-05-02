package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"
	"gorm.io/gorm"
)

func generateIngredientID() string {
	return fmt.Sprintf("IG%x", uint64(time.Now().UnixNano()))
}

func ingredientFromSubmissionSnapshot(sub *models.IngredientSubmission, ingredientID, submissionID string, now time.Time) *models.Ingredient {
	riskLevel := "normal"
	riskScore := 0
	if sub.AutoCheckResult == "abnormal" {
		riskLevel = "abnormal"
		riskScore = 90
	}
	return &models.Ingredient{
		IngredientID:       ingredientID,
		Name:               sub.SubmittedName,
		Category:           sub.SubmittedCategory,
		Calorie100g:        sub.SubmittedCaloriesPer100g,
		Nutrition100g:      sub.SubmittedNutrition100g,
		Unit:               sub.SubmittedUnit,
		GramPerUnit:        sub.SubmittedGramPerUnit,
		Scope:              "public",
		OwnerUserID:        "",
		SourceType:         "user_submission",
		SourceSubmissionID: submissionID,
		ReviewStatus:       "approved",
		RiskLevel:          riskLevel,
		RiskScore:          riskScore,
		Status:             "enabled",
		CreatedAt:          now,
		UpdatedAt:          now,
	}
}

func ingredientFromApproveEdit(req schemas.IngredientApproveWithEditRequest, ingredientID, submissionID string, now time.Time) (*models.Ingredient, error) {
	autoCalories := req.Nutrition100g.Protein*4 + req.Nutrition100g.Carbohydrate*4 + req.Nutrition100g.Fat*9
	base := req.Calorie100g
	if base <= 0 {
		base = 1
	}
	delta := math.Abs(req.Calorie100g-autoCalories) / base
	riskLevel := "normal"
	riskScore := 0
	if delta > 0.2 {
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
		return nil, err
	}
	return &models.Ingredient{
		IngredientID:       ingredientID,
		Name:               req.Name,
		Category:           req.Category,
		Calorie100g:        req.Calorie100g,
		Nutrition100g:      string(nutriJSON),
		Unit:               req.Unit,
		GramPerUnit:        req.GramPerUnit,
		Scope:              "public",
		OwnerUserID:        "",
		SourceType:         "user_submission",
		SourceSubmissionID: submissionID,
		ReviewStatus:       "approved",
		RiskLevel:          riskLevel,
		RiskScore:          riskScore,
		Status:             "enabled",
		CreatedAt:          now,
		UpdatedAt:          now,
	}, nil
}

func markSubmissionApproved(tx *gorm.DB, submissionID, reviewerID, reviewNote string, now time.Time) error {
	return tx.Model(&models.IngredientSubmission{}).
		Where("submission_id = ?", submissionID).
		Updates(map[string]interface{}{
			"workflow_status": "approved",
			"reviewer_id":     reviewerID,
			"review_note":     reviewNote,
			"updated_at":      now,
		}).Error
}

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

	// 构建查询（仅已审核通过的公共食材）
	query := config.DB.Model(&models.Ingredient{}).
		Where("status = ?", "enabled").
		Where("(scope = ? OR scope = '' OR scope IS NULL)", "public").
		Where("(review_status = ? OR review_status = '' OR review_status IS NULL)", "approved")
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
		Where("(review_status = ? OR review_status = '' OR review_status IS NULL)", "approved").
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
	// 仅展示已审核通过的食材：待审工单不再对应可记账的 ingredient 行（方案 A）
	query := config.DB.Model(&models.Ingredient{}).
		Where("status = ?", "enabled").
		Where(`(
			(scope = 'public' AND (review_status = 'approved' OR review_status = '' OR review_status IS NULL))
			OR (scope = 'private' AND owner_user_id = ? AND review_status = 'approved')
		)`, userID)
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
	if delta > 0.2 {
		checkResult = "abnormal"
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
	submissionID := fmt.Sprintf("IS%s", now.Format("20060102150405"))
	submission := &models.IngredientSubmission{
		SubmissionID:             submissionID,
		UserID:                   userID,
		IngredientIDPrivate:      "",
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
	if err := config.DB.Create(submission).Error; err != nil {
		return nil, nil, err
	}
	return submission, nil, nil
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
		if submission.WorkflowStatus != "pending" {
			return fmt.Errorf("仅待审核的工单可通过审核")
		}
		now := time.Now()

		// 兼容旧数据：此前已生成 pending 私有 ingredient 行则升级为公共
		if submission.IngredientIDPrivate != "" {
			var existing models.Ingredient
			err := tx.Where("ingredient_id = ?", submission.IngredientIDPrivate).First(&existing).Error
			if err == nil {
				if err := tx.Model(&models.Ingredient{}).
					Where("ingredient_id = ?", submission.IngredientIDPrivate).
					Updates(map[string]interface{}{
						"scope":          "public",
						"owner_user_id":  "",
						"review_status":  "approved",
						"status":         "enabled",
						"updated_at":     now,
					}).Error; err != nil {
					return err
				}
				return markSubmissionApproved(tx, submissionID, reviewerID, reviewNote, now)
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
		}

		ingID := generateIngredientID()
		ing := ingredientFromSubmissionSnapshot(&submission, ingID, submissionID, now)
		if err := tx.Create(ing).Error; err != nil {
			return err
		}
		return tx.Model(&models.IngredientSubmission{}).
			Where("submission_id = ?", submissionID).
			Updates(map[string]interface{}{
				"ingredient_id_private": ingID,
				"workflow_status":       "approved",
				"reviewer_id":           reviewerID,
				"review_note":           reviewNote,
				"updated_at":            now,
			}).Error
	})
}

func (s *IngredientService) ReturnIngredientSubmission(submissionID, reviewerID, reviewNote string) error {
	return config.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Model(&models.IngredientSubmission{}).
			Where("submission_id = ?", submissionID).
			Updates(map[string]interface{}{
				"workflow_status": "returned",
				"reviewer_id":     reviewerID,
				"review_note":     reviewNote,
				"updated_at":      now,
			}).Error; err != nil {
			return err
		}
		// 方案 A 待审工单无 ingredient 行；旧数据可能存在 pending 私有行
		if err := tx.Model(&models.Ingredient{}).
			Where("source_submission_id = ?", submissionID).
			Updates(map[string]interface{}{
				"review_status": "returned",
				"updated_at":    now,
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

		if submission.IngredientIDPrivate != "" {
			var ing models.Ingredient
			err := tx.Where("ingredient_id = ?", submission.IngredientIDPrivate).First(&ing).Error
			if err == nil {
				ing.Name = req.Name
				ing.Category = req.Category
				ing.Calorie100g = req.Calorie100g
				ing.Nutrition100g = string(nutriJSON)
				ing.Unit = req.Unit
				ing.GramPerUnit = req.GramPerUnit
				ing.ReviewStatus = "pending"
				ing.RiskLevel = riskLevel
				ing.RiskScore = riskScore
				ing.Status = "enabled"
				ing.UpdatedAt = now
				if err := tx.Save(&ing).Error; err != nil {
					return err
				}
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
		}

		submission.SubmittedName = req.Name
		submission.SubmittedCategory = req.Category
		submission.SubmittedCaloriesPer100g = req.Calorie100g
		submission.SubmittedNutrition100g = string(nutriJSON)
		submission.SubmittedUnit = req.Unit
		submission.SubmittedGramPerUnit = req.GramPerUnit
		submission.AutoCalcCalories = autoCalories
		submission.AutoDeltaRatio = delta
		submission.AutoCheckResult = checkResult
		submission.WorkflowStatus = "pending"
		submission.ReviewerID = ""
		submission.ReviewNote = ""
		submission.UpdatedAt = now
		return tx.Save(&submission).Error
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
	nutriStr := string(nutriJSON)
	return config.DB.Transaction(func(tx *gorm.DB) error {
		var submission models.IngredientSubmission
		if err := tx.Where("submission_id = ?", submissionID).First(&submission).Error; err != nil {
			return err
		}
		if submission.WorkflowStatus != "pending" {
			return fmt.Errorf("仅待审核的工单可审核")
		}
		now := time.Now()

		updatedIngredient := false
		if submission.IngredientIDPrivate != "" {
			var existing models.Ingredient
			err := tx.Where("ingredient_id = ?", submission.IngredientIDPrivate).First(&existing).Error
			if err == nil {
				existing.Name = req.Name
				existing.Category = req.Category
				existing.Calorie100g = req.Calorie100g
				existing.Nutrition100g = nutriStr
				existing.Unit = req.Unit
				existing.GramPerUnit = req.GramPerUnit
				existing.Scope = "public"
				existing.OwnerUserID = ""
				existing.ReviewStatus = "approved"
				existing.RiskLevel = riskLevel
				existing.RiskScore = riskScore
				existing.Status = "enabled"
				existing.UpdatedAt = now
				if err := tx.Save(&existing).Error; err != nil {
					return err
				}
				updatedIngredient = true
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
		}
		if !updatedIngredient {
			ingID := generateIngredientID()
			ing, err := ingredientFromApproveEdit(req, ingID, submissionID, now)
			if err != nil {
				return err
			}
			if err := tx.Create(ing).Error; err != nil {
				return err
			}
			submission.IngredientIDPrivate = ingID
		}

		submission.SubmittedName = req.Name
		submission.SubmittedCategory = req.Category
		submission.SubmittedCaloriesPer100g = req.Calorie100g
		submission.SubmittedNutrition100g = nutriStr
		submission.SubmittedUnit = req.Unit
		submission.SubmittedGramPerUnit = req.GramPerUnit
		submission.AutoCalcCalories = autoCalories
		submission.AutoDeltaRatio = delta
		submission.AutoCheckResult = checkResult
		submission.WorkflowStatus = "approved"
		submission.ReviewerID = reviewerID
		submission.ReviewNote = req.ReviewNote
		submission.UpdatedAt = now
		return tx.Save(&submission).Error
	})
}
