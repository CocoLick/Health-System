package schemas

// NutritionPhotoRecognizeRequest 拍照识别请求
type NutritionPhotoRecognizeRequest struct {
	ImageBase64 string `json:"image_base64" binding:"required"`
	MealType    string `json:"meal_type"`
}

// NutritionPhotoRecognizeItem 识别出的食物项
type NutritionPhotoRecognizeItem struct {
	Name        string                `json:"name"`
	Confidence  float64               `json:"confidence"`
	Amount      float64               `json:"amount"`
	Unit        string                `json:"unit"`
	GramPerUnit float64               `json:"gram_per_unit"`
	Nutrition   NutritionTotalRequest `json:"nutrition"`
	Matched     bool                  `json:"matched"`
}

// NutritionPhotoRecognizeResponse 拍照识别响应
type NutritionPhotoRecognizeResponse struct {
	RecognizedFoods       []NutritionPhotoRecognizeItem `json:"recognized_foods"`
	PreviewTotalNutrition NutritionTotalRequest         `json:"preview_total_nutrition"`
}
