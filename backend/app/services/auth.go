package services

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
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
	userID := fmt.Sprintf("U%s%03d", time.Now().Format("20060102"), 1)

	// 创建用户
	user := &models.User{
		UserID:    userID,
		Username:  req.Username,
		Password:  req.Password,
		Phone:     req.Phone,
		Gender:    req.Gender,
		Age:       req.Age,
		Email:     req.Email,
		RoleType:  "user",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 保存用户
	if err := config.DB.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

// Login 用户登录（统一登录接口）
func (s *AuthService) Login(req schemas.LoginRequest) (*schemas.LoginResponse, error) {
	// 在用户表中查找
	var user models.User
	result := config.DB.Where("username = ?", req.Username).First(&user)
	if result.RowsAffected == 0 {
		return nil, errors.New("用户名或密码错误")
	}

	// 检查密码
	if !user.CheckPassword(req.Password) {
		return nil, errors.New("用户名或密码错误")
	}

	// 检查用户状态（管理员不检查）
	if user.RoleType != "admin" && user.Status == "禁用" {
		return nil, errors.New("账号已被禁用，请联系管理员")
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
			"name":      user.Name,
			"phone":     user.Phone,
			"gender":    user.Gender,
			"age":       user.Age,
			"email":     user.Email,
			"role_type": user.RoleType,
			"title":     user.Title,
			"specialty": user.Specialty,
			"contact":   user.Contact,
			"status":    user.Status,
		},
	}

	return response, nil
}

// DietitianLogin 规划师登录（保留，兼容旧版）
func (s *AuthService) DietitianLogin(req schemas.DietitianLoginRequest) (*schemas.LoginResponse, error) {
	// 查找规划师（现在存储在用户表中），并且状态必须是启用
	var user models.User
	result := config.DB.Where("username = ? AND role_type = ? AND status = ?", req.DietitianID, "dietitian", "启用").First(&user)
	if result.RowsAffected == 0 {
		return nil, errors.New("规划师ID或密码错误")
	}

	// 检查密码
	if !user.CheckPassword(req.Password) {
		return nil, errors.New("规划师ID或密码错误")
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
			"name":      user.Name,
			"title":     user.Title,
			"specialty": user.Specialty,
			"contact":   user.Contact,
			"status":    user.Status,
			"role_type": user.RoleType,
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
			"name":      user.Name,
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
func (s *AuthService) CreateDietitian(req schemas.CreateDietitianRequest) (*models.User, error) {
	// 检查用户名是否已存在
	var existingUser models.User
	result := config.DB.Where("username = ?", req.Username).First(&existingUser)
	if result.RowsAffected > 0 {
		return nil, errors.New("用户名已存在")
	}

	// 生成用户ID（查询最大后缀，确保唯一）
	userID := s.generateDietitianID()

	// 创建规划师（作为用户）
	user := &models.User{
		UserID:    userID,
		Username:  req.Username,
		Name:      req.Name,
		Password:  req.Password,
		Phone:     req.Contact,
		Gender:    "",
		Age:       0,
		Email:     "",
		RoleType:  "dietitian",
		Title:     req.Title,
		Specialty: req.Specialty,
		Contact:   req.Contact,
		Status:    req.Status,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 保存用户
	if err := config.DB.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

// generateDietitianID 生成规划师ID（查询最大后缀）
func (s *AuthService) generateDietitianID() string {
	today := time.Now().Format("20060102")
	prefix := "D" + today

	// 查询当天所有规划师的user_id
	var userIDs []string
	config.DB.Model(&models.User{}).
		Where("user_id LIKE ?", prefix+"%").
		Select("user_id").
		Find(&userIDs)

	// 找出最大后缀
	maxSuffix := 0
	for _, id := range userIDs {
		// 去掉前缀，转换为数字
		suffixStr := strings.TrimPrefix(id, prefix)
		suffix, err := strconv.Atoi(suffixStr)
		if err == nil && suffix > maxSuffix {
			maxSuffix = suffix
		}
	}

	// 生成新的ID
	newSuffix := maxSuffix + 1
	return fmt.Sprintf("%s%03d", prefix, newSuffix)
}

// GetAllDietitians 获取所有规划师
func (s *AuthService) GetAllDietitians() ([]models.User, error) {
	var dietitians []models.User
	result := config.DB.Where("role_type = ?", "dietitian").Find(&dietitians)
	if result.Error != nil {
		return nil, result.Error
	}
	return dietitians, nil
}

// GetAllUsersForAdmin 管理员：仅获取普通用户（user），不含规划师/管理员；password 不序列化
func (s *AuthService) GetAllUsersForAdmin() ([]models.User, error) {
	var users []models.User
	err := config.DB.Where("role_type = ?", "user").Order("created_at DESC").Find(&users).Error
	if err != nil {
		return nil, err
	}
	return users, nil
}

// UpdateUserStatusByAdmin 管理员：修改非管理员账号状态（启用/禁用，与普通登录校验一致）
func (s *AuthService) UpdateUserStatusByAdmin(userID, status string) error {
	if status != "启用" && status != "禁用" {
		return errors.New("状态仅支持 启用 或 禁用")
	}
	var u models.User
	if err := config.DB.Where("user_id = ?", userID).First(&u).Error; err != nil {
		return errors.New("用户不存在")
	}
	if u.RoleType == "admin" {
		return errors.New("不能通过此接口修改管理员账号")
	}
	return config.DB.Model(&models.User{}).Where("user_id = ?", userID).Update("status", status).Error
}

// UpdateDietitianStatus 更新规划师状态
func (s *AuthService) UpdateDietitianStatus(userID string, status string) error {
	result := config.DB.Model(&models.User{}).Where("user_id = ? AND role_type = ?", userID, "dietitian").Update("status", status)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("规划师不存在")
	}
	return nil
}

// DeleteDietitian 删除规划师
func (s *AuthService) DeleteDietitian(userID string) error {
	result := config.DB.Where("user_id = ? AND role_type = ?", userID, "dietitian").Delete(&models.User{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("规划师不存在")
	}
	return nil
}

// GetUserByID 根据ID获取用户信息
func (s *AuthService) GetUserByID(userID string) (*models.User, error) {
	var user models.User
	result := config.DB.Where("user_id = ?", userID).First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}
