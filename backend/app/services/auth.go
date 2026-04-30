package services

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"
	"github.com/yourusername/nutrition-system/utils"
	"golang.org/x/crypto/bcrypt"
)

// AuthService 认证服务
type AuthService struct{}

type loginAccount struct {
	UserID    string
	Username  string
	Name      string
	Password  string
	Phone     string
	Gender    string
	Age       int
	Email     string
	RoleType  string
	Title     string
	Specialty string
	Contact   string
	Status    string
}

func legacyAuthFallbackEnabled() bool {
	v := strings.ToLower(strings.TrimSpace(config.GetEnv("AUTH_LEGACY_FALLBACK", "true")))
	switch v {
	case "0", "false", "off", "no":
		return false
	default:
		return true
	}
}

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
	var existingDietitian models.Dietitian
	result = config.DB.Where("username = ?", req.Username).First(&existingDietitian)
	if result.RowsAffected > 0 {
		return nil, errors.New("用户名已存在")
	}

	// 生成用户ID（同日期多条注册时自增后缀，避免主键重复）
	userID := s.generateUserID()

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
		Status:    "启用",
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
	account, err := s.getLoginAccountByUsername(req.Username)
	if err != nil {
		return nil, errors.New("用户名或密码错误")
	}

	// 检查密码
	if !checkPassword(req.Password, account.Password) {
		return nil, errors.New("用户名或密码错误")
	}

	// 检查用户状态（管理员不检查）
	if account.RoleType != "admin" && account.Status == "禁用" {
		return nil, errors.New("账号已被禁用，请联系管理员")
	}

	// 生成JWT令牌
	token, err := utils.GenerateToken(account.UserID, account.Username, account.RoleType)
	if err != nil {
		return nil, err
	}

	// 构建响应
	response := &schemas.LoginResponse{
		Token: token,
		UserInfo: map[string]interface{}{
			"user_id":   account.UserID,
			"username":  account.Username,
			"name":      account.Name,
			"phone":     account.Phone,
			"gender":    account.Gender,
			"age":       account.Age,
			"email":     account.Email,
			"role_type": account.RoleType,
			"title":     account.Title,
			"specialty": account.Specialty,
			"contact":   account.Contact,
			"status":    account.Status,
		},
	}

	return response, nil
}

// DietitianLogin 规划师登录（保留，兼容旧版）
func (s *AuthService) DietitianLogin(req schemas.DietitianLoginRequest) (*schemas.LoginResponse, error) {
	var dietitian models.Dietitian
	result := config.DB.Where("username = ? AND role_type = ? AND status = ?", req.DietitianID, "dietitian", "启用").First(&dietitian)
	if result.RowsAffected == 0 && legacyAuthFallbackEnabled() {
		// 兼容旧结构：未迁移时回退 user 表
		var legacy models.User
		result = config.DB.Where("username = ? AND role_type = ? AND status = ?", req.DietitianID, "dietitian", "启用").First(&legacy)
		if result.RowsAffected == 0 {
			return nil, errors.New("规划师ID或密码错误")
		}
		if !legacy.CheckPassword(req.Password) {
			return nil, errors.New("规划师ID或密码错误")
		}
		token, err := utils.GenerateToken(legacy.UserID, legacy.Username, legacy.RoleType)
		if err != nil {
			return nil, err
		}
		return &schemas.LoginResponse{
			Token: token,
			UserInfo: map[string]interface{}{
				"user_id":   legacy.UserID,
				"username":  legacy.Username,
				"name":      legacy.Name,
				"title":     legacy.Title,
				"specialty": legacy.Specialty,
				"contact":   legacy.Contact,
				"status":    legacy.Status,
				"role_type": legacy.RoleType,
			},
		}, nil
	}

	// 检查密码
	if !dietitian.CheckPassword(req.Password) {
		return nil, errors.New("规划师ID或密码错误")
	}

	// 生成JWT令牌
	token, err := utils.GenerateToken(dietitian.AccountID, dietitian.Username, dietitian.RoleType)
	if err != nil {
		return nil, err
	}

	// 构建响应
	response := &schemas.LoginResponse{
		Token: token,
		UserInfo: map[string]interface{}{
			"user_id":   dietitian.AccountID,
			"username":  dietitian.Username,
			"name":      dietitian.Name,
			"title":     dietitian.Title,
			"specialty": dietitian.Specialty,
			"contact":   dietitian.Contact,
			"status":    dietitian.Status,
			"role_type": dietitian.RoleType,
		},
	}

	return response, nil
}

// AdminLogin 管理员登录
func (s *AuthService) AdminLogin(req schemas.AdminLoginRequest) (*schemas.LoginResponse, error) {
	var admin models.Dietitian
	result := config.DB.Where("username = ? AND role_type = ?", req.Username, "admin").First(&admin)
	if result.RowsAffected == 0 && legacyAuthFallbackEnabled() {
		// 兼容旧结构：未迁移时回退 user 表
		var legacy models.User
		result = config.DB.Where("username = ? AND role_type = ?", req.Username, "admin").First(&legacy)
		if result.RowsAffected == 0 {
			return nil, errors.New("管理员用户名或密码错误")
		}
		if !legacy.CheckPassword(req.Password) {
			return nil, errors.New("管理员用户名或密码错误")
		}
		token, err := utils.GenerateToken(legacy.UserID, legacy.Username, legacy.RoleType)
		if err != nil {
			return nil, err
		}
		return &schemas.LoginResponse{
			Token: token,
			UserInfo: map[string]interface{}{
				"user_id":   legacy.UserID,
				"username":  legacy.Username,
				"name":      legacy.Name,
				"phone":     legacy.Phone,
				"gender":    legacy.Gender,
				"age":       legacy.Age,
				"email":     legacy.Email,
				"role_type": legacy.RoleType,
			},
		}, nil
	}

	// 检查密码
	if !admin.CheckPassword(req.Password) {
		return nil, errors.New("管理员用户名或密码错误")
	}

	// 生成JWT令牌
	token, err := utils.GenerateToken(admin.AccountID, admin.Username, admin.RoleType)
	if err != nil {
		return nil, err
	}

	// 构建响应
	response := &schemas.LoginResponse{
		Token: token,
		UserInfo: map[string]interface{}{
			"user_id":   admin.AccountID,
			"username":  admin.Username,
			"name":      admin.Name,
			"contact":   admin.Contact,
			"status":    admin.Status,
			"role_type": admin.RoleType,
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
	var existingDietitian models.Dietitian
	result = config.DB.Where("username = ?", req.Username).First(&existingDietitian)
	if result.RowsAffected > 0 {
		return nil, errors.New("用户名已存在")
	}

	// 生成账号ID（查询最大后缀，确保唯一）
	accountID := s.generateDietitianID()

	// 创建规划师（写入 dietitian 表）
	dietitian := &models.Dietitian{
		AccountID: accountID,
		Username:  req.Username,
		Name:      req.Name,
		Password:  req.Password,
		RoleType:  "dietitian",
		Title:     req.Title,
		Specialty: req.Specialty,
		Introduction: strings.TrimSpace(req.Introduction),
		Contact:   req.Contact,
		Status:    req.Status,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 保存账号
	if err := config.DB.Create(dietitian).Error; err != nil {
		return nil, err
	}

	// 兼容现有前端字段结构
	return &models.User{
		UserID:    dietitian.AccountID,
		Username:  dietitian.Username,
		Name:      dietitian.Name,
		Phone:     dietitian.Contact,
		RoleType:  dietitian.RoleType,
		Title:     dietitian.Title,
		Specialty: dietitian.Specialty,
		Introduction: dietitian.Introduction,
		Contact:   dietitian.Contact,
		Status:    dietitian.Status,
		CreatedAt: dietitian.CreatedAt,
		UpdatedAt: dietitian.UpdatedAt,
	}, nil
}

// generateUserID 普通用户 U + yyyymmdd + 3 位序号，与当日已有 user_id 不重复
func (s *AuthService) generateUserID() string {
	today := time.Now().Format("20060102")
	prefix := "U" + today

	var userIDs []string
	config.DB.Model(&models.User{}).
		Where("user_id LIKE ?", prefix+"%").
		Select("user_id").
		Find(&userIDs)

	// 兼容角色拆表：历史迁移后 dietitian.account_id 里可能仍存在 U 前缀 ID。
	// 这里合并两张表，避免普通用户新注册撞号。
	var accountIDs []string
	config.DB.Model(&models.Dietitian{}).
		Where("account_id LIKE ?", prefix+"%").
		Select("account_id").
		Find(&accountIDs)
	userIDs = append(userIDs, accountIDs...)

	maxSuffix := 0
	for _, id := range userIDs {
		suffixStr := strings.TrimPrefix(id, prefix)
		suffix, err := strconv.Atoi(suffixStr)
		if err == nil && suffix > maxSuffix {
			maxSuffix = suffix
		}
	}
	return fmt.Sprintf("%s%03d", prefix, maxSuffix+1)
}

// generateDietitianID 生成规划师ID（查询最大后缀）
func (s *AuthService) generateDietitianID() string {
	today := time.Now().Format("20060102")
	prefix := "D" + today

	// 查询当天所有规划师的 account_id
	var accountIDs []string
	config.DB.Model(&models.Dietitian{}).
		Where("account_id LIKE ? AND role_type = ?", prefix+"%", "dietitian").
		Select("account_id").
		Find(&accountIDs)

	// 找出最大后缀
	maxSuffix := 0
	for _, id := range accountIDs {
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

// GetAllDietitians 获取所有规划师（管理员场景）
func (s *AuthService) GetAllDietitians() ([]models.User, error) {
	return s.GetDietitians(schemas.DietitianListQuery{})
}

// GetDietitians 获取规划师列表（用户端，支持筛选）
func (s *AuthService) GetDietitians(q schemas.DietitianListQuery) ([]models.User, error) {
	var rows []models.Dietitian
	db := config.DB.Where("role_type = ?", "dietitian")
	if strings.TrimSpace(q.Specialty) != "" {
		db = db.Where("specialty LIKE ?", "%"+strings.TrimSpace(q.Specialty)+"%")
	}
	if err := db.Order("created_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}

	dietitianIDs := make([]string, 0, len(rows))
	for _, d := range rows {
		dietitianIDs = append(dietitianIDs, d.AccountID)
	}
	currentCounts := make(map[string]int)
	historyCounts := make(map[string]int)
	avgRatings := make(map[string]float64)
	ratingCounts := make(map[string]int)
	if len(dietitianIDs) > 0 {
		type countRow struct {
			DietitianID string `gorm:"column:dietitian_id"`
			Cnt         int    `gorm:"column:cnt"`
		}
		var currentRows []countRow
		if err := config.DB.
			Model(&models.ServiceRequest{}).
			Select("dietitian_id, COUNT(DISTINCT user_id) AS cnt").
			Where("dietitian_id IN ? AND status IN ?", dietitianIDs, []string{"approved", "pending"}).
			Group("dietitian_id").
			Find(&currentRows).Error; err != nil {
			return nil, err
		}
		for _, row := range currentRows {
			currentCounts[row.DietitianID] = row.Cnt
		}

		var historyRows []countRow
		if err := config.DB.
			Model(&models.ServiceRequest{}).
			Select("dietitian_id, COUNT(DISTINCT user_id) AS cnt").
			Where("dietitian_id IN ?", dietitianIDs).
			Group("dietitian_id").
			Find(&historyRows).Error; err != nil {
			return nil, err
		}
		for _, row := range historyRows {
			historyCounts[row.DietitianID] = row.Cnt
		}

		type ratingRow struct {
			DietitianID string  `gorm:"column:target_dietitian_id"`
			AvgRating   float64 `gorm:"column:avg_rating"`
			RatingCount int     `gorm:"column:rating_count"`
		}
		var ratingRows []ratingRow
		if err := config.DB.
			Model(&models.UserFeedback{}).
			Select("target_dietitian_id, AVG(rating) AS avg_rating, COUNT(rating) AS rating_count").
			Where("target_dietitian_id IN ? AND category = ? AND rating IS NOT NULL", dietitianIDs, "dietitian_review").
			Group("target_dietitian_id").
			Find(&ratingRows).Error; err != nil {
			return nil, err
		}
		for _, row := range ratingRows {
			avgRatings[row.DietitianID] = math.Round(row.AvgRating*10) / 10
			ratingCounts[row.DietitianID] = row.RatingCount
		}
	}

	dietitians := make([]models.User, 0, len(rows))
	seen := make(map[string]bool)
	for _, d := range rows {
		currentCount := currentCounts[d.AccountID]
		historyCount := historyCounts[d.AccountID]
		avgRating := avgRatings[d.AccountID]
		ratingCount := ratingCounts[d.AccountID]
		if q.MaxCurrentServiceUserCount > 0 && currentCount >= q.MaxCurrentServiceUserCount {
			continue
		}
		if historyCount < q.MinHistoricalServiceUserCount {
			continue
		}
		if avgRating < q.MinHistoricalAvgRating {
			continue
		}
		seen[d.AccountID] = true
		dietitians = append(dietitians, models.User{
			UserID:    d.AccountID,
			Username:  d.Username,
			Name:      d.Name,
			Phone:     d.Contact,
			RoleType:  d.RoleType,
			Title:     d.Title,
			Specialty: d.Specialty,
			Introduction: d.Introduction,
			Contact:   d.Contact,
			CurrentServiceUserCount:    currentCount,
			HistoricalServiceUserCount: historyCount,
			HistoricalAvgRating:        avgRating,
			RatingCount:                ratingCount,
			Status:    d.Status,
			CreatedAt: d.CreatedAt,
			UpdatedAt: d.UpdatedAt,
		})
	}

	// 兼容旧结构：补齐仍在 user 表中的规划师
	var legacyRows []models.User
	if legacyAuthFallbackEnabled() && config.DB.Where("role_type = ?", "dietitian").Order("created_at DESC").Find(&legacyRows).Error == nil {
		for _, u := range legacyRows {
			if seen[u.UserID] {
				continue
			}
			if q.MaxCurrentServiceUserCount > 0 || q.MinHistoricalServiceUserCount > 0 || q.MinHistoricalAvgRating > 0 {
				continue
			}
			if strings.TrimSpace(q.Specialty) != "" && !strings.Contains(strings.ToLower(u.Specialty), strings.ToLower(strings.TrimSpace(q.Specialty))) {
				continue
			}
			seen[u.UserID] = true
			dietitians = append(dietitians, u)
		}
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
	result := config.DB.Model(&models.Dietitian{}).Where("account_id = ? AND role_type = ?", userID, "dietitian").Update("status", status)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 && legacyAuthFallbackEnabled() {
		// 兼容旧结构：回退更新 user 表
		legacy := config.DB.Model(&models.User{}).Where("user_id = ? AND role_type = ?", userID, "dietitian").Update("status", status)
		if legacy.Error != nil {
			return legacy.Error
		}
		if legacy.RowsAffected == 0 {
			return errors.New("规划师不存在")
		}
	}
	return nil
}

// DeleteDietitian 删除规划师
func (s *AuthService) DeleteDietitian(userID string) error {
	result := config.DB.Where("account_id = ? AND role_type = ?", userID, "dietitian").Delete(&models.Dietitian{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 && legacyAuthFallbackEnabled() {
		// 兼容旧结构：回退删除 user 表
		legacy := config.DB.Where("user_id = ? AND role_type = ?", userID, "dietitian").Delete(&models.User{})
		if legacy.Error != nil {
			return legacy.Error
		}
		if legacy.RowsAffected == 0 {
			return errors.New("规划师不存在")
		}
	}
	return nil
}

// GetUserByID 根据ID获取用户信息
func (s *AuthService) GetUserByID(userID string) (*models.User, error) {
	var user models.User
	result := config.DB.Where("user_id = ?", userID).First(&user)
	if result.Error == nil {
		return &user, nil
	}

	// 兼容角色拆表：若 user 表没有，再到 dietitian 表查并映射旧结构返回
	var d models.Dietitian
	if !legacyAuthFallbackEnabled() {
		return nil, result.Error
	}
	if err := config.DB.Where("account_id = ?", userID).First(&d).Error; err != nil {
		return nil, result.Error
	}
	return &models.User{
		UserID:    d.AccountID,
		Username:  d.Username,
		Name:      d.Name,
		Phone:     d.Contact,
		RoleType:  d.RoleType,
		Title:     d.Title,
		Specialty: d.Specialty,
		Introduction: d.Introduction,
		Contact:   d.Contact,
		Status:    d.Status,
		CreatedAt: d.CreatedAt,
		UpdatedAt: d.UpdatedAt,
	}, nil
}

// ChangePassword 修改当前登录账号密码（支持 user/dietitian/admin）
func (s *AuthService) ChangePassword(userID, roleType string, req schemas.ChangePasswordRequest) error {
	if strings.TrimSpace(req.NewPassword) == strings.TrimSpace(req.OldPassword) {
		return errors.New("新密码不能与旧密码相同")
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("密码加密失败")
	}

	switch roleType {
	case "user":
		var user models.User
		if err := config.DB.Where("user_id = ? AND role_type = ?", userID, "user").First(&user).Error; err != nil {
			return errors.New("用户不存在")
		}
		if !user.CheckPassword(req.OldPassword) {
			return errors.New("旧密码错误")
		}
		return config.DB.Model(&models.User{}).
			Where("user_id = ? AND role_type = ?", userID, "user").
			Updates(map[string]interface{}{
				"password":   string(hashed),
				"updated_at": time.Now(),
			}).Error
	case "dietitian", "admin":
		var account models.Dietitian
		err := config.DB.Where("account_id = ? AND role_type = ?", userID, roleType).First(&account).Error
		if err == nil {
			if !account.CheckPassword(req.OldPassword) {
				return errors.New("旧密码错误")
			}
			return config.DB.Model(&models.Dietitian{}).
				Where("account_id = ? AND role_type = ?", userID, roleType).
				Updates(map[string]interface{}{
					"password":   string(hashed),
					"updated_at": time.Now(),
				}).Error
		}

		if legacyAuthFallbackEnabled() {
			var legacy models.User
			if err := config.DB.Where("user_id = ? AND role_type = ?", userID, roleType).First(&legacy).Error; err == nil {
				if !legacy.CheckPassword(req.OldPassword) {
					return errors.New("旧密码错误")
				}
				return config.DB.Model(&models.User{}).
					Where("user_id = ? AND role_type = ?", userID, roleType).
					Updates(map[string]interface{}{
						"password":   string(hashed),
						"updated_at": time.Now(),
					}).Error
			}
		}
		return errors.New("账号不存在")
	default:
		return errors.New("不支持的角色类型")
	}
}

func (s *AuthService) getLoginAccountByUsername(username string) (*loginAccount, error) {
	name := strings.TrimSpace(username)
	if name == "" {
		return nil, errors.New("用户名不能为空")
	}

	var user models.User
	if err := config.DB.Where("username = ?", name).First(&user).Error; err == nil {
		return &loginAccount{
			UserID:    user.UserID,
			Username:  user.Username,
			Name:      user.Name,
			Password:  user.Password,
			Phone:     user.Phone,
			Gender:    user.Gender,
			Age:       user.Age,
			Email:     user.Email,
			RoleType:  user.RoleType,
			Title:     user.Title,
			Specialty: user.Specialty,
			Contact:   user.Contact,
			Status:    user.Status,
		}, nil
	}

	var dietitian models.Dietitian
	if err := config.DB.Where("username = ?", name).First(&dietitian).Error; err == nil {
		return &loginAccount{
			UserID:    dietitian.AccountID,
			Username:  dietitian.Username,
			Name:      dietitian.Name,
			Password:  dietitian.Password,
			RoleType:  dietitian.RoleType,
			Title:     dietitian.Title,
			Specialty: dietitian.Specialty,
			Contact:   dietitian.Contact,
			Status:    dietitian.Status,
		}, nil
	}

	return nil, errors.New("账号不存在")
}

func checkPassword(raw, hash string) bool {
	return (&models.User{Password: hash}).CheckPassword(raw)
}
