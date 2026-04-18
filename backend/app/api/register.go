package api

import (
	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/middleware"
)

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
		// 注册认证路由
		RegisterAuthRoutes(apiGroup)

		// 注册需要认证的路由
		authGroup := apiGroup.Group("/")
		authGroup.Use(middleware.AuthMiddleware())
		{
			// 这里将注册其他需要认证的路由
			// 例如：健康数据、营养记录、膳食计划等
		}
	}
}
