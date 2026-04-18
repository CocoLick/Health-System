package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"
	"github.com/yourusername/nutrition-system/utils"
)

// AuthService 认证服务
type AuthService struct{}

// NewAuthService 创建认证服务实例
func NewAuthService() *AuthService {
	return &AuthService{}
}

// Register 用户注册
func (s *AuthService) Register(req schemas.RegisterRequest) (*models.User, error) {
	// 检查用户名是否已存在
	var existingUser models.User
	result := config.DB.Where("username = ?", req.Username).First(&existingUser)
	if result.RowsAffected > 0 {
		return nil, errors.New("用户名已存在")
	}

	// 生成用户ID
	userID := fmt.Sprintf("U%s%03d", time.Now().Format("20060102"), 1) // 实际应用中应使用更复杂的ID生成逻辑

	// 创建用户
	user := &models.User{
		UserID:     userID,
		Username:   req.Username,
		Password:   req.Password,
		Phone:      req.Phone,
		Gender:     req.Gender,
		Age:        req.Age,
		Email:      req.Email,
		RoleType:   "user", // 默认为普通用户
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// 保存用户
	if err := config.DB.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

// Login 用户登录
func (s *AuthService) Login(req schemas.LoginRequest) (*schemas.LoginResponse, error) {
	// 1. 首先在用户表中查找（包括普通用户和管理员）
	var user models.User
	result := config.DB.Where("username = ?", req.Username).First(&user)
	if result.RowsAffected > 0 {
		// 检查密码
		if !user.CheckPassword(req.Password) {
			return nil, errors.New("用户名或密码错误")
		}

		// 生成JWT令牌
		token, err := utils.GenerateToken(user.UserID, user.Username, user.RoleType)
		if err != nil {
			return nil, err
		}

		// 构建响应
		response := &schemas.LoginResponse{
			Token: token,
			UserInfo: map[string]interface{}{
				"user_id":   user.UserID,
				"username":  user.Username,
				"phone":     user.Phone,
				"gender":    user.Gender,
				"age":       user.Age,
				"email":     user.Email,
				"role_type": user.RoleType,
			},
		}

		return response, nil
	}

	// 2. 如果用户表中没有，在营养师表中查找
	var dietitian models.Dietitian
	dietResult := config.DB.Where("dietitian_id = ?", req.Username).First(&dietitian)
	if dietResult.RowsAffected > 0 {
		// 检查密码
		if !dietitian.CheckPassword(req.Password) {
			return nil, errors.New("用户名或密码错误")
		}

		// 生成JWT令牌
		token, err := utils.GenerateToken("", dietitian.Name, "dietitian", dietitian.DietitianID)
		if err != nil {
			return nil, err
		}

		// 构建响应
		response := &schemas.LoginResponse{
			Token: token,
			UserInfo: map[string]interface{}{
				"dietitian_id": dietitian.DietitianID,
				"name":         dietitian.Name,
				"title":        dietitian.Title,
				"specialty":    dietitian.Specialty,
				"contact":      dietitian.Contact,
				"status":       dietitian.Status,
				"role_type":    "dietitian",
			},
		}

		return response, nil
	}

	// 3. 都没找到，返回错误
	return nil, errors.New("用户名或密码错误")
}

// DietitianLogin 规划师登录
func (s *AuthService) DietitianLogin(req schemas.DietitianLoginRequest) (*schemas.LoginResponse, error) {
	// 查找规划师
	var dietitian models.Dietitian
	result := config.DB.Where("dietitian_id = ?", req.DietitianID).First(&dietitian)
	if result.RowsAffected == 0 {
		return nil, errors.New("规划师ID或密码错误")
	}

	// 检查密码
	if !dietitian.CheckPassword(req.Password) {
		return nil, errors.New("规划师ID或密码错误")
	}

	// 生成JWT令牌
	token, err := utils.GenerateToken("", dietitian.Name, "dietitian", dietitian.DietitianID)
	if err != nil {
		return nil, err
	}

	// 构建响应
	response := &schemas.LoginResponse{
		Token: token,
		UserInfo: map[string]interface{}{
			"dietitian_id": dietitian.DietitianID,
			"name":         dietitian.Name,
			"title":        dietitian.Title,
			"specialty":    dietitian.Specialty,
			"contact":      dietitian.Contact,
			"status":       dietitian.Status,
		},
	}

	return response, nil
}

// AdminLogin 管理员登录
func (s *AuthService) AdminLogin(req schemas.AdminLoginRequest) (*schemas.LoginResponse, error) {
	// 查找管理员（这里假设管理员也是用户表中的用户，role_type为admin）
	var user models.User
	result := config.DB.Where("username = ? AND role_type = ?", req.Username, "admin").First(&user)
	if result.RowsAffected == 0 {
		return nil, errors.New("管理员用户名或密码错误")
	}

	// 检查密码
	if !user.CheckPassword(req.Password) {
		return nil, errors.New("管理员用户名或密码错误")
	}

	// 生成JWT令牌
	token, err := utils.GenerateToken(user.UserID, user.Username, user.RoleType)
	if err != nil {
		return nil, err
	}

	// 构建响应
	response := &schemas.LoginResponse{
		Token: token,
		UserInfo: map[string]interface{}{
			"user_id":   user.UserID,
			"username":  user.Username,
			"phone":     user.Phone,
			"gender":    user.Gender,
			"age":       user.Age,
			"email":     user.Email,
			"role_type": user.RoleType,
		},
	}

	return response, nil
}

// CreateDietitian 管理员创建规划师
func (s *AuthService) CreateDietitian(req schemas.CreateDietitianRequest) (*models.Dietitian, error) {
	// 检查规划师名称是否已存在
	var existingDietitian models.Dietitian
	result := config.DB.Where("name = ?", req.Name).First(&existingDietitian)
	if result.RowsAffected > 0 {
		return nil, errors.New("规划师名称已存在")
	}

	// 生成规划师ID
	dietitianID := fmt.Sprintf("D%s%03d", time.Now().Format("20060102"), 1)

	// 创建规划师
	dietitian := &models.Dietitian{
		DietitianID: dietitianID,
		Name:        req.Name,
		Password:    req.Password,
		Title:       req.Title,
		Specialty:   req.Specialty,
		Contact:     req.Contact,
		Status:      req.Status,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// 保存规划师
	if err := config.DB.Create(dietitian).Error; err != nil {
		return nil, err
	}

	return dietitian, nil
}

// GetAllDietitians 获取所有规划师
func (s *AuthService) GetAllDietitians() ([]models.Dietitian, error) {
	var dietitians []models.Dietitian
	result := config.DB.Find(&dietitians)
	if result.Error != nil {
		return nil, result.Error
	}
	return dietitians, nil
}
