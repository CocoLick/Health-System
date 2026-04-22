package schemas

import "time"

// NutritionEvaluationCreate 规划师创建评估请求
type NutritionEvaluationCreate struct {
	UserID                 string   `json:"user_id" binding:"required"`
	ServiceRequestID       string   `json:"service_request_id"`
	NutritionStatus        string   `json:"nutrition_status"`
	BMI                    *float64 `json:"bmi"`
	EnergyNeedKcal         *int     `json:"energy_need_kcal"`
	BodyCompositionText    string   `json:"body_composition_text"`
	DietaryPatternText     string   `json:"dietary_pattern_text"`
	MicronutrientText      string   `json:"micronutrient_text"`
	RisksText              string   `json:"risks_text"`
	PriorityIssues         []string `json:"priority_issues"`
	ProfessionalConclusion string   `json:"professional_conclusion" binding:"required"`
	PlanRecommendations    string   `json:"plan_recommendations"`
	ValidUntil             *string  `json:"valid_until"` // YYYY-MM-DD
}

// NutritionEvaluationResponse API 返回
type NutritionEvaluationResponse struct {
	EvaluationID           string                 `json:"evaluation_id"`
	UserID                 string                 `json:"user_id"`
	DietitianID            string                 `json:"dietitian_id"`
	ServiceRequestID       string                 `json:"service_request_id"`
	Source                 string                 `json:"source"`
	Status                 string                 `json:"status"`
	BMI                    *float64               `json:"bmi"`
	EnergyNeedKcal         *int                   `json:"energy_need_kcal"`
	NutritionStatus        string                 `json:"nutrition_status"`
	BodyCompositionText    string                 `json:"body_composition_text"`
	DietaryPatternText     string                 `json:"dietary_pattern_text"`
	MicronutrientText      string                 `json:"micronutrient_text"`
	RisksText              string                 `json:"risks_text"`
	PriorityIssues         []string               `json:"priority_issues"`
	ProfessionalConclusion string                 `json:"professional_conclusion"`
	PlanRecommendations    string                 `json:"plan_recommendations"`
	InputSnapshot          map[string]interface{} `json:"input_snapshot"`
	ValidUntil             *time.Time             `json:"valid_until"`
	CreatedAt              time.Time              `json:"created_at"`
	UpdatedAt              time.Time              `json:"updated_at"`
}
