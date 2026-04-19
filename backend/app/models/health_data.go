package models

import (
	"time"
)

// HealthData 健康数据模型
type HealthData struct {
	DataID        string    `gorm:"column:data_id;primaryKey" json:"data_id"`
	UserID        string    `gorm:"column:user_id;not null;index" json:"user_id"`
	Height        float64   `gorm:"column:height" json:"height"`
	Weight        float64   `gorm:"column:weight" json:"weight"`
	BloodPressure string    `gorm:"column:blood_pressure" json:"blood_pressure"`
	BloodSugar    float64   `gorm:"column:blood_sugar" json:"blood_sugar"`
	HeartRate     int       `gorm:"column:heart_rate" json:"heart_rate"`
	AllergyHistory string   `gorm:"column:allergy_history" json:"allergy_history"`
	CreatedAt     time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt     time.Time `gorm:"column:updated_at;not null" json:"updated_at"`
}

// TableName 指定表名
func (HealthData) TableName() string {
	return "health_data"
}