package services

import (
	"errors"
	"strings"

	"github.com/yourusername/nutrition-system/app/models"
	"gorm.io/gorm"
)

const dietPlanDietGoalMaxRunes = 50

// 已通过或待处理的服务申请均可作为计划快照来源（开发中常见尚未点「通过」）
var serviceRequestStatusesForPlan = []string{"approved", "pending"}

func formatSnapshotDietGoal(sr *models.ServiceRequest) string {
	if sr == nil {
		return ""
	}
	g := strings.TrimSpace(sr.DietGoal)
	o := strings.TrimSpace(sr.OtherGoal)
	if o == "" {
		return g
	}
	if g == "" {
		return o
	}
	return strings.TrimSpace(g + "：" + o)
}

func truncateDietGoalSnapshot(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	r := []rune(s)
	if len(r) <= dietPlanDietGoalMaxRunes {
		return s
	}
	return string(r[:dietPlanDietGoalMaxRunes-1]) + "…"
}

func srBase(db *gorm.DB) *gorm.DB {
	return db.Model(&models.ServiceRequest{})
}

// resolveServiceRequestForDietPlan 按优先级查找与用户相关的服务申请
func resolveServiceRequestForDietPlan(db *gorm.DB, plan *models.DietPlan, preferredRequestID string) (*models.ServiceRequest, error) {
	if plan == nil || plan.UserID == "" {
		return nil, nil
	}
	pref := strings.TrimSpace(preferredRequestID)

	if pref != "" {
		var sr models.ServiceRequest
		err := srBase(db).Where("request_id = ? AND user_id = ?", pref, plan.UserID).
			Where("status IN ?", serviceRequestStatusesForPlan).
			Order("update_time DESC").First(&sr).Error
		if err == nil {
			return &sr, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	if strings.TrimSpace(plan.DietitianID) != "" {
		for _, st := range []string{"approved", "pending"} {
			var sr models.ServiceRequest
			err := srBase(db).Where("user_id = ? AND dietitian_id = ? AND status = ?", plan.UserID, plan.DietitianID, st).
				Order("update_time DESC").First(&sr).Error
			if err == nil {
				return &sr, nil
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, err
			}
		}
	}

	for _, st := range []string{"approved", "pending"} {
		var sr models.ServiceRequest
		err := srBase(db).Where("user_id = ? AND status = ?", plan.UserID, st).
			Order("update_time DESC").First(&sr).Error
		if err == nil {
			return &sr, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	return nil, nil
}

// fillDietPlanFromApprovedServiceRequest 将服务申请写入膳食计划（service_request_id + 饮食目标快照）
func fillDietPlanFromApprovedServiceRequest(db *gorm.DB, plan *models.DietPlan, preferredRequestID string, fallbackDietGoal string) error {
	if plan == nil || plan.UserID == "" {
		return nil
	}
	sr, err := resolveServiceRequestForDietPlan(db, plan, preferredRequestID)
	if err != nil {
		return err
	}
	if sr != nil {
		plan.ServiceRequestID = sr.RequestID
		plan.DietGoal = truncateDietGoalSnapshot(formatSnapshotDietGoal(sr))
		return nil
	}
	if strings.TrimSpace(plan.DietGoal) == "" {
		plan.DietGoal = truncateDietGoalSnapshot(strings.TrimSpace(fallbackDietGoal))
	}
	return nil
}
