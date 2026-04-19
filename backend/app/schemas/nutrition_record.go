package schemas

import "time"

// NutritionRecordItemRequest 营养记录明细请求
type NutritionRecordItemRequest struct {
	FoodName   string  `json:"name" binding:"required"`
	Amount     float64 `json:"amount" binding:"required"`
	Unit       string  `json:"unit"`
	GramPerUnit float64 `json:"gram_per_unit"`
	Calories   float64 `json:"calories"`
	Protein    float64 `json:"protein"`
	Carbohydrate float64 `json:"carbohydrate"`
	Fat        float64 `json:"fat"`
	Fiber      float64 `json:"fiber"`
}

// NutritionRecordRequest 营养记录请求
type NutritionRecordRequest struct {
	MealType      string                      `json:"meal_type" binding:"required"`
	Foods         []NutritionRecordItemRequest `json:"foods" binding:"required"`
	TotalNutrition NutritionTotalRequest       `json:"total_nutrition"`
}

// NutritionTotalRequest 营养总计请求
type NutritionTotalRequest struct {
	Calories    float64 `json:"calories"`
	Protein    float64 `json:"protein"`
	Carbohydrate float64 `json:"carbohydrate"`
	Fat        float64 `json:"fat"`
	Fiber      float64 `json:"fiber"`
}

// NutritionRecordResponse 营养记录响应
type NutritionRecordResponse struct {
	RecordID   string                      `json:"record_id"`
	UserID     string                      `json:"user_id"`
	MealDate   string                      `json:"meal_date"`
	MealType   string                      `json:"meal_type"`
	TotalNutrition NutritionTotalResponse   `json:"total_nutrition"`
	Items      []NutritionRecordItemResponse `json:"items"`
	CreatedAt  time.Time                   `json:"created_at"`
}

// NutritionRecordItemResponse 营养记录明细响应
type NutritionRecordItemResponse struct {
	ItemID     string  `json:"item_id"`
	FoodName   string  `json:"food_name"`
	Amount     float64 `json:"amount"`
	Unit       string  `json:"unit"`
	GramPerUnit float64 `json:"gram_per_unit"`
	Calories   float64 `json:"calories"`
	Protein    float64 `json:"protein"`
	Carbohydrate float64 `json:"carbohydrate"`
	Fat        float64 `json:"fat"`
	Fiber      float64 `json:"fiber"`
}

// NutritionTotalResponse 营养总计响应
type NutritionTotalResponse struct {
	Calories    float64 `json:"calories"`
	Protein    float64 `json:"protein"`
	Carbohydrate float64 `json:"carbohydrate"`
	Fat        float64 `json:"fat"`
	Fiber      float64 `json:"fiber"`
}