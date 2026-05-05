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
	ErrFeedbackNotFound   = errors.New("反馈不存在")
	ErrFeedbackForbidden  = errors.New("无权操作该反馈")
	ErrFeedbackValidation = errors.New("参数错误")
)

type FeedbackService struct {
	db *gorm.DB
}

func NewFeedbackService() *FeedbackService {
	return &FeedbackService{db: config.DB}
}

func (s *FeedbackService) userNamesByIDs(ids []string) map[string]string {
	out := make(map[string]string)
	if len(ids) == 0 {
		return out
	}
	seen := make(map[string]bool)
	uniq := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		uniq = append(uniq, id)
	}
	if len(uniq) == 0 {
		return out
	}
	var users []models.User
	if err := s.db.Select("user_id", "username", "name").Where("user_id IN ?", uniq).Find(&users).Error; err != nil {
		return out
	}
	for _, u := range users {
		n := strings.TrimSpace(u.Name)
		if n == "" {
			n = strings.TrimSpace(u.Username)
		}
		if n != "" {
			out[u.UserID] = n
		}
	}
	return out
}

func (s *FeedbackService) accountNamesByIDs(ids []string) map[string]string {
	out := make(map[string]string)
	if len(ids) == 0 {
		return out
	}
	seen := make(map[string]bool)
	uniq := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		uniq = append(uniq, id)
	}
	if len(uniq) == 0 {
		return out
	}

	// 先查普通用户
	var users []models.User
	if err := s.db.Select("user_id", "username", "name").Where("user_id IN ?", uniq).Find(&users).Error; err == nil {
		for _, u := range users {
			n := strings.TrimSpace(u.Name)
			if n == "" {
				n = strings.TrimSpace(u.Username)
			}
			if n != "" {
				out[u.UserID] = n
			}
		}
	}

	// 再查 dietitian/admin 账号
	var missed []string
	for _, id := range uniq {
		if _, ok := out[id]; !ok {
			missed = append(missed, id)
		}
	}
	if len(missed) == 0 {
		return out
	}
	var staffs []models.Dietitian
	if err := s.db.Select("account_id", "username", "name").Where("account_id IN ?", missed).Find(&staffs).Error; err != nil {
		return out
	}
	for _, st := range staffs {
		n := strings.TrimSpace(st.Name)
		if n == "" {
			n = strings.TrimSpace(st.Username)
		}
		if n != "" {
			out[st.AccountID] = n
		}
	}
	return out
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
	case "diet_plan", "dietitian_service", "dietitian_review", "system":
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
	case "dietitian_review":
		return "规划师评价"
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
		Where("user_id = ? AND dietitian_id = ? AND status IN ?", userID, dietitianID, []string{"approved", "completed"}).
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

	row := &models.UserFeedback{
		FeedbackID: newFeedbackID(),
		UserID:     userID,
		Category:   cat,
		Title:      title,
		Content:    content,
		Rating:     req.Rating,
		Status:     "pending",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	switch cat {
	case "diet_plan":
		if title == "" || content == "" {
			return nil, fmt.Errorf("%w: 标题与内容不能为空", ErrFeedbackValidation)
		}
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
		if title == "" || content == "" {
			return nil, fmt.Errorf("%w: 标题与内容不能为空", ErrFeedbackValidation)
		}
		did := strings.TrimSpace(req.TargetDietitianID)
		if did == "" {
			return nil, fmt.Errorf("%w: 规划服务类反馈需指定 target_dietitian_id", ErrFeedbackValidation)
		}
		if !s.userServesDietitian(userID, did) {
			return nil, fmt.Errorf("%w: 未与该规划师建立已批准的服务关系", ErrFeedbackValidation)
		}
		row.TargetDietitianID = did
	case "dietitian_review":
		did := strings.TrimSpace(req.TargetDietitianID)
		if did == "" {
			return nil, fmt.Errorf("%w: 规划师评价需指定 target_dietitian_id", ErrFeedbackValidation)
		}
		if req.Rating == nil || *req.Rating < 1 || *req.Rating > 5 {
			return nil, fmt.Errorf("%w: 规划师评价 rating 必填且范围为 1-5", ErrFeedbackValidation)
		}
		if !s.userServesDietitian(userID, did) {
			return nil, fmt.Errorf("%w: 未与该规划师建立已通过/已完成的服务关系", ErrFeedbackValidation)
		}
		if title == "" {
			title = "规划师评价"
		}
		if content == "" {
			content = "用户未填写文字评价"
		}
		row.Title = title
		row.Content = content
		row.Status = "closed"
		row.TargetDietitianID = did
	case "system":
		if title == "" || content == "" {
			return nil, fmt.Errorf("%w: 标题与内容不能为空", ErrFeedbackValidation)
		}
		row.TargetDietitianID = ""
	}

	if err := s.db.Create(row).Error; err != nil {
		return nil, err
	}
	return row, nil
}

// ListDietitianReviewsForUser 用户端查看规划师评价列表
func (s *FeedbackService) ListDietitianReviewsForUser(dietitianID string, limit int) ([]schemas.FeedbackDietitianReviewItem, error) {
	dietitianID = strings.TrimSpace(dietitianID)
	if dietitianID == "" {
		return []schemas.FeedbackDietitianReviewItem{}, nil
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var rows []models.UserFeedback
	if err := s.db.
		Where("target_dietitian_id = ? AND category = ? AND rating IS NOT NULL", dietitianID, "dietitian_review").
		Order("created_at DESC").
		Limit(limit).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	userIDs := make([]string, 0, len(rows))
	for _, r := range rows {
		userIDs = append(userIDs, r.UserID)
	}
	names := s.userNamesByIDs(userIDs)
	out := make([]schemas.FeedbackDietitianReviewItem, 0, len(rows))
	for _, r := range rows {
		rating := 0
		if r.Rating != nil {
			rating = *r.Rating
		}
		username := strings.TrimSpace(names[r.UserID])
		if username == "" {
			username = r.UserID
		}
		out = append(out, schemas.FeedbackDietitianReviewItem{
			FeedbackID: r.FeedbackID,
			UserID:     r.UserID,
			Username:   username,
			Rating:     rating,
			Content:    strings.TrimSpace(r.Content),
			CreatedAt:  r.CreatedAt,
		})
	}
	return out, nil
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

// ListForDietitian 指派给当前规划师的反馈（不含 system / dietitian_review）
func (s *FeedbackService) ListForDietitian(dietitianID string, q schemas.FeedbackDietitianListQuery) ([]schemas.FeedbackListItem, error) {
	dietitianID = strings.TrimSpace(dietitianID)
	st := strings.ToLower(strings.TrimSpace(q.Status))
	if st == "" {
		st = "all"
	}

	tx := s.db.Model(&models.UserFeedback{}).
		Where("target_dietitian_id = ? AND category NOT IN ?", dietitianID, []string{"system", "dietitian_review"}).
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
	names := s.userNamesByIDs(userIDs)

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
		Where("target_dietitian_id = ? AND status = ? AND category NOT IN ?", strings.TrimSpace(dietitianID), "pending", []string{"system", "dietitian_review"}).
		Count(&n).Error
	return n, err
}

// ListSystemForAdmin 管理员：user_feedback 中 category=system 的工单列表
func (s *FeedbackService) ListSystemForAdmin() ([]schemas.FeedbackListItem, error) {
	var rows []models.UserFeedback
	// 与写入端 normalize 一致：库中可能存在大小写/首尾空格差异，避免列表为空
	if err := s.db.Where("LOWER(TRIM(category)) = ?", "system").
		Order("CASE WHEN status = 'pending' THEN 0 ELSE 1 END, updated_at DESC").
		Limit(200).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return []schemas.FeedbackListItem{}, nil
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
	names := s.userNamesByIDs(userIDs)
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

// DetailForAdminSystem 管理员查看系统类反馈详情
func (s *FeedbackService) DetailForAdminSystem(_ string, feedbackID string) (*schemas.FeedbackDetailResponse, error) {
	fb, err := s.getFeedback(feedbackID)
	if err != nil {
		return nil, err
	}
	if normalizeFeedbackCategory(fb.Category) != "system" {
		return nil, ErrFeedbackForbidden
	}
	return s.buildFeedbackDetail(fb)
}

// AddAdminReplyToSystem 管理员回复系统类反馈
func (s *FeedbackService) AddAdminReplyToSystem(adminID, feedbackID, body string) error {
	adminID = strings.TrimSpace(adminID)
	body = strings.TrimSpace(body)
	if adminID == "" || body == "" {
		return fmt.Errorf("%w: 回复内容不能为空", ErrFeedbackValidation)
	}
	fb, err := s.getFeedback(feedbackID)
	if err != nil {
		return err
	}
	if normalizeFeedbackCategory(fb.Category) != "system" {
		return ErrFeedbackForbidden
	}
	if fb.Status == "closed" {
		return fmt.Errorf("%w: 工单已关闭", ErrFeedbackValidation)
	}
	now := time.Now()
	reply := &models.FeedbackReply{
		ReplyID:      newReplyID(),
		FeedbackID:   feedbackID,
		SenderType:   "admin",
		SenderUserID: adminID,
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

// CloseSystemFeedbackAdmin 管理员关闭系统类反馈工单
func (s *FeedbackService) CloseSystemFeedbackAdmin(_ string, feedbackID string) error {
	feedbackID = strings.TrimSpace(feedbackID)
	fb, err := s.getFeedback(feedbackID)
	if err != nil {
		return err
	}
	if normalizeFeedbackCategory(fb.Category) != "system" {
		return ErrFeedbackForbidden
	}
	if fb.Status == "closed" {
		return fmt.Errorf("%w: 已关闭", ErrFeedbackValidation)
	}
	now := time.Now()
	fb.Status = "closed"
	fb.UpdatedAt = now
	if fb.ClosedAt == nil {
		fb.ClosedAt = &now
	}
	return s.db.Save(fb).Error
}

// buildFeedbackDetail 构造详情（含回复与展示名）
func (s *FeedbackService) buildFeedbackDetail(fb *models.UserFeedback) (*schemas.FeedbackDetailResponse, error) {
	un := strings.TrimSpace(s.userNamesByIDs([]string{fb.UserID})[fb.UserID])
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
	senderNames := s.accountNamesByIDs(replySenderIDs)

	repOut := make([]schemas.FeedbackReplyItem, 0, len(replies))
	for _, rp := range replies {
		nm := strings.TrimSpace(senderNames[rp.SenderUserID])
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
			FeedbackID:        r.FeedbackID,
			Category:          r.Category,
			CategoryLabel:     categoryLabel(r.Category),
			Title:             r.Title,
			ContentPreview:    previewContent(r.Content, 80),
			Status:            r.Status,
			StatusLabel:       statusLabel(r.Status),
			RelatedPlanID:     r.RelatedPlanID,
			TargetDietitianID: targetDid,
			RepliesCount:      countBy[r.FeedbackID],
			CreatedAt:         r.CreatedAt,
			UpdatedAt:         r.UpdatedAt,
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

// TextLinesForDietPlanOptimize 为膳食计划智能优化组 prompt；指定 ID 时仅取校验通过的条目，否则取该用户近期相关反馈
func (s *FeedbackService) TextLinesForDietPlanOptimize(dietitianID, userID, planID string, feedbackIDs []string) ([]string, error) {
	dietitianID = strings.TrimSpace(dietitianID)
	userID = strings.TrimSpace(userID)
	planID = strings.TrimSpace(planID)
	if dietitianID == "" || userID == "" {
		return nil, fmt.Errorf("%w", ErrFeedbackValidation)
	}

	lines := make([]string, 0, 8)
	if len(feedbackIDs) > 0 {
		for _, raw := range feedbackIDs {
			fid := strings.TrimSpace(raw)
			if fid == "" {
				continue
			}
			fb, err := s.getFeedback(fid)
			if err != nil {
				continue
			}
			if strings.TrimSpace(fb.UserID) != userID {
				continue
			}
			if err := s.assertDietitianTarget(dietitianID, fb); err != nil {
				continue
			}
			lines = append(lines, s.formatFeedbackForPrompt(fb))
		}
		return lines, nil
	}

	var rows []models.UserFeedback
	tx := s.db.Where("user_id = ? AND target_dietitian_id = ? AND category != ?", userID, dietitianID, "system")
	if planID != "" {
		tx = tx.Order(gorm.Expr("CASE WHEN related_plan_id = ? THEN 0 ELSE 1 END, updated_at DESC", planID))
	} else {
		tx = tx.Order("updated_at DESC")
	}
	if err := tx.Limit(8).Find(&rows).Error; err != nil {
		return nil, err
	}
	for i := range rows {
		lines = append(lines, s.formatFeedbackForPrompt(&rows[i]))
	}
	return lines, nil
}

func (s *FeedbackService) formatFeedbackForPrompt(fb *models.UserFeedback) string {
	title := strings.TrimSpace(fb.Title)
	content := strings.TrimSpace(fb.Content)
	var b strings.Builder
	b.WriteString("[")
	b.WriteString(fb.FeedbackID)
	b.WriteString("]")
	if title != "" {
		b.WriteString(" ")
		b.WriteString(title)
	}
	b.WriteString("：")
	b.WriteString(content)

	var replies []models.FeedbackReply
	_ = s.db.Where("feedback_id = ? AND sender_type = ?", fb.FeedbackID, "user").Order("created_at ASC").Find(&replies).Error
	for _, rp := range replies {
		t := strings.TrimSpace(rp.Body)
		if t == "" {
			continue
		}
		b.WriteString(" | 用户补充：")
		b.WriteString(t)
	}
	return b.String()
}

// AdminStats 管理员：反馈处理统计
func (s *FeedbackService) AdminStats(days int) (*schemas.FeedbackAdminStats, error) {
	if days <= 0 {
		days = 7
	}

	var rows []models.UserFeedback
	if err := s.db.Select("category", "status", "created_at", "first_reply_at").Find(&rows).Error; err != nil {
		return nil, err
	}

	now := time.Now()
	labels := make([]string, 0, days)
	dateSet := make(map[string]bool, days)
	for i := days - 1; i >= 0; i-- {
		d := now.AddDate(0, 0, -i).Format("2006-01-02")
		labels = append(labels, d)
		dateSet[d] = true
	}

	createdMap := make(map[string]int, days)
	processedMap := make(map[string]int, days)

	var out schemas.FeedbackAdminStats
	for _, it := range rows {
		out.TotalCount++
		switch strings.TrimSpace(it.Status) {
		case "pending":
			out.PendingCount++
		case "replied":
			out.RepliedCount++
		case "closed":
			out.ClosedCount++
		}

		switch strings.TrimSpace(it.Category) {
		case "diet_plan":
			out.DietPlanCount++
		case "dietitian_service":
			out.ServiceCount++
		case "dietitian_review":
			out.ReviewCount++
		case "system":
			out.SystemCount++
		}

		createdKey := it.CreatedAt.Format("2006-01-02")
		if dateSet[createdKey] {
			createdMap[createdKey] = createdMap[createdKey] + 1
		}
		if it.FirstReplyAt != nil {
			processedKey := it.FirstReplyAt.Format("2006-01-02")
			if dateSet[processedKey] {
				processedMap[processedKey] = processedMap[processedKey] + 1
			}
		}
	}

	out.CreatedTrend7d = make([]schemas.FeedbackTrendPoint, 0, days)
	out.ProcessedTrend7d = make([]schemas.FeedbackTrendPoint, 0, days)
	for _, d := range labels {
		out.CreatedTrend7d = append(out.CreatedTrend7d, schemas.FeedbackTrendPoint{
			Date:  d,
			Count: createdMap[d],
		})
		out.ProcessedTrend7d = append(out.ProcessedTrend7d, schemas.FeedbackTrendPoint{
			Date:  d,
			Count: processedMap[d],
		})
	}
	return &out, nil
}
