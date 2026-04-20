package schemas

// NutritionTarget 营养目标
type NutritionTarget struct {
	Calories     float64 `json:"calories"`
	Protein      float64 `json:"protein"`
	Carbohydrate float64 `json:"carbohydrate"`
	Fat          float64 `json:"fat"`
}

// NutritionRecommendationResponse 营养推荐响应
type NutritionRecommendationResponse struct {
	BMR           float64        `json:"bmr"`
	TotalCalories float64        `json:"total_calories"`
	ActivityLevel string         `json:"activity_level"`
	Nutrients     NutritionTarget `json:"nutrients"`
}
