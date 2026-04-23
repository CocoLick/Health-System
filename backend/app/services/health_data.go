package services

import (
	"fmt"
	"math"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"
)

// HealthDataService 健康数据服务
type HealthDataService struct{}

// NewHealthDataService 创建健康数据服务实例
func NewHealthDataService() *HealthDataService {
	return &HealthDataService{}
}

// generateDataID 生成健康数据ID
func generateDataID() string {
	now := time.Now()
	return fmt.Sprintf("HD%s%04d", now.Format("20060102"), now.UnixNano()%10000)
}

func generateHistoryID() string {
	now := time.Now()
	return fmt.Sprintf("HDH%s%06d", now.Format("20060102150405"), now.UnixNano()%1000000)
}

// SubmitHealthData 提交健康数据
func (s *HealthDataService) SubmitHealthData(userID string, req schemas.HealthDataRequest) (*models.HealthData, error) {
	gender := canonicalGender(req.Gender)
	if gender == "" {
		gender = req.Gender
	}
	healthData := &models.HealthData{
		DataID:         generateDataID(),
		UserID:         userID,
		Gender:         gender,
		Age:            req.Age,
		Height:         req.Height,
		Weight:         req.Weight,
		HeartRate:      req.HeartRate,
		BloodPressure:  req.BloodPressure,
		BloodSugar:     req.BloodSugar,
		AllergyHistory: req.AllergyHistory,
		ActivityLevel:  req.ActivityLevel,
		NutritionGoal:  req.NutritionGoal,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := config.DB.Create(healthData).Error; err != nil {
		return nil, err
	}
	if err := s.appendHistorySnapshot(healthData, "submit"); err != nil {
		return nil, err
	}

	return healthData, nil
}

// GetLatestHealthData 获取最新健康数据
func (s *HealthDataService) GetLatestHealthData(userID string) (*models.HealthData, error) {
	var healthData models.HealthData
	err := config.DB.Where("user_id = ?", userID).Order("created_at DESC").First(&healthData).Error
	if err != nil {
		return nil, err
	}
	return &healthData, nil
}

// GetHealthDataList 获取健康数据列表
func (s *HealthDataService) GetHealthDataList(userID string) ([]models.HealthData, error) {
	var healthDataList []models.HealthData
	err := config.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&healthDataList).Error
	if err != nil {
		return nil, err
	}
	return healthDataList, nil
}

// GetHealthDataHistory 获取健康数据历史快照（按时间倒序）
func (s *HealthDataService) GetHealthDataHistory(userID string, limit int) ([]models.HealthDataHistory, error) {
	if limit <= 0 {
		limit = 30
	}
	if limit > 180 {
		limit = 180
	}
	var rows []models.HealthDataHistory
	err := config.DB.Where("user_id = ?", userID).Order("snapshot_at DESC").Limit(limit).Find(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// GetHealthDataChangeSummary 获取用户身体变化摘要
func (s *HealthDataService) GetHealthDataChangeSummary(userID string) (map[string]interface{}, error) {
	current, err := s.GetLatestHealthData(userID)
	if err != nil {
		return nil, err
	}

	historyAsc, err := s.getHistoryAsc(userID)
	if err != nil {
		return nil, err
	}
	if len(historyAsc) == 0 {
		// 理论上 submit/update 都会写历史，这里做兜底防守。
		if err := s.appendHistorySnapshot(current, "submit"); err != nil {
			return nil, err
		}
		historyAsc = append(historyAsc, models.HealthDataHistory{
			UserID:        current.UserID,
			Height:        current.Height,
			Weight:        current.Weight,
			BloodSugar:    current.BloodSugar,
			ActivityLevel: current.ActivityLevel,
			SnapshotAt:    current.UpdatedAt,
		})
	}
	insufficientSample := len(historyAsc) < 2

	baseline := s.pickBaselineByLatestPublishedPlan(userID, historyAsc)
	weightDelta := healthRound1(current.Weight - baseline.Weight)
	bloodSugarDelta := healthRound1(current.BloodSugar - baseline.BloodSugar)
	bmiCurrent := calcBMI(current.Height, current.Weight)
	bmiBaseline := calcBMI(baseline.Height, baseline.Weight)
	bmiDelta := healthRound1(bmiCurrent - bmiBaseline)

	return map[string]interface{}{
		"baseline": map[string]interface{}{
			"snapshot_at":      baseline.SnapshotAt,
			"height":           baseline.Height,
			"weight":           baseline.Weight,
			"blood_sugar":      baseline.BloodSugar,
			"activity_level":   baseline.ActivityLevel,
			"reference_source": baseline.Source,
		},
		"current": map[string]interface{}{
			"snapshot_at":    current.UpdatedAt,
			"height":         current.Height,
			"weight":         current.Weight,
			"blood_sugar":    current.BloodSugar,
			"activity_level": current.ActivityLevel,
		},
		"delta": map[string]interface{}{
			"weight":          weightDelta,
			"blood_sugar":     bloodSugarDelta,
			"bmi":             bmiDelta,
			"activity_changed": current.ActivityLevel != baseline.ActivityLevel,
			"activity_from":   baseline.ActivityLevel,
			"activity_to":     current.ActivityLevel,
		},
		"history_count": len(historyAsc),
		"insufficient_sample": insufficientSample,
		"insufficient_hint":   "样本不足（至少2次记录）",
	}, nil
}

// UpdateHealthData 更新健康数据
func (s *HealthDataService) UpdateHealthData(dataID string, req schemas.UpdateHealthDataRequest) error {
	var before models.HealthData
	if err := config.DB.Where("data_id = ?", dataID).First(&before).Error; err != nil {
		return err
	}
	updates := map[string]interface{}{
		"updated_at": time.Now(),
	}

	if req.Gender != "" {
		g := canonicalGender(req.Gender)
		if g != "" {
			updates["gender"] = g
		} else {
			updates["gender"] = req.Gender
		}
	}
	if req.Age > 0 {
		updates["age"] = req.Age
	}
	if req.Height > 0 {
		updates["height"] = req.Height
	}
	if req.Weight > 0 {
		updates["weight"] = req.Weight
	}
	if req.BloodPressure != "" {
		updates["blood_pressure"] = req.BloodPressure
	}
	if req.BloodSugar > 0 {
		updates["blood_sugar"] = req.BloodSugar
	}
	if req.HeartRate > 0 {
		updates["heart_rate"] = req.HeartRate
	}
	if req.AllergyHistory != "" {
		updates["allergy_history"] = req.AllergyHistory
	}
	if req.ActivityLevel != "" {
		updates["activity_level"] = req.ActivityLevel
	}
	if req.NutritionGoal != "" {
		updates["nutrition_goal"] = req.NutritionGoal
	}

	// 历史为空时，先回填一条“更新前快照”，避免首次更新后对比基线仍是当前值导致 delta=0。
	var historyCount int64
	if err := config.DB.Model(&models.HealthDataHistory{}).Where("user_id = ?", before.UserID).Count(&historyCount).Error; err == nil && historyCount == 0 {
		if err := s.appendHistorySnapshot(&before, "backfill_before_update"); err != nil {
			return err
		}
	}

	if err := config.DB.Model(&models.HealthData{}).Where("data_id = ?", dataID).Updates(updates).Error; err != nil {
		return err
	}
	var latest models.HealthData
	if err := config.DB.Where("data_id = ?", dataID).First(&latest).Error; err != nil {
		return err
	}
	return s.appendHistorySnapshot(&latest, "update")
}

// DeleteHealthData 删除健康数据
func (s *HealthDataService) DeleteHealthData(dataID string) error {
	return config.DB.Where("data_id = ?", dataID).Delete(&models.HealthData{}).Error
}

func (s *HealthDataService) appendHistorySnapshot(hd *models.HealthData, source string) error {
	if hd == nil {
		return nil
	}
	snapshotAt := hd.UpdatedAt
	if snapshotAt.IsZero() {
		snapshotAt = time.Now()
	}
	gender := canonicalGender(hd.Gender)
	if gender == "" {
		gender = hd.Gender
	}
	row := &models.HealthDataHistory{
		HistoryID:      generateHistoryID(),
		DataID:         hd.DataID,
		UserID:         hd.UserID,
		Gender:         gender,
		Age:            hd.Age,
		Height:         hd.Height,
		Weight:         hd.Weight,
		HeartRate:      hd.HeartRate,
		BloodPressure:  hd.BloodPressure,
		BloodSugar:     hd.BloodSugar,
		AllergyHistory: hd.AllergyHistory,
		ActivityLevel:  hd.ActivityLevel,
		NutritionGoal:  hd.NutritionGoal,
		Source:         source,
		SnapshotAt:     snapshotAt,
		CreatedAt:      time.Now(),
	}
	return config.DB.Create(row).Error
}

func (s *HealthDataService) getHistoryAsc(userID string) ([]models.HealthDataHistory, error) {
	var rows []models.HealthDataHistory
	err := config.DB.Where("user_id = ?", userID).Order("snapshot_at ASC").Find(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *HealthDataService) pickBaselineByLatestPublishedPlan(userID string, historyAsc []models.HealthDataHistory) models.HealthDataHistory {
	if len(historyAsc) == 0 {
		return models.HealthDataHistory{}
	}
	var latestPlan models.DietPlan
	if err := config.DB.Where("user_id = ? AND audit_status = ?", userID, "published").Order("published_at DESC").First(&latestPlan).Error; err != nil {
		base := historyAsc[0]
		base.Source = "history_first"
		return base
	}

	planStart := latestPlan.PublishedAt
	for _, row := range historyAsc {
		if !row.SnapshotAt.Before(planStart) {
			row.Source = "latest_plan_published"
			return row
		}
	}
	base := historyAsc[len(historyAsc)-1]
	base.Source = "latest_before_plan"
	return base
}

func calcBMI(heightCm, weightKg float64) float64 {
	if heightCm <= 0 || weightKg <= 0 {
		return 0
	}
	m := heightCm / 100.0
	if m <= 0 {
		return 0
	}
	return weightKg / (m * m)
}

func healthRound1(v float64) float64 {
	return math.Round(v*10) / 10
}

func canonicalGender(v string) string {
	switch v {
	case "male", "男":
		return "male"
	case "female", "女":
		return "female"
	default:
		return ""
	}
}