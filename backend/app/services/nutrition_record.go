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

// GetNutritionRecordsByDate 获取用户指定日期的营养记录
func (s *NutritionRecordService) GetNutritionRecordsByDate(userID string, date string) ([]models.NutritionRecord, error) {
	var records []models.NutritionRecord
	if err := config.DB.Preload("Items").Where("user_id = ? AND meal_date = ?", userID, date).Order("created_at DESC").Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

// GetNutritionTrendData 获取用户营养摄入趋势数据
func (s *NutritionRecordService) GetNutritionTrendData(userID string, days int) (map[string]interface{}, error) {
	// 计算开始日期
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -days+1)

	// 按日期分组查询
	type DailyTotal struct {
		Date     string
		Calories float64
	}

	var dailyTotals []DailyTotal

	// 构建日期范围查询
	query := `
		SELECT meal_date as date, SUM(total_calories) as calories
		FROM nutrition_record
		WHERE user_id = ? AND meal_date BETWEEN ? AND ?
		GROUP BY meal_date
		ORDER BY meal_date
	`

	if err := config.DB.Raw(query, userID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).Scan(&dailyTotals).Error; err != nil {
		return nil, err
	}

	// 填充缺失的日期
	result := make([]map[string]interface{}, 0)
	dateMap := make(map[string]float64)

	// 先将查询结果存入map
	for _, dt := range dailyTotals {
		dateMap[dt.Date] = dt.Calories
	}

	// 填充所有日期
	for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
		dateStr := d.Format("2006-01-02")
		day := d.Format("02")
		calories, ok := dateMap[dateStr]
		if !ok {
			calories = 0
		}

		result = append(result, map[string]interface{}{
			"date":     dateStr,
			"day":      day,
			"calories": calories,
		})
	}

	// 计算平均值和最大值
	var totalCalories float64
	var maxCalories float64

	for _, dt := range dailyTotals {
		totalCalories += dt.Calories
		if dt.Calories > maxCalories {
			maxCalories = dt.Calories
		}
	}

	avgCalories := 0.0
	if len(dailyTotals) > 0 {
		avgCalories = totalCalories / float64(len(dailyTotals))
	}

	return map[string]interface{}{
		"trendData":    result,
		"avgCalories":  avgCalories,
		"maxCalories":  maxCalories,
	}, nil
}
