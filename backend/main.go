package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/api"
	"github.com/yourusername/nutrition-system/config"
)

func main() {
	// 初始化配置
	config.Init()

	// 设置Gin模式
	gin.SetMode(gin.ReleaseMode)

	// 创建Gin引擎
	r := gin.Default()

	// 注册路由
	api.RegisterRoutes(r)

	// 启动服务器
	port := config.GetEnv("PORT", "8000")
	log.Printf("Server starting on port %s (include GET /api/auth/admin/users)", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
