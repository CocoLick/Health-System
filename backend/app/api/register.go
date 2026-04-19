package api

import (
	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/middleware"
)

// Response 通用响应结构
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// RegisterRoutes 注册所有API路由
func RegisterRoutes(router *gin.Engine) {
	// 跨域中间件
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// API路由组
	apiGroup := router.Group("/api")
	{
		// 注册认证路由（公开）
		RegisterAuthRoutes(apiGroup)

		// 注册公开的食材路由（不需要认证）
		RegisterIngredientRoutes(apiGroup)

		// 需要认证的路由
		authGroup := apiGroup.Group("/")
		authGroup.Use(middleware.AuthMiddleware())
		{
			// 注册健康数据路由
			RegisterHealthDataRoutes(authGroup)

			// 注册营养记录路由
			RegisterNutritionRecordRoutes(authGroup)
		}
	}
}