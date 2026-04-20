package config

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/yourusername/nutrition-system/app/models"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init() {
	// 加载环境变量
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using default values")
	}

	// 初始化数据库连接
	InitDB()
}

func InitDB() {
	// 先连接到 MySQL 服务器，不指定数据库
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/?charset=utf8mb4&parseTime=True&loc=Local",
		GetEnv("DB_USER", "root"),
		GetEnv("DB_PASSWORD", "password"),
		GetEnv("DB_HOST", "localhost"),
		GetEnv("DB_PORT", "3306"),
	)

	// 连接到 MySQL 服务器
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to MySQL server: %v", err)
	}

	// 创建数据库
	dbName := GetEnv("DB_NAME", "nutrition_system")
	if err := db.Exec(fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", dbName)).Error; err != nil {
		log.Fatalf("Failed to create database: %v", err)
	}

	// 关闭连接
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to get DB instance: %v", err)
	}
	sqlDB.Close()

	// 连接到创建的数据库
	dsn = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		GetEnv("DB_USER", "root"),
		GetEnv("DB_PASSWORD", "password"),
		GetEnv("DB_HOST", "localhost"),
		GetEnv("DB_PORT", "3306"),
		dbName,
	)

	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// 自动迁移表结构
	if err := autoMigrate(); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// 初始化测试数据
	if err := initTestData(); err != nil {
		log.Printf("Warning: Failed to initialize test data: %v", err)
	}

	log.Println("Database connected successfully")
}

// autoMigrate 自动迁移表结构
func autoMigrate() error {
	// 自动迁移
	return DB.AutoMigrate(
		&models.User{},
		&models.HealthData{},
		&models.Ingredient{},
		&models.NutritionRecord{},
		&models.NutritionRecordItem{},
		&models.ServiceRequest{},
	)
}

// initTestData 初始化测试数据
func initTestData() error {
	// 检查是否已有数据
	var count int64
	DB.Model(&models.User{}).Count(&count)
	if count > 0 {
		// 已有数据，跳过初始化
		return nil
	}

	// 插入管理员用户
	adminUser := models.User{
		UserID:    "U20260325001",
		Username:  "admin",
		Password:  "password",
		Phone:     "13800138000",
		Gender:    "男",
		Age:       30,
		Email:     "admin@example.com",
		RoleType:  "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := DB.Create(&adminUser).Error; err != nil {
		return err
	}

	// 插入测试用户
	testUser := models.User{
		UserID:    "U20260325002",
		Username:  "test",
		Password:  "password",
		Phone:     "13800138001",
		Gender:    "女",
		Age:       25,
		Email:     "test@example.com",
		RoleType:  "user",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := DB.Create(&testUser).Error; err != nil {
		return err
	}

	// 插入测试规划师
	dietitianUser := models.User{
		UserID:    "D20260325001",
		Username:  "D20260325001",
		Name:      "张医生",
		Password:  "password",
		Phone:     "13800138002",
		Gender:    "",
		Age:       0,
		Email:     "",
		RoleType:  "dietitian",
		Title:     "营养师",
		Specialty: "临床营养",
		Contact:   "13800138002",
		Status:    "启用",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := DB.Create(&dietitianUser).Error; err != nil {
		return err
	}

	// 插入测试食材数据
	ingredients := []models.Ingredient{
		{
			IngredientID:  "IG20260419001",
			Name:          "米饭",
			Category:      "主食",
			Nutrition100g: `{"protein": 2.6, "carbohydrate": 25.6, "fat": 0.3}`,
			Calorie100g:   116,
			Unit:          "g",
			GramPerUnit:   100,
			Status:        "enabled",
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		},
		{
			IngredientID:  "IG20260419002",
			Name:          "面条",
			Category:      "主食",
			Nutrition100g: `{"protein": 3.4, "carbohydrate": 28.9, "fat": 0.7}`,
			Calorie100g:   138,
			Unit:          "g",
			GramPerUnit:   100,
			Status:        "enabled",
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		},
		{
			IngredientID:  "IG20260419003",
			Name:          "鸡蛋",
			Category:      "蛋白质",
			Nutrition100g: `{"protein": 13.0, "carbohydrate": 1.1, "fat": 11.0}`,
			Calorie100g:   155,
			Unit:          "个",
			GramPerUnit:   50,
			Status:        "enabled",
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		},
		{
			IngredientID:  "IG20260419004",
			Name:          "牛奶",
			Category:      "蛋白质",
			Nutrition100g: `{"protein": 3.4, "carbohydrate": 5.0, "fat": 1.0}`,
			Calorie100g:   42,
			Unit:          "ml",
			GramPerUnit:   100,
			Status:        "enabled",
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		},
		{
			IngredientID:  "IG20260419005",
			Name:          "鸡胸肉",
			Category:      "蛋白质",
			Nutrition100g: `{"protein": 31.0, "carbohydrate": 0, "fat": 3.6}`,
			Calorie100g:   165,
			Unit:          "g",
			GramPerUnit:   100,
			Status:        "enabled",
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		},
		{
			IngredientID:  "IG20260419006",
			Name:          "苹果",
			Category:      "水果",
			Nutrition100g: `{"protein": 0.3, "carbohydrate": 13.8, "fat": 0.2}`,
			Calorie100g:   52,
			Unit:          "个",
			GramPerUnit:   150,
			Status:        "enabled",
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		},
		{
			IngredientID:  "IG20260419007",
			Name:          "西兰花",
			Category:      "蔬菜",
			Nutrition100g: `{"protein": 2.8, "carbohydrate": 7.0, "fat": 0.4}`,
			Calorie100g:   34,
			Unit:          "g",
			GramPerUnit:   100,
			Status:        "enabled",
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		},
	}

	for _, ingredient := range ingredients {
		if err := DB.Create(&ingredient).Error; err != nil {
			return err
		}
	}

	return nil
}

func GetEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
