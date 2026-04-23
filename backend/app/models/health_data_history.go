package models

import "time"

// HealthDataHistory 健康数据历史快照
type HealthDataHistory struct {
	HistoryID       string    `gorm:"primaryKey;column:history_id;size:40" json:"history_id"`
	DataID          string    `gorm:"column:data_id;size:40;index" json:"data_id"`
	UserID          string    `gorm:"column:user_id;size:50;index" json:"user_id"`
	Gender          string    `gorm:"column:gender" json:"gender"`
	Age             int       `gorm:"column:age" json:"age"`
	Height          float64   `gorm:"column:height" json:"height"`
	Weight          float64   `gorm:"column:weight" json:"weight"`
	HeartRate       int       `gorm:"column:heart_rate" json:"heart_rate"`
	BloodPressure   string    `gorm:"column:blood_pressure" json:"blood_pressure"`
	BloodSugar      float64   `gorm:"column:blood_sugar" json:"blood_sugar"`
	AllergyHistory  string    `gorm:"column:allergy_history" json:"allergy_history"`
	ActivityLevel   string    `gorm:"column:activity_level" json:"activity_level"`
	NutritionGoal   string    `gorm:"column:nutrition_goal" json:"nutrition_goal"`
	Source          string    `gorm:"column:source;size:24" json:"source"` // submit | update
	SnapshotAt      time.Time `gorm:"column:snapshot_at;index" json:"snapshot_at"`
	CreatedAt       time.Time `gorm:"column:created_at" json:"created_at"`
}

func (HealthDataHistory) TableName() string {
	return "health_data_history"
}
