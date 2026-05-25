package models

import (
	"time"
)

// DietPlan 膳食计划模型
type DietPlan struct {
	PlanID           string     `json:"plan_id" gorm:"primaryKey;column:plan_id"`
	UserID           string     `json:"user_id" gorm:"column:user_id"`
	ServiceRequestID string     `json:"service_request_id" gorm:"column:service_request_id"`
	DietitianID      string     `json:"dietitian_id" gorm:"column:dietitian_id"`
	PlanTitle        string     `json:"plan_title" gorm:"column:plan_title"`
	Source           string     `json:"source" gorm:"column:source"`
	DietGoal         string     `json:"diet_goal" gorm:"column:diet_goal"`
	CycleDays        int        `json:"cycle_days" gorm:"column:cycle_days"`
	AuditStatus      string     `json:"audit_status" gorm:"column:audit_status"`
	AuditNote        string     `json:"audit_note" gorm:"column:audit_note"`
	AuditedBy        string     `json:"audited_by" gorm:"column:audited_by"`
	AuditedAt        *time.Time `json:"audited_at" gorm:"column:audited_at"`
	PublishedAt      time.Time  `json:"published_at" gorm:"column:published_at"`
	UpdatedAt        time.Time  `json:"updated_at" gorm:"column:updated_at"`
	PlanDays         []PlanDay  `json:"plan_days,omitempty" gorm:"foreignKey:PlanID"`
}

// TableName 指定表名
func (DietPlan) TableName() string {
	return "diet_plan"
}

// PlanDay 天计划模型
type PlanDay struct {
	DayID        string    `json:"day_id" gorm:"primaryKey;column:day_id"`
	PlanID       string    `json:"plan_id" gorm:"column:plan_id;index"`
	DayIndex     int       `json:"day_index" gorm:"column:day_index"`
	PlanDate     time.Time `json:"plan_date" gorm:"column:plan_date"`
	Calories     int       `json:"calories" gorm:"column:calories"`
	Protein      float64   `json:"protein" gorm:"column:protein"`
	Carbohydrate float64   `json:"carbohydrate" gorm:"column:carbohydrate"`
	Fat          float64   `json:"fat" gorm:"column:fat"`
	Meals        []Meal    `json:"meals,omitempty" gorm:"foreignKey:DayID"`
}

// TableName 指定表名
func (PlanDay) TableName() string {
	return "plan_days"
}

// Meal 餐次模型
type Meal struct {
	MealID       string  `json:"meal_id" gorm:"primaryKey;column:meal_id"`
	DayID        string  `json:"day_id" gorm:"column:day_id;index"`
	Type         string  `json:"type" gorm:"column:type"`
	Time         string  `json:"time" gorm:"column:time"`
	Calories     int     `json:"calories" gorm:"column:calories"`
	Protein      float64 `json:"protein" gorm:"column:protein"`
	Carbohydrate float64 `json:"carbohydrate" gorm:"column:carbohydrate"`
	Fat          float64 `json:"fat" gorm:"column:fat"`
	Foods        []Food  `json:"foods,omitempty" gorm:"foreignKey:MealID"`
	Executed     bool    `json:"executed,omitempty" gorm:"column:executed"`
}

// TableName 指定表名
func (Meal) TableName() string {
	return "meals"
}

// Food 食物模型
type Food struct {
	FoodID       string  `json:"food_id" gorm:"primaryKey;column:food_id"`
	MealID       string  `json:"meal_id" gorm:"column:meal_id;index"`
	Name         string  `json:"name" gorm:"column:name"`
	Amount       string  `json:"amount" gorm:"column:amount"`
	Calories     int     `json:"calories" gorm:"column:calories"`
	Protein      float64 `json:"protein" gorm:"column:protein"`
	Carbohydrate float64 `json:"carbohydrate" gorm:"column:carbohydrate"`
	Fat          float64 `json:"fat" gorm:"column:fat"`
}

// TableName 指定表名
func (Food) TableName() string {
	return "foods"
}

// PlanExecution 计划执行模型（表 plan_execution 由迁移建表，业务未使用：
// 计划打卡状态由 meals.executed 字段维护，无对本模型的读写。）
type PlanExecution struct {
	ExecutionID string    `json:"execution_id" gorm:"primaryKey;column:execution_id"`
	DayID       string    `json:"day_id" gorm:"column:day_id;index"`
	MealID      string    `json:"meal_id" gorm:"column:meal_id;index"`
	UserID      string    `json:"user_id" gorm:"column:user_id;index"`
	Executed    bool      `json:"executed" gorm:"column:executed"`
	ExecuteTime time.Time `json:"execute_time" gorm:"column:execute_time"`
}

// TableName 指定表名
func (PlanExecution) TableName() string {
	return "plan_execution"
}
