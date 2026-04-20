package services

import (
	"fmt"
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

// SubmitHealthData 提交健康数据
func (s *HealthDataService) SubmitHealthData(userID string, req schemas.HealthDataRequest) (*models.HealthData, error) {
	healthData := &models.HealthData{
		DataID:         generateDataID(),
		UserID:         userID,
		Gender:         req.Gender,
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

// UpdateHealthData 更新健康数据
func (s *HealthDataService) UpdateHealthData(dataID string, req schemas.UpdateHealthDataRequest) error {
	updates := map[string]interface{}{
		"updated_at": time.Now(),
	}

	if req.Gender != "" {
		updates["gender"] = req.Gender
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

	return config.DB.Model(&models.HealthData{}).Where("data_id = ?", dataID).Updates(updates).Error
}

// DeleteHealthData 删除健康数据
func (s *HealthDataService) DeleteHealthData(dataID string) error {
	return config.DB.Where("data_id = ?", dataID).Delete(&models.HealthData{}).Error
}