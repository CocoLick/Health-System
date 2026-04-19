package models

import (
	"encoding/json"
	"time"
)

// Ingredient 食材模型
type Ingredient struct {
	IngredientID  string    `json:"ingredient_id" gorm:"primaryKey"`
	Name          string    `json:"name" gorm:"not null"`
	Category      string    `json:"category" gorm:"not null"`
	Calorie100g   float64   `json:"calorie_100g" gorm:"column:calories_per_100g;not null"` // 每100克热量
	Nutrition100g string    `json:"nutrition_100g" gorm:"type:text;not null"` // 每100克营养成分，JSON格式
	Unit          string    `json:"unit" gorm:"column:unit;not null;default:'g'"` // 常用单位
	GramPerUnit   float64   `json:"gram_per_unit" gorm:"column:gram_per_unit;default:100"` // 每个单位等于多少克
	Status        string    `json:"status" gorm:"default:'enabled'"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// NutritionDetails 营养成分详情结构
type NutritionDetails struct {
	Protein      float64 `json:"protein"`      // 蛋白质 (g/100g)
	Carbohydrate float64 `json:"carbohydrate"` // 碳水化合物 (g/100g)
	Fat          float64 `json:"fat"`          // 脂肪 (g/100g)
	Fiber        float64 `json:"fiber,omitempty"` // 膳食纤维 (g/100g)
	VitaminC     float64 `json:"vitamin_c,omitempty"` // 维生素C (mg/100g)
	Calcium      float64 `json:"calcium,omitempty"` // 钙 (mg/100g)
	Iron         float64 `json:"iron,omitempty"` // 铁 (mg/100g)
}

// GetNutritionDetails 获取营养成分详情
func (i *Ingredient) GetNutritionDetails() (NutritionDetails, error) {
	var details NutritionDetails
	err := json.Unmarshal([]byte(i.Nutrition100g), &details)
	return details, err
}

// SetNutritionDetails 设置营养成分详情
func (i *Ingredient) SetNutritionDetails(details NutritionDetails) error {
	data, err := json.Marshal(details)
	if err != nil {
		return err
	}
	i.Nutrition100g = string(data)
	i.Calorie100g = calculateCalories(details)
	return nil
}

// calculateCalories 根据营养成分计算热量
// 蛋白质和碳水化合物每克4千卡，脂肪每克9千卡
func calculateCalories(details NutritionDetails) float64 {
	return details.Protein*4 + details.Carbohydrate*4 + details.Fat*9
}

// TableName 指定表名
func (Ingredient) TableName() string {
	return "ingredient"
}