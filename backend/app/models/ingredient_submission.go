package models

import "time"

// IngredientSubmission 用户提交食材工单
type IngredientSubmission struct {
	SubmissionID             string    `json:"submission_id" gorm:"primaryKey"`
	UserID                   string    `json:"user_id" gorm:"not null;index"`
	IngredientIDPrivate      string    `json:"ingredient_id_private" gorm:"not null;index"`
	SubmittedName            string    `json:"submitted_name" gorm:"not null"`
	SubmittedCategory        string    `json:"submitted_category" gorm:"not null"`
	SubmittedCaloriesPer100g float64   `json:"submitted_calories_per_100g" gorm:"not null"`
	SubmittedNutrition100g   string    `json:"submitted_nutrition_100g" gorm:"type:text;not null"`
	SubmittedUnit            string    `json:"submitted_unit" gorm:"not null;default:'g'"`
	SubmittedGramPerUnit     float64   `json:"submitted_gram_per_unit" gorm:"default:100"`
	AutoCalcCalories         float64   `json:"auto_calc_calories" gorm:"not null"`
	AutoDeltaRatio           float64   `json:"auto_delta_ratio" gorm:"not null"`
	AutoCheckResult          string    `json:"auto_check_result" gorm:"size:20;not null;index"` // pass/warn/abnormal
	WorkflowStatus           string    `json:"workflow_status" gorm:"size:20;not null;default:'pending';index"`
	ReviewerID               string    `json:"reviewer_id" gorm:"size:64"`
	ReviewNote               string    `json:"review_note" gorm:"type:text"`
	CreatedAt                time.Time `json:"created_at"`
	UpdatedAt                time.Time `json:"updated_at"`
}

func (IngredientSubmission) TableName() string {
	return "ingredient_submission"
}
