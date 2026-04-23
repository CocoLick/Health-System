package services

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"

	"gorm.io/gorm"
)

var (
	ErrFeedbackNotFound    = errors.New("反馈不存在")
	ErrFeedbackForbidden   = errors.New("无权操作该反馈")
	ErrFeedbackValidation  = errors.New("参数错误")
)

type FeedbackService struct {
	db *gorm.DB
}

func NewFeedbackService() *FeedbackService {
	return &FeedbackService{db: config.DB}
}

func newFeedbackID() string {
	return fmt.Sprintf("FB%d%06d", time.Now().UnixMilli(), time.Now().Nanosecond()%1000000)
}

func newReplyID() string {
	return fmt.Sprintf("FR%d%06d", time.Now().UnixMilli(), time.Now().Nanosecond()%1000000)
}

func normalizeFeedbackCategory(c string) string {
	c = strings.ToLower(strings.TrimSpace(c))
	switch c {
	case "diet_plan", "dietitian_service", "system":
		return c
	default:
		return ""
	}
}

func categoryLabel(c string) string {
	switch c {
	case "diet_plan":
		return "膳食计划"
	case "dietitian_service":
		return "规划服务"
	case "system":
		return "系统功能"
	default:
		return c
	}
}

func statusLabel(s string) string {
	switch s {
	case "pending":
		return "待回复"
	case "replied":
		return "已回复"
	case "closed":
		return "已关闭"
	default:
		return s
	}
}

func previewContent(s string, max int) string {
	s = strings.TrimSpace(s)
	if max <= 0 || s == "" {
		return s
	}
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	runes := []rune(s)
	if len(runes) > max {
		return string(runes[:max]) + "…"
	}
	return s
}

func (s *FeedbackService) userServesDietitian(userID, dietitianID string) bool {
	userID, dietitianID = strings.TrimSpace(userID), strings.TrimSpace(dietitianID)
	if userID == "" || dietitianID == "" {
		return false
	}
	var n int64
	s.db.Model(&models.ServiceRequest{}).
		Where("user_id = ? AND dietitian_id = ? AND status = ?", userID, dietitianID, "approved").
		Count(&n)
	return n > 0
}

// CreateUserFeedback 用户提交（后端接口，用户端页面可后续接入）
func (s *FeedbackService) CreateUserFeedback(userID string, req schemas.FeedbackCreate) (*models.UserFeedback, error) {
	userID = strings.TrimSpace(userID)
	cat := normalizeFeedbackCategory(req.Category)
	if cat == "" {
		return nil, fmt.Errorf("%w: category 无效", ErrFeedbackValidation)
	}
	title := strings.TrimSpace(req.Title)
	content := strings.TrimSpace(req.Content)
	if title == "" || content == "" {
		return nil, fmt.Errorf("%w: 标题与内容不能为空", ErrFeedbackValidation)
	}

	row := &models.UserFeedback{
		FeedbackID:        newFeedbackID(),
		UserID:            userID,
		Category:          cat,
		Title:             title,
		Content:           content,
		Rating:            req.Rating,
		Status:            "pending",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	switch cat {
	case "diet_plan":
		pid := strings.TrimSpace(req.RelatedPlanID)
		if pid == "" {
			return nil, fmt.Errorf("%w: 膳食计划类反馈需填写 related_plan_id", ErrFeedbackValidation)
		}
		var plan models.DietPlan
		if err := s.db.Where("plan_id = ?", pid).First(&plan).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, fmt.Errorf("%w: 计划不存在", ErrFeedbackValidation)
			}
			return nil, err
		}
		if plan.UserID != userID {
			return nil, ErrFeedbackForbidden
		}
		row.RelatedPlanID = pid
		row.TargetDietitianID = strings.TrimSpace(plan.DietitianID)
	case "dietitian_service":
		did := strings.TrimSpace(req.TargetDietitianID)
		if did == "" {
			return nil, fmt.Errorf("%w: 规划服务类反馈需指定 target_dietitian_id", ErrFeedbackValidation)
		}
		if !s.userServesDietitian(userID, did) {
			return nil, fmt.Errorf("%w: 未与该规划师建立已批准的服务关系", ErrFeedbackValidation)
		}
		row.TargetDietitianID = did
	case "system":
		row.TargetDietitianID = ""
	}

	if err := s.db.Create(row).Error; err != nil {
		return nil, err
	}
	return row, nil
}

func (s *FeedbackService) getFeedback(feedbackID string) (*models.UserFeedback, error) {
	var row models.UserFeedback
	if err := s.db.Where("feedback_id = ?", feedbackID).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrFeedbackNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (s *FeedbackService) assertDietitianTarget(dietitianID string, fb *models.UserFeedback) error {
	if strings.TrimSpace(fb.TargetDietitianID) != strings.TrimSpace(dietitianID) {
		return ErrFeedbackForbidden
	}
	return nil
}

// ListForDietitian 指派给当前规划师的反馈（不含 system）
func (s *FeedbackService) ListForDietitian(dietitianID string, q schemas.FeedbackDietitianListQuery) ([]schemas.FeedbackListItem, error) {
	dietitianID = strings.TrimSpace(dietitianID)
	st := strings.ToLower(strings.TrimSpace(q.Status))
	if st == "" {
		st = "all"
	}

	tx := s.db.Model(&models.UserFeedback{}).
		Where("target_dietitian_id = ? AND category != ?", dietitianID, "system").
		Order("CASE WHEN status = 'pending' THEN 0 ELSE 1 END, updated_at DESC")

	switch st {
	case "pending":
		tx = tx.Where("status = ?", "pending")
	case "replied":
		tx = tx.Where("status IN ?", []string{"replied", "closed"})
	}

	var rows []models.UserFeedback
	if err := tx.Find(&rows).Error; err != nil {
		return nil, err
	}

	userIDs := make([]string, 0, len(rows))
	feedbackIDs := make([]string, 0, len(rows))
	seen := make(map[string]bool)
	for _, r := range rows {
		feedbackIDs = append(feedbackIDs, r.FeedbackID)
		if !seen[r.UserID] {
			seen[r.UserID] = true
			userIDs = append(userIDs, r.UserID)
		}
	}
	names := NewServiceRequestService().DietitianNamesByIDs(userIDs)

	// 规划师列表内容预览优先展示「用户最新一条追问」，
	// 若暂无用户追问（仅初始提单），则回退为反馈主内容摘要。
	latestUserReplyByFeedback := make(map[string]string, len(feedbackIDs))
	if len(feedbackIDs) > 0 {
		var replies []models.FeedbackReply
		_ = s.db.
			Where("feedback_id IN ? AND sender_type = ?", feedbackIDs, "user").
			Order("created_at ASC").
			Find(&replies).Error
		for _, rp := range replies {
			latestUserReplyByFeedback[rp.FeedbackID] = strings.TrimSpace(rp.Body)
		}
	}

	out := make([]schemas.FeedbackListItem, 0, len(rows))
	for _, r := range rows {
		un := strings.TrimSpace(names[r.UserID])
		if un == "" {
			un = r.UserID
		}
		initial := "用"
		rs := []rune(un)
		if len(rs) > 0 {
			initial = string(rs[0:1])
		}
		previewSource := strings.TrimSpace(latestUserReplyByFeedback[r.FeedbackID])
		if previewSource == "" {
			previewSource = r.Content
		}
		out = append(out, schemas.FeedbackListItem{
			FeedbackID:     r.FeedbackID,
			UserID:         r.UserID,
			Username:       un,
			UserInitial:    initial,
			Category:       r.Category,
			CategoryLabel:  categoryLabel(r.Category),
			Title:          r.Title,
			ContentPreview: previewContent(previewSource, 80),
			Status:         r.Status,
			StatusLabel:    statusLabel(r.Status),
			RelatedPlanID:  r.RelatedPlanID,
			CreatedAt:      r.CreatedAt,
			UpdatedAt:      r.UpdatedAt,
		})
	}
	return out, nil
}

// CountPendingForDietitian 待回复数量
func (s *FeedbackService) CountPendingForDietitian(dietitianID string) (int64, error) {
	var n int64
	err := s.db.Model(&models.UserFeedback{}).
		Where("target_dietitian_id = ? AND status = ? AND category != ?", strings.TrimSpace(dietitianID), "pending", "system").
		Count(&n).Error
	return n, err
}

// buildFeedbackDetail 构造详情（含回复与展示名）
func (s *FeedbackService) buildFeedbackDetail(fb *models.UserFeedback) (*schemas.FeedbackDetailResponse, error) {
	var u models.User
	_ = s.db.Select("user_id", "username", "name").Where("user_id = ?", fb.UserID).First(&u).Error
	un := strings.TrimSpace(u.Name)
	if un == "" {
		un = strings.TrimSpace(u.Username)
	}
	if un == "" {
		un = fb.UserID
	}

	planTitle := ""
	if strings.TrimSpace(fb.RelatedPlanID) != "" {
		var p models.DietPlan
		if err := s.db.Select("plan_title").Where("plan_id = ?", fb.RelatedPlanID).First(&p).Error; err == nil {
			planTitle = p.PlanTitle
		}
	}

	var replies []models.FeedbackReply
	if err := s.db.Where("feedback_id = ?", fb.FeedbackID).Order("created_at ASC").Find(&replies).Error; err != nil {
		return nil, err
	}

	replySenderIDs := make([]string, 0)
	for _, rp := range replies {
		replySenderIDs = append(replySenderIDs, rp.SenderUserID)
	}
	senderNames := NewServiceRequestService().DietitianNamesByIDs(replySenderIDs)

	repOut := make([]schemas.FeedbackReplyItem, 0, len(replies))
	for _, rp := range replies {
		nm := strings.TrimSpace(senderNames[rp.SenderUserID])
		if nm == "" {
			var su models.User
			if err := s.db.Select("username", "name").Where("user_id = ?", rp.SenderUserID).First(&su).Error; err == nil {
				nm = strings.TrimSpace(su.Name)
				if nm == "" {
					nm = strings.TrimSpace(su.Username)
				}
			}
		}
		if nm == "" {
			nm = rp.SenderUserID
		}
		repOut = append(repOut, schemas.FeedbackReplyItem{
			ReplyID:      rp.ReplyID,
			SenderType:   rp.SenderType,
			SenderUserID: rp.SenderUserID,
			SenderName:   nm,
			Body:         rp.Body,
			CreatedAt:    rp.CreatedAt,
		})
	}

	return &schemas.FeedbackDetailResponse{
		FeedbackID:    fb.FeedbackID,
		UserID:        fb.UserID,
		Username:      un,
		Category:      fb.Category,
		CategoryLabel: categoryLabel(fb.Category),
		Title:         fb.Title,
		Content:       fb.Content,
		Rating:        fb.Rating,
		RelatedPlanID: fb.RelatedPlanID,
		PlanTitle:     planTitle,
		Status:        fb.Status,
		StatusLabel:   statusLabel(fb.Status),
		FirstReplyAt:  fb.FirstReplyAt,
		CreatedAt:     fb.CreatedAt,
		UpdatedAt:     fb.UpdatedAt,
		Replies:       repOut,
	}, nil
}

// DetailForDietitian 详情含回复列表
func (s *FeedbackService) DetailForDietitian(dietitianID, feedbackID string) (*schemas.FeedbackDetailResponse, error) {
	fb, err := s.getFeedback(feedbackID)
	if err != nil {
		return nil, err
	}
	if err := s.assertDietitianTarget(dietitianID, fb); err != nil {
		return nil, err
	}
	return s.buildFeedbackDetail(fb)
}

// ListForUser 当前用户提交的反馈列表
func (s *FeedbackService) ListForUser(userID string) ([]schemas.FeedbackUserListItem, error) {
	userID = strings.TrimSpace(userID)
	var rows []models.UserFeedback
	if err := s.db.Where("user_id = ?", userID).Order("updated_at DESC").Limit(100).Find(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return []schemas.FeedbackUserListItem{}, nil
	}
	ids := make([]string, 0, len(rows))
	planIDs := make([]string, 0, len(rows))
	planSeen := make(map[string]bool)
	for _, r := range rows {
		ids = append(ids, r.FeedbackID)
		pid := strings.TrimSpace(r.RelatedPlanID)
		if pid != "" && !planSeen[pid] {
			planSeen[pid] = true
			planIDs = append(planIDs, pid)
		}
	}

	type cntRow struct {
		FeedbackID string `gorm:"column:feedback_id"`
		Cnt        int64  `gorm:"column:cnt"`
	}
	var cnts []cntRow
	_ = s.db.Model(&models.FeedbackReply{}).
		Select("feedback_id, count(*) as cnt").
		Where("feedback_id IN ?", ids).
		Group("feedback_id").
		Scan(&cnts).Error
	countBy := make(map[string]int64, len(cnts))
	for _, c := range cnts {
		countBy[c.FeedbackID] = c.Cnt
	}

	var allReplies []models.FeedbackReply
	_ = s.db.Where("feedback_id IN ?", ids).Order("created_at ASC").Find(&allReplies).Error
	lastDietitian := make(map[string]models.FeedbackReply)
	for _, rp := range allReplies {
		if strings.TrimSpace(rp.SenderType) == "dietitian" {
			lastDietitian[rp.FeedbackID] = rp
		}
	}

	planDietitianByPlanID := make(map[string]string)
	if len(planIDs) > 0 {
		type planDidRow struct {
			PlanID      string `gorm:"column:plan_id"`
			DietitianID string `gorm:"column:dietitian_id"`
		}
		var pRows []planDidRow
		_ = s.db.Model(&models.DietPlan{}).
			Select("plan_id, dietitian_id").
			Where("plan_id IN ?", planIDs).
			Scan(&pRows).Error
		for _, p := range pRows {
			pid := strings.TrimSpace(p.PlanID)
			did := strings.TrimSpace(p.DietitianID)
			if pid != "" && did != "" {
				planDietitianByPlanID[pid] = did
			}
		}
	}

	out := make([]schemas.FeedbackUserListItem, 0, len(rows))
	for _, r := range rows {
		targetDid := strings.TrimSpace(r.TargetDietitianID)
		if targetDid == "" {
			targetDid = strings.TrimSpace(planDietitianByPlanID[strings.TrimSpace(r.RelatedPlanID)])
		}
		item := schemas.FeedbackUserListItem{
			FeedbackID:         r.FeedbackID,
			Category:           r.Category,
			CategoryLabel:      categoryLabel(r.Category),
			Title:              r.Title,
			ContentPreview:     previewContent(r.Content, 80),
			Status:             r.Status,
			StatusLabel:        statusLabel(r.Status),
			RelatedPlanID:      r.RelatedPlanID,
			TargetDietitianID:  targetDid,
			RepliesCount:       countBy[r.FeedbackID],
			CreatedAt:          r.CreatedAt,
			UpdatedAt:          r.UpdatedAt,
		}
		if lr, ok := lastDietitian[r.FeedbackID]; ok {
			item.LastReplyPreview = previewContent(lr.Body, 120)
			t := lr.CreatedAt
			item.LastReplyAt = &t
		}
		out = append(out, item)
	}
	return out, nil
}

// DetailForUser 用户查看自己的反馈详情（含规划师回复）
func (s *FeedbackService) DetailForUser(userID, feedbackID string) (*schemas.FeedbackDetailResponse, error) {
	fb, err := s.getFeedback(feedbackID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(fb.UserID) != strings.TrimSpace(userID) {
		return nil, ErrFeedbackForbidden
	}
	return s.buildFeedbackDetail(fb)
}

// AddUserReply 用户继续回复（形成双向对话闭环）
func (s *FeedbackService) AddUserReply(userID, feedbackID, body string) error {
	body = strings.TrimSpace(body)
	if body == "" {
		return fmt.Errorf("%w: 回复内容不能为空", ErrFeedbackValidation)
	}
	fb, err := s.getFeedback(feedbackID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(fb.UserID) != strings.TrimSpace(userID) {
		return ErrFeedbackForbidden
	}
	if fb.Status == "closed" {
		return fmt.Errorf("%w: 工单已关闭", ErrFeedbackValidation)
	}

	now := time.Now()
	reply := &models.FeedbackReply{
		ReplyID:      newReplyID(),
		FeedbackID:   feedbackID,
		SenderType:   "user",
		SenderUserID: strings.TrimSpace(userID),
		Body:         body,
		CreatedAt:    now,
	}
	if err := s.db.Create(reply).Error; err != nil {
		return err
	}

	// 用户追问后恢复到待回复，便于规划师工作台继续跟进。
	fb.Status = "pending"
	fb.UpdatedAt = now
	return s.db.Save(fb).Error
}

// AddDietitianReply 规划师回复
func (s *FeedbackService) AddDietitianReply(dietitianID, feedbackID, body string) error {
	body = strings.TrimSpace(body)
	if body == "" {
		return fmt.Errorf("%w: 回复内容不能为空", ErrFeedbackValidation)
	}
	fb, err := s.getFeedback(feedbackID)
	if err != nil {
		return err
	}
	if err := s.assertDietitianTarget(dietitianID, fb); err != nil {
		return err
	}
	if fb.Status == "closed" {
		return fmt.Errorf("%w: 工单已关闭", ErrFeedbackValidation)
	}

	now := time.Now()
	reply := &models.FeedbackReply{
		ReplyID:      newReplyID(),
		FeedbackID:   feedbackID,
		SenderType:   "dietitian",
		SenderUserID: dietitianID,
		Body:         body,
		CreatedAt:    now,
	}
	if err := s.db.Create(reply).Error; err != nil {
		return err
	}

	fb.Status = "replied"
	fb.UpdatedAt = now
	if fb.FirstReplyAt == nil {
		fb.FirstReplyAt = &now
	}
	return s.db.Save(fb).Error
}
