package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"
)

type HealthEducationHandler struct {
	svc *services.HealthEducationService
}

func NewHealthEducationHandler() *HealthEducationHandler {
	return &HealthEducationHandler{svc: services.NewHealthEducationService()}
}

func RegisterHealthEducationRoutes(router *gin.RouterGroup) {
	h := NewHealthEducationHandler()
	g := router.Group("/health-education")
	{
		// 用户端阅读（须放在 /:id 之前，避免被误匹配）
		g.GET("/reader", h.ReaderList)
		g.GET("/reader/:heId", h.ReaderGet)
		g.GET("", h.List)
		g.POST("", h.Create)
		g.GET("/:id", h.Get)
		g.PUT("/:id", h.Update)
		g.POST("/:id/publish", h.Publish)
	}
}

func (h *HealthEducationHandler) dietitianID(c *gin.Context) (string, bool) {
	if strings.TrimSpace(c.GetString("roleType")) != "dietitian" {
		return "", false
	}
	id := strings.TrimSpace(c.GetString("userID"))
	return id, id != ""
}

// ReaderList GET /api/health-education/reader?visibility=all|public|assigned
func (h *HealthEducationHandler) ReaderList(c *gin.Context) {
	if strings.TrimSpace(c.GetString("roleType")) != "user" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "请使用普通用户账号查看"})
		return
	}
	uid := strings.TrimSpace(c.GetString("userID"))
	if uid == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}
	var q schemas.HealthEducationReaderQuery
	_ = c.ShouldBindQuery(&q)
	list, err := h.svc.ListForReader(uid, q)
	if err != nil {
		if errors.Is(err, services.ErrHealthEducationValidation) {
			c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "ok", Data: list})
}

// ReaderGet GET /api/health-education/reader/:heId
func (h *HealthEducationHandler) ReaderGet(c *gin.Context) {
	if strings.TrimSpace(c.GetString("roleType")) != "user" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "请使用普通用户账号查看"})
		return
	}
	uid := strings.TrimSpace(c.GetString("userID"))
	if uid == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未授权"})
		return
	}
	resp, err := h.svc.GetForReader(uid, c.Param("heId"))
	if err != nil {
		if errors.Is(err, services.ErrHealthEducationNotFound) {
			c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "不存在"})
			return
		}
		if errors.Is(err, services.ErrHealthEducationForbidden) {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "无权查看"})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "ok", Data: resp})
}

// List GET /api/health-education
func (h *HealthEducationHandler) List(c *gin.Context) {
	did, ok := h.dietitianID(c)
	if !ok {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅规划师可查看健康教育内容"})
		return
	}
	var q schemas.HealthEducationListQuery
	_ = c.ShouldBindQuery(&q)
	list, err := h.svc.List(did, q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "ok", Data: list})
}

// Create POST /api/health-education
func (h *HealthEducationHandler) Create(c *gin.Context) {
	did, ok := h.dietitianID(c)
	if !ok {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅规划师可创建健康教育内容"})
		return
	}
	var req schemas.HealthEducationCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "请求参数错误"})
		return
	}
	row, err := h.svc.Create(did, req)
	if err != nil {
		if errors.Is(err, services.ErrHealthEducationValidation) || strings.Contains(err.Error(), "服务关系") {
			c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "已保存草稿", Data: h.svc.ToResponseDetail(row)})
}

// Get GET /api/health-education/:id
func (h *HealthEducationHandler) Get(c *gin.Context) {
	did, ok := h.dietitianID(c)
	if !ok {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅规划师可查看"})
		return
	}
	id := c.Param("id")
	resp, err := h.svc.Get(did, id)
	if err != nil {
		if errors.Is(err, services.ErrHealthEducationNotFound) {
			c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "不存在"})
			return
		}
		if errors.Is(err, services.ErrHealthEducationForbidden) {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "无权查看"})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "ok", Data: resp})
}

// Update PUT /api/health-education/:id
func (h *HealthEducationHandler) Update(c *gin.Context) {
	did, ok := h.dietitianID(c)
	if !ok {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅规划师可编辑"})
		return
	}
	var req schemas.HealthEducationUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "请求参数错误"})
		return
	}
	row, err := h.svc.Update(did, c.Param("id"), req)
	if err != nil {
		if errors.Is(err, services.ErrHealthEducationNotFound) {
			c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "不存在"})
			return
		}
		if errors.Is(err, services.ErrHealthEducationForbidden) {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "无权编辑"})
			return
		}
		if errors.Is(err, services.ErrHealthEducationValidation) || strings.Contains(err.Error(), "服务关系") {
			c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "已更新", Data: h.svc.ToResponseDetail(row)})
}

// Publish POST /api/health-education/:id/publish
func (h *HealthEducationHandler) Publish(c *gin.Context) {
	did, ok := h.dietitianID(c)
	if !ok {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅规划师可发布"})
		return
	}
	var req schemas.HealthEducationPublish
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "请求参数错误"})
		return
	}
	row, err := h.svc.Publish(did, c.Param("id"), req)
	if err != nil {
		if errors.Is(err, services.ErrHealthEducationNotFound) {
			c.JSON(http.StatusNotFound, schemas.Response{Code: 404, Message: "不存在"})
			return
		}
		if errors.Is(err, services.ErrHealthEducationForbidden) {
			c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "无权发布"})
			return
		}
		if errors.Is(err, services.ErrHealthEducationValidation) || strings.Contains(err.Error(), "服务关系") || strings.Contains(err.Error(), "指派") || strings.Contains(err.Error(), "标题") || strings.Contains(err.Error(), "正文") {
			c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, schemas.Response{Code: 500, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "已发布", Data: h.svc.ToResponseDetail(row)})
}
