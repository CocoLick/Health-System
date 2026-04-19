package schemas

import "time"

// HealthDataRequest 健康数据请求
type HealthDataRequest struct {
	Height        float64 `json:"height" binding:"required"`
	Weight        float64 `json:"weight" binding:"required"`
	BloodPressure string  `json:"blood_pressure"`
	BloodSugar    float64 `json:"blood_sugar"`
	HeartRate     int     `json:"heart_rate"`
	AllergyHistory string `json:"allergy_history"`
}

// UpdateHealthDataRequest 更新健康数据请求
type UpdateHealthDataRequest struct {
	DataID        string  `json:"data_id" binding:"required"`
	Height        float64 `json:"height"`
	Weight        float64 `json:"weight"`
	BloodPressure string  `json:"blood_pressure"`
	BloodSugar    float64 `json:"blood_sugar"`
	HeartRate     int     `json:"heart_rate"`
	AllergyHistory string `json:"allergy_history"`
}

// HealthDataResponse 健康数据响应
type HealthDataResponse struct {
	DataID        string    `json:"data_id"`
	UserID        string    `json:"user_id"`
	Height        float64   `json:"height"`
	Weight        float64   `json:"weight"`
	BloodPressure string    `json:"blood_pressure"`
	BloodSugar    float64   `json:"blood_sugar"`
	HeartRate     int       `json:"heart_rate"`
	AllergyHistory string   `json:"allergy_history"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}