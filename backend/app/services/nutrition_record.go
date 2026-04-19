package services

import (
	"fmt"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"
)

// NutritionRecordService 营养记录服务
type NutritionRecordService struct{}

// NewNutritionRecordService 创建营养记录服务实例
func NewNutritionRecordService() *NutritionRecordService {
	return &NutritionRecordService{}
}

// CreateNutritionRecord 创建营养记录
func (s *NutritionRecordService) CreateNutritionRecord(userID string, req schemas.NutritionRecordRequest) (*models.NutritionRecord, error) {
	// 生成记录ID：NR + 日期 + 时间戳后4位
	recordID := fmt.Sprintf("NR%s%s", time.Now().Format("20060102"), time.Now().Format("1504")[1:])

	// 创建主记录
	record := &models.NutritionRecord{
		RecordID:          recordID,
		UserID:            userID,
		MealDate:         time.Now().Format("2006-01-02"),
		MealType:         req.MealType,
		TotalCalories:    req.TotalNutrition.Calories,
		TotalProtein:     req.TotalNutrition.Protein,
		TotalCarbohydrate: req.TotalNutrition.Carbohydrate,
		TotalFat:         req.TotalNutrition.Fat,
		TotalFiber:       req.TotalNutrition.Fiber,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	// 开启事务
	tx := config.DB.Begin()

	// 创建主记录
	if err := tx.Create(record).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 创建明细记录
	for i, item := range req.Foods {
		itemID := fmt.Sprintf("NI%s%s%d", time.Now().Format("20060102"), time.Now().Format("1504")[1:], i+1)
		recordItem := models.NutritionRecordItem{
			ItemID:     itemID,
			RecordID:   recordID,
			FoodName:   item.FoodName,
			Amount:     item.Amount,
			Unit:       item.Unit,
			GramPerUnit: item.GramPerUnit,
			Calories:   item.Calories,
			Protein:    item.Protein,
			Carbohydrate: item.Carbohydrate,
			Fat:        item.Fat,
			Fiber:      item.Fiber,
		}

		if err := tx.Create(&recordItem).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	tx.Commit()

	// 查询完整的记录（包括明细）
	return s.GetNutritionRecordByID(recordID)
}

// GetNutritionRecordByID 根据ID获取营养记录
func (s *NutritionRecordService) GetNutritionRecordByID(recordID string) (*models.NutritionRecord, error) {
	var record models.NutritionRecord
	if err := config.DB.Preload("Items").Where("record_id = ?", recordID).First(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

// GetNutritionRecordsByUserID 获取用户的营养记录列表
func (s *NutritionRecordService) GetNutritionRecordsByUserID(userID string, date string, page, pageSize int) ([]models.NutritionRecord, int64, error) {
	var records []models.NutritionRecord
	var total int64

	query := config.DB.Model(&models.NutritionRecord{}).Where("user_id = ?", userID)
	if date != "" {
		query = query.Where("meal_date = ?", date)
	}

	// 计算总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	offset := (page - 1) * pageSize
	if err := query.Preload("Items").Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&records).Error; err != nil {
		return nil, 0, err
	}

	return records, total, nil
}

// GetTodayNutritionRecords 获取用户今天的营养记录
func (s *NutritionRecordService) GetTodayNutritionRecords(userID string) ([]models.NutritionRecord, error) {
	today := time.Now().Format("2006-01-02")
	var records []models.NutritionRecord
	if err := config.DB.Preload("Items").Where("user_id = ? AND meal_date = ?", userID, today).Order("created_at DESC").Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

// DeleteNutritionRecord 删除营养记录
func (s *NutritionRecordService) DeleteNutritionRecord(recordID string, userID string) error {
	// 删除明细记录
	if err := config.DB.Where("record_id = ?", recordID).Delete(&models.NutritionRecordItem{}).Error; err != nil {
		return err
	}

	// 删除主记录
	return config.DB.Where("record_id = ? AND user_id = ?", recordID, userID).Delete(&models.NutritionRecord{}).Error
}
