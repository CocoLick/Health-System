package services

import (
	"fmt"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"
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
	query := config.DB.Model(&models.Ingredient{})
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
	if err := config.DB.Model(&models.Ingredient{}).Where("name LIKE ? OR category LIKE ?", "%"+keyword+"%", "%"+keyword+"%").Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (page - 1) * pageSize
	if err := config.DB.Where("name LIKE ? OR category LIKE ?", "%"+keyword+"%", "%"+keyword+"%").Offset(offset).Limit(pageSize).Find(&ingredients).Error; err != nil {
		return nil, 0, err
	}

	return ingredients, total, nil
}
