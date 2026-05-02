package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"
)

func inboxRoleType(c *gin.Context) string {
	v, _ := c.Get("roleType")
	s, _ := v.(string)
	return s
}

// RegisterUserInboxRoutes GET /api/inbox/messages — 普通用户首页消息聚合
func RegisterUserInboxRoutes(authGroup *gin.RouterGroup) {
	authGroup.GET("/inbox/messages", func(c *gin.Context) {
		if inboxRoleType(c) != "user" {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅普通用户可查看"})
			return
		}
		uid := c.GetString("userID")
		if uid == "" {
			c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未登录"})
			return
		}
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "40"))
		items := services.BuildUserInbox(uid, limit)
		c.JSON(http.StatusOK, schemas.Response{
			Code:    200,
			Message: "获取成功",
			Data: map[string]interface{}{
				"items": items,
			},
		})
	})
}
