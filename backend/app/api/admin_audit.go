package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"
)

type AdminAuditHandler struct {
	svc *services.AdminAuditService
}

func NewAdminAuditHandler() *AdminAuditHandler {
	return &AdminAuditHandler{svc: services.NewAdminAuditService()}
}

func RegisterAdminAuditRoutes(router *gin.RouterGroup) {
	h := NewAdminAuditHandler()
	g := router.Group("/admin/audit")
	{
		g.GET("/history", h.HistoryList)
	}
}

func (h *AdminAuditHandler) HistoryList(c *gin.Context) {
	if strings.TrimSpace(c.GetString("roleType")) != "admin" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅管理员可查看审核历史"})
		return
	}
	items, err := h.svc.GetAuditHistory()
	if err != nil {
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "ok", Data: items})
}
