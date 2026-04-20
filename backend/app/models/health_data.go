package models

import (
	"time"
)

// HealthData 健康数据模型
type HealthData struct {
	DataID         string    `gorm:"primaryKey;column:data_id" json:"data_id"`
	UserID         uint      `gorm:"column:user_id" json:"user_id"`
	Gender         string    `gorm:"column:gender" json:"gender"`
	Age            int       `gorm:"column:age" json:"age"`
	Height         float64   `gorm:"column:height" json:"height"`
	Weight         float64   `gorm:"column:weight" json:"weight"`
	HeartRate      int       `gorm:"column:heart_rate" json:"heart_rate"`
	BloodPressure  string    `gorm:"column:blood_pressure" json:"blood_pressure"`
	BloodSugar     float64   `gorm:"column:blood_sugar" json:"blood_sugar"`
	AllergyHistory string    `gorm:"column:allergy_history" json:"allergy_history"`
	ActivityLevel  string    `gorm:"column:activity_level" json:"activity_level"`
	NutritionGoal  string    `gorm:"column:nutrition_goal" json:"nutrition_goal"`
	CreatedAt      time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt      time.Time `gorm:"column:updated_at" json:"updated_at"`
}

// TableName 指定表名
func (HealthData) TableName() string {
	return "health_data"
}