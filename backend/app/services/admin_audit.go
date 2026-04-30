package services

import (
	"sort"
	"strings"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"
)

type AdminAuditService struct{}

func NewAdminAuditService() *AdminAuditService {
	return &AdminAuditService{}
}

func formatAuditTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format("2006-01-02 15:04:05")
}

func (s *AdminAuditService) GetAuditHistory() ([]schemas.AdminAuditHistoryItem, error) {
	items := make([]schemas.AdminAuditHistoryItem, 0, 128)

	var plans []models.DietPlan
	if err := config.DB.
		Where("audit_status IN ?", []string{"approved", "rejected"}).
		Order("updated_at DESC").
		Find(&plans).Error; err != nil {
		return nil, err
	}
	for _, p := range plans {
		status := "通过"
		reason := ""
		if strings.TrimSpace(p.AuditStatus) == "rejected" {
			status = "驳回"
			reason = strings.TrimSpace(p.AuditNote)
		}
		auditTime := ""
		if p.AuditedAt != nil {
			auditTime = formatAuditTime(*p.AuditedAt)
		}
		if auditTime == "" {
			auditTime = formatAuditTime(p.UpdatedAt)
		}
		items = append(items, schemas.AdminAuditHistoryItem{
			ID:         "diet_plan:" + p.PlanID,
			SourceID:   p.PlanID,
			SourceType: "diet_plan",
			Title:      p.PlanTitle,
			Type:       "膳食计划",
			Status:     status,
			Auditor:    strings.TrimSpace(p.AuditedBy),
			AuditTime:  auditTime,
			Reason:     reason,
		})
	}

	var articles []models.HealthEducation
	if err := config.DB.
		Where("audit_status IN ?", []string{"approved", "rejected"}).
		Order("updated_at DESC").
		Find(&articles).Error; err != nil {
		return nil, err
	}
	for _, a := range articles {
		status := "通过"
		reason := ""
		if strings.TrimSpace(a.AuditStatus) == "rejected" {
			status = "驳回"
			reason = strings.TrimSpace(a.ReviewNote)
		}
		items = append(items, schemas.AdminAuditHistoryItem{
			ID:         "health_education:" + a.HEID,
			SourceID:   a.HEID,
			SourceType: "health_education",
			Title:      a.Title,
			Type:       "健康文章",
			Status:     status,
			Auditor:    "管理员",
			AuditTime:  formatAuditTime(a.UpdatedAt),
			Reason:     reason,
		})
	}

	var submissions []models.IngredientSubmission
	if err := config.DB.
		Where("workflow_status IN ?", []string{"approved", "returned"}).
		Order("updated_at DESC").
		Find(&submissions).Error; err != nil {
		return nil, err
	}
	for _, it := range submissions {
		status := "通过"
		reason := ""
		if strings.TrimSpace(it.WorkflowStatus) == "returned" {
			status = "驳回"
			reason = strings.TrimSpace(it.ReviewNote)
		}
		auditor := strings.TrimSpace(it.ReviewerID)
		if auditor == "" {
			auditor = "管理员"
		}
		items = append(items, schemas.AdminAuditHistoryItem{
			ID:         "ingredient_submission:" + it.SubmissionID,
			SourceID:   it.SubmissionID,
			SourceType: "ingredient_submission",
			Title:      it.SubmittedName,
			Type:       "新增食材",
			Status:     status,
			Auditor:    auditor,
			AuditTime:  formatAuditTime(it.UpdatedAt),
			Reason:     reason,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return strings.Compare(items[i].AuditTime, items[j].AuditTime) > 0
	})

	return items, nil
}
