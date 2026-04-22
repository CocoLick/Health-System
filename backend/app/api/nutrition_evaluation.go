package api

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"

	"github.com/gin-gonic/gin"
)

type NutritionEvaluationHandler struct {
	svc *services.NutritionEvaluationService
}

func NewNutritionEvaluationHandler() *NutritionEvaluationHandler {
	return &NutritionEvaluationHandler{svc: services.NewNutritionEvaluationService()}
}

func RegisterNutritionEvaluationRoutes(router *gin.RouterGroup) {
	h := NewNutritionEvaluationHandler()
	g := router.Group("/evaluation")
	{
		g.POST("", h.Create)
		g.GET("/user", h.ListMine)
		g.GET("/by-user", h.ListByUser)
		g.GET("/:id", h.GetByID)
	}
}

func roleType(c *gin.Context) string {
	v, _ := c.Get("roleType")
	if v == nil {
		return ""
	}
	s, _ := v.(string)
	return s
}

// Create POST /api/evaluation  — 仅规划师
func (h *NutritionEvaluationHandler) Create(c *gin.Context) {
	if roleType(c) != "dietitian" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅规划师可提交营养评估"})
		return
	}
	dietitianID := c.GetString("userID")
	if dietitianID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}
	var req schemas.NutritionEvaluationCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "请求参数错误"})
		return
	}
	ev, err := h.svc.CreateEvaluation(dietitianID, req)
	if err != nil {
		if errors.Is(err, services.ErrNutritionEvaluationForbidden) {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	resp := services.EvaluationToResponse(ev)
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "评估已保存", Data: resp})
}

// ListMine GET /api/evaluation/user — 当前登录用户（普通用户）自己的评估
func (h *NutritionEvaluationHandler) ListMine(c *gin.Context) {
	if roleType(c) != "user" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "请使用规划师端「按用户查询」接口"})
		return
	}
	uid := c.GetString("userID")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	list, err := h.svc.ListMine(uid, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "获取成功", Data: list})
}

// ListByUser GET /api/evaluation/by-user?user_id= — 规划师查看某用户
func (h *NutritionEvaluationHandler) ListByUser(c *gin.Context) {
	if roleType(c) != "dietitian" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅规划师可查询"})
		return
	}
	dietitianID := c.GetString("userID")
	target := strings.TrimSpace(c.Query("user_id"))
	if target == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "缺少 user_id"})
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	list, err := h.svc.ListByUserForDietitian(dietitianID, target, limit)
	if err != nil {
		if errors.Is(err, services.ErrNutritionEvaluationForbidden) {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "获取成功", Data: list})
}

// GetByID GET /api/evaluation/:id
func (h *NutritionEvaluationHandler) GetByID(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "缺少评估ID"})
		return
	}
	rt := roleType(c)
	actor := c.GetString("userID")
	res, err := h.svc.GetByID(id, actor, rt)
	if err != nil {
		if errors.Is(err, services.ErrNutritionEvaluationNotFound) {
			c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: err.Error()})
			return
		}
		if errors.Is(err, services.ErrNutritionEvaluationForbidden) {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "获取成功", Data: res})
}
