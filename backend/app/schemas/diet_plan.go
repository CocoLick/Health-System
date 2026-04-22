package schemas

import (
	"time"
)

// DietPlanCreate 创建膳食计划请求
type DietPlanCreate struct {
	UserID          string        `json:"user_id"`
	ServiceRequestID string        `json:"service_request_id"`
	DietitianID     string        `json:"dietitian_id"` // 规划师端可由 JWT 自动补全
	PlanTitle       string        `json:"plan_title" binding:"required"`
	Source          string        `json:"source" binding:"required"`
	DietGoal        string        `json:"diet_goal"` // 可由服务端根据已通过的服务申请自动写入
	CycleDays       int           `json:"cycle_days" binding:"required"`
	PlanDays        []PlanDayCreate `json:"plan_days" binding:"required"`
}

// PlanDayCreate 创建天计划请求
type PlanDayCreate struct {
	DayIndex     int           `json:"day_index" binding:"required"`
	PlanDate     string        `json:"plan_date" binding:"required"`
	Calories     int           `json:"calories" binding:"required"`
	Protein      float64       `json:"protein" binding:"required"`
	Carbohydrate float64       `json:"carbohydrate" binding:"required"`
	Fat          float64       `json:"fat" binding:"required"`
	Meals        []MealCreate  `json:"meals" binding:"required"`
}

// MealCreate 创建餐次请求
type MealCreate struct {
	Type          string       `json:"type" binding:"required"`
	Time          string       `json:"time" binding:"required"`
	Calories      int          `json:"calories" binding:"required"`
	Protein       float64      `json:"protein"`
	Carbohydrate  float64      `json:"carbohydrate"`
	Fat           float64      `json:"fat"`
	Foods         []FoodCreate `json:"foods" binding:"required"`
}

// FoodCreate 创建食物请求
type FoodCreate struct {
	Name          string  `json:"name" binding:"required"`
	Amount        string  `json:"amount" binding:"required"`
	Calories      int     `json:"calories" binding:"required"`
	Protein       float64 `json:"protein"`
	Carbohydrate  float64 `json:"carbohydrate"`
	Fat           float64 `json:"fat"`
}

// DietPlanUpdate 更新膳食计划请求
type DietPlanUpdate struct {
	PlanTitle string        `json:"plan_title"`
	DietGoal  string        `json:"diet_goal"`
	CycleDays int           `json:"cycle_days"`
	PlanDays  []PlanDayUpdate `json:"plan_days"`
}

// PlanDayUpdate 更新天计划请求（服务会重建天/餐/食物，前端可不传 day_id）
type PlanDayUpdate struct {
	DayID        string        `json:"day_id"`
	DayIndex     int           `json:"day_index"`
	PlanDate     string        `json:"plan_date"`
	Calories     int           `json:"calories"`
	Protein      float64       `json:"protein"`
	Carbohydrate float64       `json:"carbohydrate"`
	Fat          float64       `json:"fat"`
	Meals        []MealUpdate  `json:"meals"`
}

// MealUpdate 更新餐次请求
type MealUpdate struct {
	MealID        string       `json:"meal_id"`
	Type          string       `json:"type"`
	Time          string       `json:"time"`
	Calories      int          `json:"calories"`
	Protein       float64      `json:"protein"`
	Carbohydrate  float64      `json:"carbohydrate"`
	Fat           float64      `json:"fat"`
	Foods         []FoodUpdate `json:"foods"`
}

// FoodUpdate 更新食物请求（与详情返回的 `id` 对应，可用 id 或 food_id）
type FoodUpdate struct {
	FoodID        string  `json:"food_id"`
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Amount        string  `json:"amount"`
	Calories      int     `json:"calories"`
	Protein       float64 `json:"protein"`
	Carbohydrate  float64 `json:"carbohydrate"`
	Fat           float64 `json:"fat"`
}

// DietPlan 膳食计划响应
type DietPlan struct {
	PlanID          string    `json:"id"`
	UserID          string    `json:"user_id"`
	ServiceRequestID string    `json:"service_request_id"`
	DietitianID     string    `json:"dietitian_id"`
	DietitianName   string    `json:"dietitian_name"`
	PlanTitle       string    `json:"title"`
	Source          string    `json:"source"`
	DietGoal        string    `json:"goal"`
	CycleDays       int       `json:"cycle_days"`
	AuditStatus     string    `json:"status"`
	PublishedAt     time.Time `json:"create_time"`
	UpdatedAt       time.Time `json:"update_time"`
}

// DietPlanDetail 膳食计划详情响应
type DietPlanDetail struct {
	PlanID          string    `json:"id"`
	UserID          string    `json:"user_id"`
	ServiceRequestID string    `json:"service_request_id"`
	DietitianID     string    `json:"dietitian_id"`
	DietitianName   string    `json:"dietitian_name"`
	PlanTitle       string    `json:"title"`
	Source          string    `json:"source"`
	DietGoal        string    `json:"goal"`
	CycleDays       int       `json:"cycle_days"`
	AuditStatus     string    `json:"status"`
	PublishedAt     time.Time `json:"create_time"`
	UpdatedAt       time.Time `json:"update_time"`
	PlanDays        []PlanDayDetail `json:"plan_days"`
}

// PlanDayDetail 天计划详情响应
type PlanDayDetail struct {
	DayID        string       `json:"id"`
	PlanID       string       `json:"plan_id"`
	DayIndex     int          `json:"day_index"`
	PlanDate     string       `json:"date"`
	Calories     int          `json:"calories"`
	Protein      float64      `json:"protein"`
	Carbohydrate float64      `json:"carbohydrate"`
	Fat          float64      `json:"fat"`
	Meals        []MealDetail `json:"meals"`
}

// MealDetail 餐次详情响应
type MealDetail struct {
	MealID   string       `json:"id"`
	DayID    string       `json:"day_id"`
	Type     string       `json:"type"`
	Time     string       `json:"time"`
	Calories int          `json:"calories"`
	Foods    []FoodDetail `json:"foods"`
	Executed bool         `json:"executed"`
}

// FoodDetail 食物详情响应
type FoodDetail struct {
	FoodID   string `json:"id"`
	MealID   string `json:"meal_id"`
	Name     string `json:"name"`
	Amount   string `json:"amount"`
	Calories int    `json:"calories"`
}

// ExecutionStatusUpdate 执行状态更新请求
type ExecutionStatusUpdate struct {
	DayID     string `json:"day_id" binding:"required"`
	MealID    string `json:"meal_id" binding:"required"`
	Executed  bool   `json:"executed" binding:"required"`
}

// OptimizationRequest 优化请求
type OptimizationRequest struct {
	RequestTime string `json:"request_time" binding:"required"`
	Reason      string `json:"reason"`
}