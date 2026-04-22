package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"

	"gorm.io/gorm"
)

var ErrNutritionEvaluationForbidden = errors.New("无权访问该营养评估")
var ErrNutritionEvaluationNotFound = errors.New("营养评估不存在")

type NutritionEvaluationService struct {
	db *gorm.DB
}

func NewNutritionEvaluationService() *NutritionEvaluationService {
	return &NutritionEvaluationService{db: config.DB}
}

func (s *NutritionEvaluationService) dietitianHasServiceRelation(dietitianID, userID string) bool {
	var n int64
	s.db.Model(&models.ServiceRequest{}).
		Where("dietitian_id = ? AND user_id = ? AND status IN ?", dietitianID, userID, []string{"pending", "approved"}).
		Count(&n)
	return n > 0
}

func computeBMI(heightCm, weightKg float64) *float64 {
	if heightCm <= 0 || weightKg <= 0 {
		return nil
	}
	m := heightCm / 100.0
	if m <= 0 {
		return nil
	}
	v := weightKg / (m * m)
	v = math.Round(v*10) / 10
	return &v
}

func marshalJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func parsePriorityIssuesJSON(s string) []string {
	if strings.TrimSpace(s) == "" || s == "null" {
		return nil
	}
	var arr []string
	if json.Unmarshal([]byte(s), &arr) == nil {
		return arr
	}
	return nil
}

func parseSnapshotJSON(s string) map[string]interface{} {
	out := map[string]interface{}{}
	if strings.TrimSpace(s) == "" {
		return out
	}
	_ = json.Unmarshal([]byte(s), &out)
	return out
}

// EvaluationToResponse 转为 API 结构
func EvaluationToResponse(ev *models.NutritionEvaluation) schemas.NutritionEvaluationResponse {
	return toModelResponse(ev)
}

func toModelResponse(ev *models.NutritionEvaluation) schemas.NutritionEvaluationResponse {
	return schemas.NutritionEvaluationResponse{
		EvaluationID:           ev.EvaluationID,
		UserID:                 ev.UserID,
		DietitianID:            ev.DietitianID,
		ServiceRequestID:       ev.ServiceRequestID,
		Source:                 ev.Source,
		Status:                 ev.Status,
		BMI:                    ev.BMI,
		EnergyNeedKcal:         ev.EnergyNeedKcal,
		NutritionStatus:        ev.NutritionStatus,
		BodyCompositionText:    ev.BodyCompositionText,
		DietaryPatternText:     ev.DietaryPatternText,
		MicronutrientText:      ev.MicronutrientText,
		RisksText:              ev.RisksText,
		PriorityIssues:         parsePriorityIssuesJSON(ev.PriorityIssuesJSON),
		ProfessionalConclusion: ev.ProfessionalConclusion,
		PlanRecommendations:    ev.PlanRecommendations,
		InputSnapshot:          parseSnapshotJSON(ev.InputSnapshotJSON),
		ValidUntil:             ev.ValidUntil,
		CreatedAt:              ev.CreatedAt,
		UpdatedAt:              ev.UpdatedAt,
	}
}

// CreateEvaluation 规划师为用户创建评估
func (s *NutritionEvaluationService) CreateEvaluation(dietitianID string, req schemas.NutritionEvaluationCreate) (*models.NutritionEvaluation, error) {
	userID := strings.TrimSpace(req.UserID)
	if userID == "" {
		return nil, fmt.Errorf("user_id 不能为空")
	}
	if !s.dietitianHasServiceRelation(dietitianID, userID) {
		return nil, ErrNutritionEvaluationForbidden
	}

	var hd models.HealthData
	_ = s.db.Where("user_id = ?", userID).Order("updated_at DESC").First(&hd).Error

	bmi := req.BMI
	if bmi == nil && hd.Height > 0 && hd.Weight > 0 {
		bmi = computeBMI(hd.Height, hd.Weight)
	}

	srid := strings.TrimSpace(req.ServiceRequestID)
	if srid != "" {
		var sr models.ServiceRequest
		if err := s.db.Where("request_id = ? AND dietitian_id = ? AND user_id = ?", srid, dietitianID, userID).First(&sr).Error; err != nil {
			return nil, fmt.Errorf("无效的服务申请或未绑定当前用户")
		}
	}

	priorityJSON := marshalJSON(req.PriorityIssues)
	if priorityJSON == "null" {
		priorityJSON = "[]"
	}

	var sr models.ServiceRequest
	_ = s.db.Where("dietitian_id = ? AND user_id = ?", dietitianID, userID).Order("create_time DESC").First(&sr).Error
	snapshot := map[string]interface{}{
		"health_data_id":     hd.DataID,
		"height_cm":          hd.Height,
		"weight_kg":          hd.Weight,
		"activity_level":     hd.ActivityLevel,
		"nutrition_goal":     hd.NutritionGoal,
		"service_diet_goal":  sr.DietGoal,
		"service_other_goal": sr.OtherGoal,
		"blood_pressure":     hd.BloodPressure,
		"blood_sugar":        hd.BloodSugar,
		"allergy_history":    hd.AllergyHistory,
	}

	var validUntil *time.Time
	if req.ValidUntil != nil && strings.TrimSpace(*req.ValidUntil) != "" {
		t, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(*req.ValidUntil), time.Local)
		if err == nil {
			validUntil = &t
		}
	}
	if validUntil == nil {
		t := time.Now().AddDate(0, 3, 0).Truncate(24 * time.Hour)
		validUntil = &t
	}

	evID := fmt.Sprintf("EV%d", time.Now().UnixNano())
	if len(evID) > 32 {
		evID = evID[:32]
	}

	ev := &models.NutritionEvaluation{
		EvaluationID:           evID,
		UserID:                 userID,
		DietitianID:            dietitianID,
		ServiceRequestID:       srid,
		Source:                 "professional",
		Status:                 "submitted",
		BMI:                    bmi,
		EnergyNeedKcal:         req.EnergyNeedKcal,
		NutritionStatus:        strings.TrimSpace(req.NutritionStatus),
		BodyCompositionText:    strings.TrimSpace(req.BodyCompositionText),
		DietaryPatternText:     strings.TrimSpace(req.DietaryPatternText),
		MicronutrientText:      strings.TrimSpace(req.MicronutrientText),
		RisksText:              strings.TrimSpace(req.RisksText),
		PriorityIssuesJSON:     priorityJSON,
		ProfessionalConclusion: strings.TrimSpace(req.ProfessionalConclusion),
		PlanRecommendations:    strings.TrimSpace(req.PlanRecommendations),
		InputSnapshotJSON:      marshalJSON(snapshot),
		ValidUntil:             validUntil,
		CreatedAt:              time.Now(),
		UpdatedAt:              time.Now(),
	}

	if err := s.db.Create(ev).Error; err != nil {
		return nil, err
	}
	return ev, nil
}

// ListByUserForDietitian 规划师查看某用户的评估列表（须存在服务关系）
func (s *NutritionEvaluationService) ListByUserForDietitian(dietitianID, userID string, limit int) ([]schemas.NutritionEvaluationResponse, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, fmt.Errorf("user_id 不能为空")
	}
	if !s.dietitianHasServiceRelation(dietitianID, userID) {
		return nil, ErrNutritionEvaluationForbidden
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var rows []models.NutritionEvaluation
	q := s.db.Where("user_id = ? AND dietitian_id = ?", userID, dietitianID).Order("created_at DESC").Limit(limit)
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]schemas.NutritionEvaluationResponse, 0, len(rows))
	for i := range rows {
		out = append(out, toModelResponse(&rows[i]))
	}
	return out, nil
}

// ListMine 普通用户查看自己的评估
func (s *NutritionEvaluationService) ListMine(userID string, limit int) ([]schemas.NutritionEvaluationResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var rows []models.NutritionEvaluation
	if err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]schemas.NutritionEvaluationResponse, 0, len(rows))
	for i := range rows {
		out = append(out, toModelResponse(&rows[i]))
	}
	return out, nil
}

// GetByID 获取单条；用户仅可看自己的，规划师可看自己出具的
func (s *NutritionEvaluationService) GetByID(id, actorUserID, actorRole string) (schemas.NutritionEvaluationResponse, error) {
	var ev models.NutritionEvaluation
	if err := s.db.Where("evaluation_id = ?", id).First(&ev).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return schemas.NutritionEvaluationResponse{}, ErrNutritionEvaluationNotFound
		}
		return schemas.NutritionEvaluationResponse{}, err
	}
	switch actorRole {
	case "user":
		if ev.UserID != actorUserID {
			return schemas.NutritionEvaluationResponse{}, ErrNutritionEvaluationForbidden
		}
	case "dietitian":
		if ev.DietitianID != actorUserID {
			return schemas.NutritionEvaluationResponse{}, ErrNutritionEvaluationForbidden
		}
	default:
		return schemas.NutritionEvaluationResponse{}, ErrNutritionEvaluationForbidden
	}
	return toModelResponse(&ev), nil
}

// UserHasEvaluationFromDietitian 用于服务用户列表
func (s *NutritionEvaluationService) UserHasEvaluationFromDietitian(dietitianID, userID string) bool {
	var n int64
	s.db.Model(&models.NutritionEvaluation{}).
		Where("user_id = ? AND dietitian_id = ?", userID, dietitianID).
		Count(&n)
	return n > 0
}
