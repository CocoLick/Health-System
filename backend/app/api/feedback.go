package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"
)

type FeedbackHandler struct {
	svc *services.FeedbackService
}

func NewFeedbackHandler() *FeedbackHandler {
	return &FeedbackHandler{svc: services.NewFeedbackService()}
}

func RegisterFeedbackRoutes(router *gin.RouterGroup) {
	h := NewFeedbackHandler()
	g := router.Group("/feedback")
	{
		g.GET("/dietitian/pending-count", h.PendingCount)
		g.GET("/dietitian", h.ListDietitian)
		// 用户端列表/详情须注册在 /:id 之前，避免 "user" 被当作 feedback_id
		g.GET("/user", h.ListUser)
		g.GET("/user/:id", h.DetailUser)
		g.POST("/user/:id/replies", h.AddUserReply)
		g.POST("/:id/replies", h.AddReply)
		g.GET("/:id", h.DetailDietitian)
		g.POST("", h.CreateUser)
	}
}

// ListDietitian GET /api/feedback/dietitian?status=pending|replied|all
func (h *FeedbackHandler) ListDietitian(c *gin.Context) {
	if strings.TrimSpace(c.GetString("roleType")) != "dietitian" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅规划师可查看"})
		return
	}
	did := strings.TrimSpace(c.GetString("userID"))
	if did == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}
	var q schemas.FeedbackDietitianListQuery
	_ = c.ShouldBindQuery(&q)
	list, err := h.svc.ListForDietitian(did, q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "ok", Data: list})
}

// PendingCount GET /api/feedback/dietitian/pending-count
func (h *FeedbackHandler) PendingCount(c *gin.Context) {
	if strings.TrimSpace(c.GetString("roleType")) != "dietitian" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅规划师"})
		return
	}
	did := strings.TrimSpace(c.GetString("userID"))
	n, err := h.svc.CountPendingForDietitian(did)
	if err != nil {
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "ok", Data: map[string]int64{"count": n}})
}

// DetailDietitian GET /api/feedback/:id
func (h *FeedbackHandler) DetailDietitian(c *gin.Context) {
	if strings.TrimSpace(c.GetString("roleType")) != "dietitian" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅规划师可查看"})
		return
	}
	did := strings.TrimSpace(c.GetString("userID"))
	id := c.Param("id")
	detail, err := h.svc.DetailForDietitian(did, id)
	if err != nil {
		if errors.Is(err, services.ErrFeedbackNotFound) {
			c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "不存在"})
			return
		}
		if errors.Is(err, services.ErrFeedbackForbidden) {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "无权查看"})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "ok", Data: detail})
}

// AddReply POST /api/feedback/:id/replies
func (h *FeedbackHandler) AddReply(c *gin.Context) {
	if strings.TrimSpace(c.GetString("roleType")) != "dietitian" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅规划师可回复"})
		return
	}
	did := strings.TrimSpace(c.GetString("userID"))
	var req schemas.FeedbackReplyCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "请求参数错误"})
		return
	}
	err := h.svc.AddDietitianReply(did, c.Param("id"), req.Body)
	if err != nil {
		if errors.Is(err, services.ErrFeedbackNotFound) {
			c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "不存在"})
			return
		}
		if errors.Is(err, services.ErrFeedbackForbidden) {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "无权回复"})
			return
		}
		if errors.Is(err, services.ErrFeedbackValidation) || strings.Contains(err.Error(), "工单") || strings.Contains(err.Error(), "回复内容") {
			c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "已回复"})
}

// ListUser GET /api/feedback/user 当前用户反馈列表
func (h *FeedbackHandler) ListUser(c *gin.Context) {
	if strings.TrimSpace(c.GetString("roleType")) != "user" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅普通用户可查看"})
		return
	}
	uid := strings.TrimSpace(c.GetString("userID"))
	if uid == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}
	list, err := h.svc.ListForUser(uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "ok", Data: list})
}

// DetailUser GET /api/feedback/user/:id 用户查看自己的单条反馈（含回复）
func (h *FeedbackHandler) DetailUser(c *gin.Context) {
	if strings.TrimSpace(c.GetString("roleType")) != "user" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅普通用户可查看"})
		return
	}
	uid := strings.TrimSpace(c.GetString("userID"))
	id := strings.TrimSpace(c.Param("id"))
	if uid == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}
	detail, err := h.svc.DetailForUser(uid, id)
	if err != nil {
		if errors.Is(err, services.ErrFeedbackNotFound) {
			c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "不存在"})
			return
		}
		if errors.Is(err, services.ErrFeedbackForbidden) {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "无权查看"})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "ok", Data: detail})
}

// AddUserReply POST /api/feedback/user/:id/replies 用户继续回复
func (h *FeedbackHandler) AddUserReply(c *gin.Context) {
	if strings.TrimSpace(c.GetString("roleType")) != "user" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅普通用户可回复"})
		return
	}
	uid := strings.TrimSpace(c.GetString("userID"))
	var req schemas.FeedbackReplyCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "请求参数错误"})
		return
	}
	err := h.svc.AddUserReply(uid, strings.TrimSpace(c.Param("id")), req.Body)
	if err != nil {
		if errors.Is(err, services.ErrFeedbackNotFound) {
			c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "不存在"})
			return
		}
		if errors.Is(err, services.ErrFeedbackForbidden) {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "无权回复"})
			return
		}
		if errors.Is(err, services.ErrFeedbackValidation) || strings.Contains(err.Error(), "工单") || strings.Contains(err.Error(), "回复内容") {
			c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "已回复"})
}

// CreateUser POST /api/feedback （普通用户，供后续用户端接入）
func (h *FeedbackHandler) CreateUser(c *gin.Context) {
	if strings.TrimSpace(c.GetString("roleType")) != "user" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "请使用普通用户账号提交反馈"})
		return
	}
	uid := strings.TrimSpace(c.GetString("userID"))
	var req schemas.FeedbackCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "请求参数错误"})
		return
	}
	row, err := h.svc.CreateUserFeedback(uid, req)
	if err != nil {
		if errors.Is(err, services.ErrFeedbackForbidden) {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: err.Error()})
			return
		}
		if errors.Is(err, services.ErrFeedbackValidation) || strings.Contains(err.Error(), "未与") || strings.Contains(err.Error(), "必填") || strings.Contains(err.Error(), "无效") || strings.Contains(err.Error(), "不存在") {
			c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "已提交", Data: map[string]string{"feedback_id": row.FeedbackID}})
}
