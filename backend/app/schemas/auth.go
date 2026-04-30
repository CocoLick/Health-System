package schemas

// RegisterRequest 用户注册请求
type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
	Phone    string `json:"phone" binding:"required"`
	Gender   string `json:"gender" binding:"required"`
	Age      int    `json:"age" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
}

// LoginRequest 用户登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// DietitianLoginRequest 规划师登录请求
type DietitianLoginRequest struct {
	DietitianID string `json:"dietitian_id" binding:"required"`
	Password    string `json:"password" binding:"required"`
}

// AdminLoginRequest 管理员登录请求
type AdminLoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// CreateDietitianRequest 管理员创建规划师请求
type CreateDietitianRequest struct {
	Username     string `json:"username" binding:"required"`
	Name         string `json:"name" binding:"required"`
	Password     string `json:"password" binding:"required,min=6"`
	Title        string `json:"title" binding:"required"`
	Specialty    string `json:"specialty" binding:"required"`
	Introduction string `json:"introduction"`
	Contact      string `json:"contact" binding:"required"`
	Status       string `json:"status" binding:"required"`
}

// UpdateDietitianStatusRequest 更新规划师状态请求
type UpdateDietitianStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// UserStatusUpdateRequest 管理员更新用户账号状态
type UserStatusUpdateRequest struct {
	Status string `json:"status" binding:"required"`
}

// ChangePasswordRequest 修改密码请求
type ChangePasswordRequest struct {
	OldPassword     string `json:"old_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=6"`
	ConfirmPassword string `json:"confirm_password" binding:"required,eqfield=NewPassword"`
}

// UpdateDietitianProfileRequest 规划师更新个人资料请求
type UpdateDietitianProfileRequest struct {
	Name         string `json:"name" binding:"required"`
	Title        string `json:"title" binding:"required"`
	Specialty    string `json:"specialty" binding:"required"`
	Introduction string `json:"introduction"`
	Contact      string `json:"contact" binding:"required"`
}

// DietitianListQuery 用户端规划师列表筛选参数
type DietitianListQuery struct {
	Specialty                     string  `form:"specialty"`
	MaxCurrentServiceUserCount    int     `form:"max_current_service_user_count"`
	MinHistoricalServiceUserCount int     `form:"min_historical_service_user_count"`
	MinHistoricalAvgRating        float64 `form:"min_historical_avg_rating"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token    string      `json:"token"`
	UserInfo interface{} `json:"user_info"`
}

// Response 通用响应
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}
