package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/app/services"
)

// IngredientHandler 食材处理器
type IngredientHandler struct {
	ingredientService *services.IngredientService
}

func ensureAdmin(c *gin.Context) bool {
	if c.GetString("roleType") != "admin" {
		c.JSON(http.StatusForbidden, schemas.Response{Code: 403, Message: "仅管理员可操作"})
		return false
	}
	return true
}

// NewIngredientHandler 创建食材处理器实例
func NewIngredientHandler() *IngredientHandler {
	return &IngredientHandler{
		ingredientService: services.NewIngredientService(),
	}
}

// CreateIngredient 创建食材
// @Summary 创建食材
// @Description 创建新的食材
// @Tags 食材管理
// @Accept json
// @Produce json
// @Param request body schemas.IngredientRequest true "食材请求"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/ingredients [post]
func (h *IngredientHandler) CreateIngredient(c *gin.Context) {
	var req schemas.IngredientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	ingredient, err := h.ingredientService.CreateIngredient(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	nutritionDetails, _ := ingredient.GetNutritionDetails()
	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "创建成功",
		Data: schemas.IngredientResponse{
			IngredientID: ingredient.IngredientID,
			Name:         ingredient.Name,
			Category:     ingredient.Category,
			Calorie100g:  ingredient.Calorie100g,
			Nutrition100g: schemas.NutritionDetails{
				Protein:      nutritionDetails.Protein,
				Carbohydrate: nutritionDetails.Carbohydrate,
				Fat:          nutritionDetails.Fat,
				Fiber:        nutritionDetails.Fiber,
				VitaminC:     nutritionDetails.VitaminC,
				Calcium:      nutritionDetails.Calcium,
				Iron:         nutritionDetails.Iron,
			},
			Unit:        ingredient.Unit,
			GramPerUnit: ingredient.GramPerUnit,
			Status:      ingredient.Status,
			CreatedAt:   ingredient.CreatedAt,
			UpdatedAt:   ingredient.UpdatedAt,
		},
	})
}

// GetIngredientByID 根据ID获取食材
// @Summary 根据ID获取食材
// @Description 根据食材ID获取食材详情
// @Tags 食材管理
// @Produce json
// @Param ingredient_id path string true "食材ID"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/ingredients/{ingredient_id} [get]
func (h *IngredientHandler) GetIngredientByID(c *gin.Context) {
	ingredientID := c.Param("ingredient_id")

	ingredient, err := h.ingredientService.GetIngredientByID(ingredientID)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	nutritionDetails, _ := ingredient.GetNutritionDetails()
	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "获取成功",
		Data: schemas.IngredientResponse{
			IngredientID: ingredient.IngredientID,
			Name:         ingredient.Name,
			Category:     ingredient.Category,
			Calorie100g:  ingredient.Calorie100g,
			Nutrition100g: schemas.NutritionDetails{
				Protein:      nutritionDetails.Protein,
				Carbohydrate: nutritionDetails.Carbohydrate,
				Fat:          nutritionDetails.Fat,
				Fiber:        nutritionDetails.Fiber,
				VitaminC:     nutritionDetails.VitaminC,
				Calcium:      nutritionDetails.Calcium,
				Iron:         nutritionDetails.Iron,
			},
			Unit:        ingredient.Unit,
			GramPerUnit: ingredient.GramPerUnit,
			Status:      ingredient.Status,
			CreatedAt:   ingredient.CreatedAt,
			UpdatedAt:   ingredient.UpdatedAt,
		},
	})
}

// GetIngredientList 获取食材列表
// @Summary 获取食材列表
// @Description 获取食材列表，支持分页和按类别筛选
// @Tags 食材管理
// @Produce json
// @Param category query string false "食材类别"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/ingredients [get]
func (h *IngredientHandler) GetIngredientList(c *gin.Context) {
	category := c.Query("category")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	ingredients, total, err := h.ingredientService.GetIngredientList(category, page, pageSize)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	var ingredientResponses []schemas.IngredientResponse
	for _, ingredient := range ingredients {
		nutritionDetails, _ := ingredient.GetNutritionDetails()
		ingredientResponses = append(ingredientResponses, schemas.IngredientResponse{
			IngredientID: ingredient.IngredientID,
			Name:         ingredient.Name,
			Category:     ingredient.Category,
			Calorie100g:  ingredient.Calorie100g,
			Nutrition100g: schemas.NutritionDetails{
				Protein:      nutritionDetails.Protein,
				Carbohydrate: nutritionDetails.Carbohydrate,
				Fat:          nutritionDetails.Fat,
				Fiber:        nutritionDetails.Fiber,
				VitaminC:     nutritionDetails.VitaminC,
				Calcium:      nutritionDetails.Calcium,
				Iron:         nutritionDetails.Iron,
			},
			Unit:        ingredient.Unit,
			GramPerUnit: ingredient.GramPerUnit,
			Status:      ingredient.Status,
			CreatedAt:   ingredient.CreatedAt,
			UpdatedAt:   ingredient.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "获取成功",
		Data: schemas.IngredientListResponse{
			Ingredients: ingredientResponses,
			Total:       total,
		},
	})
}

// UpdateIngredient 更新食材
// @Summary 更新食材
// @Description 更新食材信息
// @Tags 食材管理
// @Accept json
// @Produce json
// @Param ingredient_id path string true "食材ID"
// @Param request body schemas.IngredientRequest true "食材请求"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/ingredients/{ingredient_id} [put]
func (h *IngredientHandler) UpdateIngredient(c *gin.Context) {
	ingredientID := c.Param("ingredient_id")
	var req schemas.IngredientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	ingredient, err := h.ingredientService.UpdateIngredient(ingredientID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	nutritionDetails, _ := ingredient.GetNutritionDetails()
	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "更新成功",
		Data: schemas.IngredientResponse{
			IngredientID: ingredient.IngredientID,
			Name:         ingredient.Name,
			Category:     ingredient.Category,
			Calorie100g:  ingredient.Calorie100g,
			Nutrition100g: schemas.NutritionDetails{
				Protein:      nutritionDetails.Protein,
				Carbohydrate: nutritionDetails.Carbohydrate,
				Fat:          nutritionDetails.Fat,
				Fiber:        nutritionDetails.Fiber,
				VitaminC:     nutritionDetails.VitaminC,
				Calcium:      nutritionDetails.Calcium,
				Iron:         nutritionDetails.Iron,
			},
			Unit:        ingredient.Unit,
			GramPerUnit: ingredient.GramPerUnit,
			Status:      ingredient.Status,
			CreatedAt:   ingredient.CreatedAt,
			UpdatedAt:   ingredient.UpdatedAt,
		},
	})
}

// UpdateIngredientStatus 更新食材状态
// @Summary 更新食材状态
// @Description 更新食材的启用/禁用状态
// @Tags 食材管理
// @Accept json
// @Produce json
// @Param ingredient_id path string true "食材ID"
// @Param request body schemas.IngredientStatusRequest true "状态更新请求"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/ingredients/{ingredient_id}/status [put]
func (h *IngredientHandler) UpdateIngredientStatus(c *gin.Context) {
	ingredientID := c.Param("ingredient_id")
	var req schemas.IngredientStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	err := h.ingredientService.UpdateIngredientStatus(ingredientID, req.Status)
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

// DeleteIngredient 删除食材
// @Summary 删除食材
// @Description 删除指定的食材
// @Tags 食材管理
// @Produce json
// @Param ingredient_id path string true "食材ID"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/ingredients/{ingredient_id} [delete]
func (h *IngredientHandler) DeleteIngredient(c *gin.Context) {
	ingredientID := c.Param("ingredient_id")

	err := h.ingredientService.DeleteIngredient(ingredientID)
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

// SearchIngredients 搜索食材
// @Summary 搜索食材
// @Description 根据关键词搜索食材
// @Tags 食材管理
// @Produce json
// @Param keyword query string true "搜索关键词"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} schemas.Response
// @Failure 400 {object} schemas.Response
// @Router /api/ingredients/search [get]
func (h *IngredientHandler) SearchIngredients(c *gin.Context) {
	keyword := c.Query("keyword")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	ingredients, total, err := h.ingredientService.SearchIngredients(keyword, page, pageSize)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{
			Code:    400,
			Message: err.Error(),
		})
		return
	}

	var ingredientResponses []schemas.IngredientResponse
	for _, ingredient := range ingredients {
		nutritionDetails, _ := ingredient.GetNutritionDetails()
		ingredientResponses = append(ingredientResponses, schemas.IngredientResponse{
			IngredientID: ingredient.IngredientID,
			Name:         ingredient.Name,
			Category:     ingredient.Category,
			Calorie100g:  ingredient.Calorie100g,
			Nutrition100g: schemas.NutritionDetails{
				Protein:      nutritionDetails.Protein,
				Carbohydrate: nutritionDetails.Carbohydrate,
				Fat:          nutritionDetails.Fat,
				Fiber:        nutritionDetails.Fiber,
				VitaminC:     nutritionDetails.VitaminC,
				Calcium:      nutritionDetails.Calcium,
				Iron:         nutritionDetails.Iron,
			},
			Unit:        ingredient.Unit,
			GramPerUnit: ingredient.GramPerUnit,
			Status:      ingredient.Status,
			CreatedAt:   ingredient.CreatedAt,
			UpdatedAt:   ingredient.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "搜索成功",
		Data: schemas.IngredientListResponse{
			Ingredients: ingredientResponses,
			Total:       total,
		},
	})
}

// CreateIngredientSubmission 用户提交食材（方案 A：仅创建工单，审核通过后才有可记账食材）
func (h *IngredientHandler) CreateIngredientSubmission(c *gin.Context) {
	var req schemas.IngredientSubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未登录"})
		return
	}
	submission, _, err := h.ingredientService.CreateIngredientSubmission(userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "提交成功，管理员审核通过后将加入食材库并可用于饮食记录",
		Data: schemas.IngredientSubmissionResponse{
			SubmissionID:        submission.SubmissionID,
			IngredientIDPrivate: submission.IngredientIDPrivate,
			AutoCalcCalories:    submission.AutoCalcCalories,
			AutoDeltaRatio:      submission.AutoDeltaRatio,
			AutoCheckResult:     submission.AutoCheckResult,
			WorkflowStatus:      submission.WorkflowStatus,
		},
	})
}

// GetUserVisibleIngredientList 获取用户可见食材（公共+本人私有）
func (h *IngredientHandler) GetUserVisibleIngredientList(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未登录"})
		return
	}
	category := c.Query("category")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "100"))
	ingredients, total, err := h.ingredientService.GetUserVisibleIngredients(userID, category, page, pageSize)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	var ingredientResponses []schemas.IngredientResponse
	for _, ingredient := range ingredients {
		nutritionDetails, _ := ingredient.GetNutritionDetails()
		ingredientResponses = append(ingredientResponses, schemas.IngredientResponse{
			IngredientID: ingredient.IngredientID,
			Name:         ingredient.Name,
			Category:     ingredient.Category,
			Calorie100g:  ingredient.Calorie100g,
			Nutrition100g: schemas.NutritionDetails{
				Protein:      nutritionDetails.Protein,
				Carbohydrate: nutritionDetails.Carbohydrate,
				Fat:          nutritionDetails.Fat,
				Fiber:        nutritionDetails.Fiber,
				VitaminC:     nutritionDetails.VitaminC,
				Calcium:      nutritionDetails.Calcium,
				Iron:         nutritionDetails.Iron,
			},
			Unit:         ingredient.Unit,
			GramPerUnit:  ingredient.GramPerUnit,
			Scope:        ingredient.Scope,
			OwnerUserID:  ingredient.OwnerUserID,
			ReviewStatus: ingredient.ReviewStatus,
			RiskLevel:    ingredient.RiskLevel,
			Status:       ingredient.Status,
			CreatedAt:    ingredient.CreatedAt,
			UpdatedAt:    ingredient.UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "获取成功",
		Data: schemas.IngredientListResponse{
			Ingredients: ingredientResponses,
			Total:       total,
		},
	})
}

func (h *IngredientHandler) GetIngredientSubmissionList(c *gin.Context) {
	if !ensureAdmin(c) {
		return
	}
	workflowStatus := c.DefaultQuery("workflow_status", "pending")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, total, err := h.ingredientService.GetIngredientSubmissions(workflowStatus, page, pageSize)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	respItems := make([]schemas.IngredientSubmissionListItem, 0, len(items))
	for _, item := range items {
		nutri := schemas.NutritionDetails{}
		_ = json.Unmarshal([]byte(item.SubmittedNutrition100g), &nutri)
		respItems = append(respItems, schemas.IngredientSubmissionListItem{
			SubmissionID:             item.SubmissionID,
			UserID:                   item.UserID,
			IngredientIDPrivate:      item.IngredientIDPrivate,
			SubmittedName:            item.SubmittedName,
			SubmittedCategory:        item.SubmittedCategory,
			SubmittedCaloriesPer100g: item.SubmittedCaloriesPer100g,
			SubmittedNutrition100g:   nutri,
			SubmittedUnit:            item.SubmittedUnit,
			SubmittedGramPerUnit:     item.SubmittedGramPerUnit,
			AutoCalcCalories:         item.AutoCalcCalories,
			AutoDeltaRatio:           item.AutoDeltaRatio,
			AutoCheckResult:          item.AutoCheckResult,
			WorkflowStatus:           item.WorkflowStatus,
			ReviewNote:               item.ReviewNote,
			CreatedAt:                item.CreatedAt,
			UpdatedAt:                item.UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "获取成功",
		Data: schemas.IngredientSubmissionListResponse{
			Items: respItems,
			Total: total,
		},
	})
}

func (h *IngredientHandler) GetMyIngredientSubmissionList(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未登录"})
		return
	}
	workflowStatus := c.Query("workflow_status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	items, total, err := h.ingredientService.GetUserIngredientSubmissions(userID, workflowStatus, page, pageSize)
	if err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	respItems := make([]schemas.IngredientSubmissionListItem, 0, len(items))
	for _, item := range items {
		nutri := schemas.NutritionDetails{}
		_ = json.Unmarshal([]byte(item.SubmittedNutrition100g), &nutri)
		respItems = append(respItems, schemas.IngredientSubmissionListItem{
			SubmissionID:             item.SubmissionID,
			UserID:                   item.UserID,
			IngredientIDPrivate:      item.IngredientIDPrivate,
			SubmittedName:            item.SubmittedName,
			SubmittedCategory:        item.SubmittedCategory,
			SubmittedCaloriesPer100g: item.SubmittedCaloriesPer100g,
			SubmittedNutrition100g:   nutri,
			SubmittedUnit:            item.SubmittedUnit,
			SubmittedGramPerUnit:     item.SubmittedGramPerUnit,
			AutoCalcCalories:         item.AutoCalcCalories,
			AutoDeltaRatio:           item.AutoDeltaRatio,
			AutoCheckResult:          item.AutoCheckResult,
			WorkflowStatus:           item.WorkflowStatus,
			ReviewNote:               item.ReviewNote,
			CreatedAt:                item.CreatedAt,
			UpdatedAt:                item.UpdatedAt,
		})
	}
	c.JSON(http.StatusOK, schemas.Response{
		Code:    200,
		Message: "获取成功",
		Data: schemas.IngredientSubmissionListResponse{
			Items: respItems,
			Total: total,
		},
	})
}

func (h *IngredientHandler) ApproveIngredientSubmission(c *gin.Context) {
	if !ensureAdmin(c) {
		return
	}
	var req schemas.IngredientReviewRequest
	_ = c.ShouldBindJSON(&req)
	submissionID := c.Param("submission_id")
	if submissionID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "缺少submission_id"})
		return
	}
	if err := h.ingredientService.ApproveIngredientSubmission(submissionID, c.GetString("userID"), req.ReviewNote); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "审核通过"})
}

func (h *IngredientHandler) ReturnIngredientSubmission(c *gin.Context) {
	if !ensureAdmin(c) {
		return
	}
	var req schemas.IngredientReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	submissionID := c.Param("submission_id")
	if submissionID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "缺少submission_id"})
		return
	}
	if err := h.ingredientService.ReturnIngredientSubmission(submissionID, c.GetString("userID"), req.ReviewNote); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "已退回"})
}

func (h *IngredientHandler) ApproveIngredientSubmissionWithEdit(c *gin.Context) {
	if !ensureAdmin(c) {
		return
	}
	submissionID := c.Param("submission_id")
	if submissionID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "缺少submission_id"})
		return
	}
	var req schemas.IngredientApproveWithEditRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	if err := h.ingredientService.ApproveIngredientSubmissionWithEdit(submissionID, c.GetString("userID"), req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "修正并通过成功"})
}

func (h *IngredientHandler) ResubmitIngredientSubmission(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, schemas.Response{Code: 401, Message: "未登录"})
		return
	}
	submissionID := c.Param("submission_id")
	if submissionID == "" {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: "缺少submission_id"})
		return
	}
	var req schemas.IngredientSubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	if err := h.ingredientService.ResubmitIngredientSubmission(userID, submissionID, req); err != nil {
		c.JSON(http.StatusBadRequest, schemas.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas.Response{Code: 200, Message: "重新提交成功"})
}

// RegisterIngredientRoutes 注册食材路由
func RegisterIngredientRoutes(router *gin.RouterGroup) {
	handler := NewIngredientHandler()

	ingredientGroup := router.Group("/ingredients")
	{
		ingredientGroup.POST("", handler.CreateIngredient)
		ingredientGroup.GET("", handler.GetIngredientList)
		ingredientGroup.GET("/search", handler.SearchIngredients)
		ingredientGroup.GET("/:ingredient_id", handler.GetIngredientByID)
		ingredientGroup.PUT("/:ingredient_id", handler.UpdateIngredient)
		ingredientGroup.PUT("/:ingredient_id/status", handler.UpdateIngredientStatus)
		ingredientGroup.DELETE("/:ingredient_id", handler.DeleteIngredient)
	}
}

func RegisterIngredientAuthRoutes(router *gin.RouterGroup) {
	handler := NewIngredientHandler()
	ingredientGroup := router.Group("/ingredients")
	{
		ingredientGroup.GET("/user-visible", handler.GetUserVisibleIngredientList)
		ingredientGroup.POST("/submission", handler.CreateIngredientSubmission)
		ingredientGroup.GET("/my-submissions", handler.GetMyIngredientSubmissionList)
		ingredientGroup.PUT("/my-submissions/:submission_id/resubmit", handler.ResubmitIngredientSubmission)
		ingredientGroup.GET("/admin/submissions", handler.GetIngredientSubmissionList)
		ingredientGroup.POST("/admin/submissions/:submission_id/approve", handler.ApproveIngredientSubmission)
		ingredientGroup.POST("/admin/submissions/:submission_id/approve-with-edit", handler.ApproveIngredientSubmissionWithEdit)
		ingredientGroup.POST("/admin/submissions/:submission_id/return", handler.ReturnIngredientSubmission)
	}
}
