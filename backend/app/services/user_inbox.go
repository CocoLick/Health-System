package services

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"
)

func parseHETargetUserIDs(s string) []string {
	s = strings.TrimSpace(s)
	if s == "" || s == "null" {
		return nil
	}
	var ids []string
	if json.Unmarshal([]byte(s), &ids) != nil {
		return nil
	}
	return ids
}

func userInTargetList(userID string, targets []string) bool {
	for _, id := range targets {
		if strings.TrimSpace(id) == userID {
			return true
		}
	}
	return false
}

func dietitianPrefix(nameMap map[string]string, dietitianID string) string {
	n := strings.TrimSpace(nameMap[dietitianID])
	if n == "" {
		return ""
	}
	return n + " · "
}

// BuildUserInbox 聚合普通用户首页消息（服务申请、膳食计划、营养评估、指派健康教育）
func BuildUserInbox(userID string, limit int) []schemas.UserInboxMessage {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil
	}
	if limit <= 0 || limit > 80 {
		limit = 40
	}

	dietitianIDSet := make(map[string]bool)

	var srs []models.ServiceRequest
	_ = config.DB.Where("user_id = ?", userID).Order("update_time DESC").Limit(50).Find(&srs).Error
	for _, sr := range srs {
		dietitianIDSet[sr.DietitianID] = true
	}

	var plans []models.DietPlan
	_ = config.DB.Where("user_id = ?", userID).Order("updated_at DESC").Limit(50).Find(&plans).Error
	for _, p := range plans {
		dietitianIDSet[p.DietitianID] = true
	}

	var evals []models.NutritionEvaluation
	_ = config.DB.Where("user_id = ?", userID).Order("created_at DESC").Limit(30).Find(&evals).Error
	for _, ev := range evals {
		dietitianIDSet[ev.DietitianID] = true
	}

	var heRows []models.HealthEducation
	_ = config.DB.Where("content_status = ? AND audit_status = ? AND visibility = ?", "published", "approved", "assigned").
		Order("updated_at DESC").Limit(80).Find(&heRows).Error
	var heForUser []models.HealthEducation
	for _, he := range heRows {
		if userInTargetList(userID, parseHETargetUserIDs(he.TargetUserIDs)) {
			dietitianIDSet[he.DietitianID] = true
			heForUser = append(heForUser, he)
		}
	}

	var dids []string
	for id := range dietitianIDSet {
		id = strings.TrimSpace(id)
		if id != "" {
			dids = append(dids, id)
		}
	}
	nameMap := NewServiceRequestService().DietitianNamesByIDs(dids)

	var msgs []schemas.UserInboxMessage

	for _, sr := range srs {
		prefix := dietitianPrefix(nameMap, sr.DietitianID)
		switch sr.Status {
		case "approved":
			msgs = append(msgs, schemas.UserInboxMessage{
				ID:      fmt.Sprintf("sr:%s:approved", sr.RequestID),
				Type:    "service_request_approved",
				Title:   "规划师已通过您的服务申请",
				Summary: prefix + fmt.Sprintf("申请编号 %s · 可开始使用相关服务", sr.RequestID),
				RefID:   sr.RequestID,
				Time:    schemas.FormatUserInboxTime(sr.UpdateTime),
			})
		case "rejected":
			msgs = append(msgs, schemas.UserInboxMessage{
				ID:      fmt.Sprintf("sr:%s:rejected", sr.RequestID),
				Type:    "service_request_rejected",
				Title:   "规划师未通过您的服务申请",
				Summary: prefix + fmt.Sprintf("申请编号 %s", sr.RequestID),
				RefID:   sr.RequestID,
				Time:    schemas.FormatUserInboxTime(sr.UpdateTime),
			})
		}
	}

	for _, p := range plans {
		prefix := dietitianPrefix(nameMap, p.DietitianID)
		title := strings.TrimSpace(p.PlanTitle)
		if title == "" {
			title = "膳食计划"
		}
		st := strings.TrimSpace(p.AuditStatus)
		switch st {
		case "pending_review":
			msgs = append(msgs, schemas.UserInboxMessage{
				ID:      fmt.Sprintf("plan:%s:pending", p.PlanID),
				Type:    "diet_plan_pending_review",
				Title:   fmt.Sprintf("膳食计划「%s」待平台审核", title),
				Summary: prefix + "规划师已提交，审核通过后即可在膳食页查看完整内容",
				RefID:   p.PlanID,
				Time:    schemas.FormatUserInboxTime(p.UpdatedAt),
			})
		case "approved":
			tm := p.UpdatedAt
			if p.AuditedAt != nil && !p.AuditedAt.IsZero() {
				tm = *p.AuditedAt
			}
			msgs = append(msgs, schemas.UserInboxMessage{
				ID:      fmt.Sprintf("plan:%s:approved", p.PlanID),
				Type:    "diet_plan_approved",
				Title:   fmt.Sprintf("膳食计划「%s」已生效", title),
				Summary: prefix + "已通过审核，可在膳食页查看与执行",
				RefID:   p.PlanID,
				Time:    schemas.FormatUserInboxTime(tm),
			})
		case "rejected":
			note := strings.TrimSpace(p.AuditNote)
			sum := "审核未通过，可联系规划师或重新制定"
			if note != "" {
				r := []rune(note)
				if len(r) > 80 {
					note = string(r[:80]) + "…"
				}
				sum = note
			}
			msgs = append(msgs, schemas.UserInboxMessage{
				ID:      fmt.Sprintf("plan:%s:rejected", p.PlanID),
				Type:    "diet_plan_rejected",
				Title:   fmt.Sprintf("膳食计划「%s」未通过审核", title),
				Summary: prefix + sum,
				RefID:   p.PlanID,
				Time:    schemas.FormatUserInboxTime(p.UpdatedAt),
			})
		}
	}

	for _, ev := range evals {
		prefix := dietitianPrefix(nameMap, ev.DietitianID)
		msgs = append(msgs, schemas.UserInboxMessage{
			ID:      fmt.Sprintf("ev:%s", ev.EvaluationID),
			Type:    "nutrition_evaluation",
			Title:   "规划师已为您完成营养评估",
			Summary: prefix + "可前往健康页查看评估结论与建议",
			RefID:   ev.EvaluationID,
			Time:    schemas.FormatUserInboxTime(ev.CreatedAt),
		})
	}

	for _, he := range heForUser {
		prefix := dietitianPrefix(nameMap, he.DietitianID)
		ti := strings.TrimSpace(he.Title)
		if ti == "" {
			ti = "健康教育"
		}
		sum := strings.TrimSpace(he.Summary)
		if sum != "" {
			sum = prefix + sum
		} else {
			sum = prefix + "点击查看全文"
		}
		msgs = append(msgs, schemas.UserInboxMessage{
			ID:      fmt.Sprintf("he:%s", he.HEID),
			Type:    "health_education_assigned",
			Title:   fmt.Sprintf("规划师指派的健康文章「%s」", ti),
			Summary: sum,
			RefID:   he.HEID,
			Time:    schemas.FormatUserInboxTime(he.UpdatedAt),
		})
	}

	sort.Slice(msgs, func(i, j int) bool {
		ti, errI := time.Parse(time.RFC3339, msgs[i].Time)
		tj, errJ := time.Parse(time.RFC3339, msgs[j].Time)
		if errI != nil || errJ != nil {
			return msgs[i].Time > msgs[j].Time
		}
		return ti.After(tj)
	})
	if len(msgs) > limit {
		msgs = msgs[:limit]
	}
	return msgs
}
