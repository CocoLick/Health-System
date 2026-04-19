package schemas

import "time"

// IngredientRequest 食材请求
type IngredientRequest struct {
	Name          string           `json:"name" binding:"required"`
	Category      string           `json:"category" binding:"required"`
	Nutrition100g NutritionDetails `json:"nutrition_100g" binding:"required"`
	Unit          string           `json:"unit"`
	GramPerUnit   float64          `json:"gram_per_unit" binding:"omitempty,gte=0"`
}

// NutritionDetails 营养成分详情
type NutritionDetails struct {
	Protein      float64 `json:"protein" binding:"required,gte=0"`
	Carbohydrate float64 `json:"carbohydrate" binding:"required,gte=0"`
	Fat          float64 `json:"fat" binding:"required,gte=0"`
	Fiber        float64 `json:"fiber,omitempty" binding:"gte=0"`
	VitaminC     float64 `json:"vitamin_c,omitempty" binding:"gte=0"`
	Calcium      float64 `json:"calcium,omitempty" binding:"gte=0"`
	Iron         float64 `json:"iron,omitempty" binding:"gte=0"`
}

// IngredientResponse 食材响应
type IngredientResponse struct {
	IngredientID  string           `json:"ingredient_id"`
	Name          string           `json:"name"`
	Category      string           `json:"category"`
	Calorie100g   float64          `json:"calorie_100g"`
	Nutrition100g NutritionDetails `json:"nutrition_100g"`
	Unit          string           `json:"unit"`
	GramPerUnit   float64          `json:"gram_per_unit"`
	Status        string           `json:"status"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`
}

// IngredientListResponse 食材列表响应
type IngredientListResponse struct {
	Ingredients []IngredientResponse `json:"ingredients"`
	Total       int64                `json:"total"`
}

// IngredientStatusRequest 食材状态更新请求
type IngredientStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=enabled disabled"`
}