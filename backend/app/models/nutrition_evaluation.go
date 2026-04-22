package models

import (
	"time"
)

// NutritionEvaluation 个性化营养评估（规划师出具）
type NutritionEvaluation struct {
	EvaluationID           string     `gorm:"column:evaluation_id;primaryKey;size:32" json:"evaluation_id"`
	UserID                 string     `gorm:"column:user_id;size:20;not null;index" json:"user_id"`
	DietitianID            string     `gorm:"column:dietitian_id;size:20;not null;index" json:"dietitian_id"`
	ServiceRequestID       string     `gorm:"column:service_request_id;size:32;index" json:"service_request_id"`
	Source                 string     `gorm:"column:source;size:20;not null;default:professional" json:"source"`
	Status                 string     `gorm:"column:status;size:20;not null;default:submitted" json:"status"`
	BMI                    *float64   `gorm:"column:bmi" json:"bmi"`
	EnergyNeedKcal         *int       `gorm:"column:energy_need_kcal" json:"energy_need_kcal"`
	NutritionStatus        string     `gorm:"column:nutrition_status;size:64" json:"nutrition_status"`
	BodyCompositionText    string     `gorm:"column:body_composition_text;type:text" json:"body_composition_text"`
	DietaryPatternText     string     `gorm:"column:dietary_pattern_text;type:text" json:"dietary_pattern_text"`
	MicronutrientText      string     `gorm:"column:micronutrient_text;type:text" json:"micronutrient_text"`
	RisksText              string     `gorm:"column:risks_text;type:text" json:"risks_text"`
	PriorityIssuesJSON     string     `gorm:"column:priority_issues_json;type:text" json:"priority_issues_json"`
	ProfessionalConclusion string     `gorm:"column:professional_conclusion;type:text;not null" json:"professional_conclusion"`
	PlanRecommendations    string     `gorm:"column:plan_recommendations;type:text" json:"plan_recommendations"`
	InputSnapshotJSON      string     `gorm:"column:input_snapshot_json;type:text" json:"input_snapshot_json"`
	ValidUntil             *time.Time `gorm:"column:valid_until;type:date" json:"valid_until"`
	CreatedAt              time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt              time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (NutritionEvaluation) TableName() string {
	return "nutrition_evaluation"
}
