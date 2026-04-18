package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"
)

// AuthHandler 认证处理器
type AuthHandler struct {
	authService *services.AuthService
}

// NewAuthHandler 创建认证处理器实例
func NewAuthHandler() *AuthHandler {
	return &AuthHandler{
		authService: services.NewAuthService(),
	}
}

// Register 用户注册
// @Summary 用户注册
// @Description 注册新用户
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body schemas.RegisterRequest true "注册请求"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req schemas.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "请求参数错误",
		})
		return
	}

	user, err := h.authService.Register(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "注册成功",
		Data:    user,
	})
}

// Login 用户登录
// @Summary 用户登录
// @Description 用户登录获取令牌
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body schemas.LoginRequest true "登录请求"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req schemas.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "请求参数错误",
		})
		return
	}

	response, err := h.authService.Login(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "登录成功",
		Data:    response,
	})
}

// DietitianLogin 规划师登录
// @Summary 规划师登录
// @Description 规划师登录获取令牌
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body schemas.DietitianLoginRequest true "规划师登录请求"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/auth/dietitian/login [post]
func (h *AuthHandler) DietitianLogin(c *gin.Context) {
	var req schemas.DietitianLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "请求参数错误",
		})
		return
	}

	response, err := h.authService.DietitianLogin(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "登录成功",
		Data:    response,
	})
}

// AdminLogin 管理员登录
// @Summary 管理员登录
// @Description 管理员登录获取令牌
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body schemas.AdminLoginRequest true "管理员登录请求"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/auth/admin/login [post]
func (h *AuthHandler) AdminLogin(c *gin.Context) {
	var req schemas.AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "请求参数错误",
		})
		return
	}

	response, err := h.authService.AdminLogin(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "登录成功",
		Data:    response,
	})
}

// CreateDietitian 管理员创建规划师
// @Summary 管理员创建规划师
// @Description 管理员添加新规划师
// @Tags 认证
// @Accept json
// @Produce json
// @Param request body schemas.CreateDietitianRequest true "创建规划师请求"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/auth/admin/dietitian [post]
func (h *AuthHandler) CreateDietitian(c *gin.Context) {
	var req schemas.CreateDietitianRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "请求参数错误",
		})
		return
	}

	dietitian, err := h.authService.CreateDietitian(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "规划师创建成功",
		Data:    dietitian,
	})
}

// GetAllDietitians 获取所有规划师
// @Summary 获取所有规划师
// @Description 获取所有规划师列表
// @Tags 认证
// @Produce json
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/auth/admin/dietitians [get]
func (h *AuthHandler) GetAllDietitians(c *gin.Context) {
	dietitians, err := h.authService.GetAllDietitians()
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "获取成功",
		Data:    dietitians,
	})
}

// UpdateDietitianStatus 更新规划师状态
// @Summary 更新规划师状态
// @Description 管理员更新规划师的启用/禁用状态
// @Tags 认证
// @Accept json
// @Produce json
// @Param user_id path string true "规划师ID"
// @Param request body schemas.UpdateDietitianStatusRequest true "状态请求"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/auth/admin/dietitian/{user_id}/status [put]
func (h *AuthHandler) UpdateDietitianStatus(c *gin.Context) {
	userID := c.Param("user_id")
	var req schemas.UpdateDietitianStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: "请求参数错误",
		})
		return
	}

	err := h.authService.UpdateDietitianStatus(userID, req.Status)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "状态更新成功",
	})
}

// DeleteDietitian 删除规划师
// @Summary 删除规划师
// @Description 管理员删除规划师
// @Tags 认证
// @Produce json
// @Param user_id path string true "规划师ID"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/auth/admin/dietitian/{user_id} [delete]
func (h *AuthHandler) DeleteDietitian(c *gin.Context) {
	userID := c.Param("user_id")

	err := h.authService.DeleteDietitian(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "删除成功",
	})
}

// RegisterAuthRoutes 注册认证路由
func RegisterAuthRoutes(router *gin.RouterGroup) {
	handler := NewAuthHandler()

	authGroup := router.Group("/auth")
	{
		authGroup.POST("/register", handler.Register)
		authGroup.POST("/login", handler.Login)
		authGroup.POST("/dietitian/login", handler.DietitianLogin)
		authGroup.POST("/admin/login", handler.AdminLogin)
		authGroup.POST("/admin/dietitian", handler.CreateDietitian)
		authGroup.GET("/admin/dietitians", handler.GetAllDietitians)
		authGroup.PUT("/admin/dietitian/:user_id/status", handler.UpdateDietitianStatus)
		authGroup.DELETE("/admin/dietitian/:user_id", handler.DeleteDietitian)
	}
}