package schemas

import "time"

// HealthDataRequest 健康数据请求
type HealthDataRequest struct {
	Gender        string    `json:"gender" binding:"required"`
	Age           int       `json:"age" binding:"required"`
	Height        float64   `json:"height" binding:"required"`
	Weight        float64   `json:"weight" binding:"required"`
	BloodPressure string    `json:"blood_pressure"`
	BloodSugar    float64   `json:"blood_sugar"`
	HeartRate     int       `json:"heart_rate"`
	AllergyHistory string   `json:"allergy_history"`
	ActivityLevel string    `json:"activity_level"`
	NutritionGoal   string    `json:"nutrition_goal"`
}

type UpdateHealthDataRequest struct {
	Gender        string    `json:"gender"`
	Age           int       `json:"age"`
	Height        float64   `json:"height"`
	Weight        float64   `json:"weight"`
	BloodPressure string    `json:"blood_pressure"`
	BloodSugar    float64   `json:"blood_sugar"`
	HeartRate     int       `json:"heart_rate"`
	AllergyHistory string   `json:"allergy_history"`
	ActivityLevel string    `json:"activity_level"`
	NutritionGoal   string    `json:"nutrition_goal"`
}

type HealthDataResponse struct {
	DataID        string    `json:"data_id"`
	UserID        string    `json:"user_id"`
	Gender        string    `json:"gender"`
	Age           int       `json:"age"`
	Height        float64   `json:"height"`
	Weight        float64   `json:"weight"`
	BloodPressure string    `json:"blood_pressure"`
	BloodSugar    float64   `json:"blood_sugar"`
	HeartRate     int       `json:"heart_rate"`
	AllergyHistory string   `json:"allergy_history"`
	ActivityLevel string    `json:"activity_level"`
	NutritionGoal   string    `json:"nutrition_goal"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}