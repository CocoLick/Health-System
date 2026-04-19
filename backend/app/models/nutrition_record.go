package models

import (
	"time"
)

// NutritionRecord 营养记录主表模型
type NutritionRecord struct {
	RecordID         string    `json:"record_id" gorm:"primaryKey"`
	UserID           string    `json:"user_id" gorm:"not null;index"`
	MealDate         string    `json:"meal_date" gorm:"type:date;not null"`
	MealType         string    `json:"meal_type" gorm:"type:varchar(20);not null"`
	TotalCalories    float64   `json:"total_calories" gorm:"type:decimal(10,2);default:0"`
	TotalProtein     float64   `json:"total_protein" gorm:"type:decimal(10,2);default:0"`
	TotalCarbohydrate float64   `json:"total_carbohydrate" gorm:"type:decimal(10,2);default:0"`
	TotalFat         float64   `json:"total_fat" gorm:"type:decimal(10,2);default:0"`
	TotalFiber       float64   `json:"total_fiber" gorm:"type:decimal(10,2);default:0"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	Items            []NutritionRecordItem `json:"items" gorm:"foreignKey:RecordID;references:RecordID"`
}

// TableName 指定表名
func (NutritionRecord) TableName() string {
	return "nutrition_record"
}

// NutritionRecordItem 营养记录明细模型
type NutritionRecordItem struct {
	ItemID     string  `json:"item_id" gorm:"primaryKey"`
	RecordID   string  `json:"record_id" gorm:"not null;index"`
	FoodName   string  `json:"food_name" gorm:"type:varchar(100);not null"`
	Amount     float64 `json:"amount" gorm:"type:decimal(10,2);not null"`
	Unit       string  `json:"unit" gorm:"type:varchar(20);default:'g'"`
	GramPerUnit float64 `json:"gram_per_unit" gorm:"type:decimal(10,2);default:100"`
	Calories   float64 `json:"calories" gorm:"type:decimal(10,2);default:0"`
	Protein    float64 `json:"protein" gorm:"type:decimal(10,2);default:0"`
	Carbohydrate float64 `json:"carbohydrate" gorm:"type:decimal(10,2);default:0"`
	Fat        float64 `json:"fat" gorm:"type:decimal(10,2);default:0"`
	Fiber      float64 `json:"fiber" gorm:"type:decimal(10,2);default:0"`
}

// TableName 指定表名
func (NutritionRecordItem) TableName() string {
	return "nutrition_record_item"
}