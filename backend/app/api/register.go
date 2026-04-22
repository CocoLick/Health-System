package api

import (
	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/middleware"
	"github.com/yourusername/nutrition-system/app/services"
)

// Response 通用响应结构
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// RegisterServiceRequestRoutes 注册服务请求路由
func RegisterServiceRequestRoutes(router *gin.RouterGroup) {
	handler := NewServiceRequestHandler()

	serviceRequestGroup := router.Group("/service-request")
	{
		serviceRequestGroup.POST("/", handler.CreateServiceRequest)                   // 创建服务请求
		serviceRequestGroup.GET("/", handler.GetUserServiceRequests)                // 获取用户的服务请求列表
		serviceRequestGroup.GET("/dietitian/list", handler.GetDietitianServiceRequests) // 获取规划师的服务请求列表
		serviceRequestGroup.GET("/dietitian/users", handler.GetDietitianServiceUsers) // 获取规划师的服务用户列表
		serviceRequestGroup.PUT("/:id/cancel", handler.CancelServiceRequest)         // 取消服务请求
		serviceRequestGroup.PUT("/:id/approve", handler.ApproveServiceRequest)    // 批准服务请求
		serviceRequestGroup.PUT("/:id/reject", handler.RejectServiceRequest)       // 拒绝服务请求
		serviceRequestGroup.GET("/:id", handler.GetServiceRequestByID)             // 根据ID获取服务请求
	}
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

			// 注册营养推荐路由
			RegisterNutritionRecommendationRoutes(authGroup)

			// 注册服务请求路由
			RegisterServiceRequestRoutes(authGroup)

			// 营养评估
			RegisterNutritionEvaluationRoutes(authGroup)

			// 健康教育（规划师）
			RegisterHealthEducationRoutes(authGroup)

			// 注册膳食计划路由
			dietPlanService := services.NewDietPlanService()
			dietPlanHandler := NewDietPlanHandler(dietPlanService)
			dietPlanHandler.RegisterRoutes(authGroup)
		}
	}
}