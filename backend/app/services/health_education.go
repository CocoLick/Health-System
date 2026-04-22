package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"

	"gorm.io/gorm"
)

var (
	ErrHealthEducationNotFound   = errors.New("健康教育内容不存在")
	ErrHealthEducationForbidden  = errors.New("无权操作该内容")
	ErrHealthEducationValidation = errors.New("参数校验失败")
)

type HealthEducationService struct {
	db *gorm.DB
}

func NewHealthEducationService() *HealthEducationService {
	return &HealthEducationService{db: config.DB}
}

func newHEID() string {
	return fmt.Sprintf("HE%d%06d", time.Now().UnixMilli(), time.Now().Nanosecond()%1000000)
}

func (s *HealthEducationService) marshalTargets(ids []string) string {
	var clean []string
	seen := make(map[string]bool)
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		clean = append(clean, id)
	}
	b, _ := json.Marshal(clean)
	return string(b)
}

func parseTargetsJSON(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "null" {
		return nil
	}
	var ids []string
	if err := json.Unmarshal([]byte(raw), &ids); err != nil {
		return nil
	}
	return ids
}

// dietitianServesUser 是否存在已批准的规划师-用户服务关系
func (s *HealthEducationService) dietitianServesUser(dietitianID, userID string) bool {
	userID = strings.TrimSpace(userID)
	dietitianID = strings.TrimSpace(dietitianID)
	if userID == "" || dietitianID == "" {
		return false
	}
	var n int64
	s.db.Model(&models.ServiceRequest{}).
		Where("dietitian_id = ? AND user_id = ? AND status = ?", dietitianID, userID, "approved").
		Count(&n)
	return n > 0
}

func (s *HealthEducationService) assertAllServed(dietitianID string, userIDs []string) error {
	for _, uid := range userIDs {
		if !s.dietitianServesUser(dietitianID, uid) {
			return fmt.Errorf("%w: 用户 %s 不在您的已批准服务关系中", ErrHealthEducationValidation, uid)
		}
	}
	return nil
}

func normalizeVisibility(v string) string {
	v = strings.TrimSpace(strings.ToLower(v))
	if v == "assigned" {
		return "assigned"
	}
	return "public"
}

func (s *HealthEducationService) fillTargetUsernames(ids []string) []schemas.HEUserBrief {
	if len(ids) == 0 {
		return nil
	}
	svc := NewServiceRequestService()
	names := svc.DietitianNamesByIDs(ids)
	out := make([]schemas.HEUserBrief, 0, len(ids))
	for _, id := range ids {
		n := strings.TrimSpace(names[id])
		if n == "" {
			n = id
		}
		out = append(out, schemas.HEUserBrief{UserID: id, Username: n})
	}
	return out
}

// ToResponseDetail 含正文（详情/保存后返回）
func (s *HealthEducationService) ToResponseDetail(row *models.HealthEducation) schemas.HealthEducationResponse {
	return s.toResponse(row, true)
}

func (s *HealthEducationService) toResponseForReader(row *models.HealthEducation, withBody bool) schemas.HealthEducationResponse {
	resp := s.toResponse(row, withBody)
	resp.TargetUserIDs = nil
	resp.TargetUsers = nil
	nm := NewServiceRequestService().DietitianNamesByIDs([]string{row.DietitianID})
	if n := strings.TrimSpace(nm[row.DietitianID]); n != "" {
		resp.DietitianName = n
	} else {
		resp.DietitianName = row.DietitianID
	}
	return resp
}

func (s *HealthEducationService) toResponse(row *models.HealthEducation, withBody bool) schemas.HealthEducationResponse {
	ids := parseTargetsJSON(row.TargetUserIDs)
	resp := schemas.HealthEducationResponse{
		HEID:          row.HEID,
		DietitianID:   row.DietitianID,
		Title:         row.Title,
		Summary:       row.Summary,
		Category:      row.Category,
		Visibility:    row.Visibility,
		TargetUserIDs: ids,
		ContentStatus: row.ContentStatus,
		AuditStatus:   row.AuditStatus,
		CreatedAt:     row.CreatedAt,
		UpdatedAt:     row.UpdatedAt,
	}
	if row.Visibility == "assigned" && len(ids) > 0 {
		resp.TargetUsers = s.fillTargetUsernames(ids)
	}
	if withBody {
		resp.Body = row.Body
	}
	return resp
}

// Create 创建草稿
func (s *HealthEducationService) Create(dietitianID string, req schemas.HealthEducationCreate) (*models.HealthEducation, error) {
	dietitianID = strings.TrimSpace(dietitianID)
	if dietitianID == "" {
		return nil, ErrHealthEducationValidation
	}
	vis := normalizeVisibility(req.Visibility)
	if vis == "" {
		vis = "public"
	}
	targets := req.TargetUserIDs
	if vis == "assigned" && len(targets) > 0 {
		if err := s.assertAllServed(dietitianID, targets); err != nil {
			return nil, err
		}
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		title = "未命名"
	}
	body := strings.TrimSpace(req.Body)
	if body == "" {
		body = " "
	}
	row := &models.HealthEducation{
		HEID:            newHEID(),
		DietitianID:     dietitianID,
		Title:           title,
		Summary:         strings.TrimSpace(req.Summary),
		Body:            body,
		Category:        strings.TrimSpace(req.Category),
		Visibility:      vis,
		TargetUserIDs:   s.marshalTargets(targets),
		ContentStatus:   "draft",
		AuditStatus:     "none",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	if vis == "public" {
		row.TargetUserIDs = "[]"
	}
	if err := s.db.Create(row).Error; err != nil {
		return nil, err
	}
	return row, nil
}

func (s *HealthEducationService) getOwned(dietitianID, heID string) (*models.HealthEducation, error) {
	var row models.HealthEducation
	if err := s.db.Where("he_id = ?", heID).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrHealthEducationNotFound
		}
		return nil, err
	}
	if row.DietitianID != dietitianID {
		return nil, ErrHealthEducationForbidden
	}
	return &row, nil
}

// Update 更新（规划师本人）
func (s *HealthEducationService) Update(dietitianID, heID string, req schemas.HealthEducationUpdate) (*models.HealthEducation, error) {
	row, err := s.getOwned(dietitianID, heID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(req.Title) != "" {
		row.Title = strings.TrimSpace(req.Title)
	}
	row.Summary = strings.TrimSpace(req.Summary)
	if strings.TrimSpace(req.Body) != "" {
		row.Body = strings.TrimSpace(req.Body)
	}
	row.Category = strings.TrimSpace(req.Category)
	if req.Visibility != "" {
		row.Visibility = normalizeVisibility(req.Visibility)
	}
	if req.TargetUserIDs != nil {
		if row.Visibility == "assigned" {
			if err := s.assertAllServed(dietitianID, req.TargetUserIDs); err != nil {
				return nil, err
			}
			row.TargetUserIDs = s.marshalTargets(req.TargetUserIDs)
		} else {
			row.TargetUserIDs = "[]"
		}
	}
	if row.Visibility == "public" {
		row.TargetUserIDs = "[]"
	}
	row.UpdatedAt = time.Now()
	if err := s.db.Save(row).Error; err != nil {
		return nil, err
	}
	return row, nil
}

// Publish 发布：当前无审核流，audit_status 直接为 approved，content_status 为 published
func (s *HealthEducationService) Publish(dietitianID, heID string, req schemas.HealthEducationPublish) (*models.HealthEducation, error) {
	row, err := s.getOwned(dietitianID, heID)
	if err != nil {
		return nil, err
	}
	vis := normalizeVisibility(req.Visibility)
	if vis != "public" && vis != "assigned" {
		return nil, fmt.Errorf("%w: visibility 无效", ErrHealthEducationValidation)
	}
	targets := req.TargetUserIDs
	if vis == "assigned" {
		if len(targets) == 0 {
			return nil, fmt.Errorf("%w: 指派范围至少选择一名服务用户", ErrHealthEducationValidation)
		}
		if err := s.assertAllServed(dietitianID, targets); err != nil {
			return nil, err
		}
		row.TargetUserIDs = s.marshalTargets(targets)
	} else {
		row.TargetUserIDs = "[]"
	}
	row.Visibility = vis
	if strings.TrimSpace(row.Title) == "" {
		return nil, fmt.Errorf("%w: 发布前请填写标题", ErrHealthEducationValidation)
	}
	if strings.TrimSpace(row.Body) == "" {
		return nil, fmt.Errorf("%w: 发布前请填写正文", ErrHealthEducationValidation)
	}
	row.ContentStatus = "published"
	row.AuditStatus = "approved"
	row.UpdatedAt = time.Now()
	if err := s.db.Save(row).Error; err != nil {
		return nil, err
	}
	return row, nil
}

// List 规划师自己的列表
func (s *HealthEducationService) List(dietitianID string, q schemas.HealthEducationListQuery) ([]schemas.HealthEducationResponse, error) {
	dietitianID = strings.TrimSpace(dietitianID)
	tx := s.db.Model(&models.HealthEducation{}).Where("dietitian_id = ?", dietitianID).Order("updated_at DESC")
	cs := strings.TrimSpace(strings.ToLower(q.ContentStatus))
	if cs == "draft" || cs == "published" {
		tx = tx.Where("content_status = ?", cs)
	}
	v := strings.TrimSpace(strings.ToLower(q.Visibility))
	if v == "public" || v == "assigned" {
		tx = tx.Where("visibility = ?", v)
	}
	var rows []models.HealthEducation
	if err := tx.Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]schemas.HealthEducationResponse, 0, len(rows))
	for i := range rows {
		out = append(out, s.toResponse(&rows[i], false))
	}
	return out, nil
}

// Get 详情（含正文）
func (s *HealthEducationService) Get(dietitianID, heID string) (schemas.HealthEducationResponse, error) {
	row, err := s.getOwned(dietitianID, heID)
	if err != nil {
		return schemas.HealthEducationResponse{}, err
	}
	return s.toResponse(row, true), nil
}

func (s *HealthEducationService) listPublishedAssignedForUser(userID string) ([]models.HealthEducation, error) {
	userID = strings.TrimSpace(userID)
	var assigned []models.HealthEducation
	if err := s.db.Where("content_status = ? AND visibility = ?", "published", "assigned").Order("updated_at DESC").Find(&assigned).Error; err != nil {
		return nil, err
	}
	var out []models.HealthEducation
	for _, r := range assigned {
		for _, id := range parseTargetsJSON(r.TargetUserIDs) {
			if id == userID {
				out = append(out, r)
				break
			}
		}
	}
	return out, nil
}

// ListForReader 用户端：已发布且（公开 或 指派含本人）
func (s *HealthEducationService) ListForReader(userID string, q schemas.HealthEducationReaderQuery) ([]schemas.HealthEducationResponse, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, ErrHealthEducationValidation
	}
	vis := strings.ToLower(strings.TrimSpace(q.Visibility))
	if vis != "public" && vis != "assigned" && vis != "all" {
		vis = "all"
	}

	var public []models.HealthEducation
	if vis == "all" || vis == "public" {
		if err := s.db.Where("content_status = ? AND visibility = ?", "published", "public").Order("updated_at DESC").Find(&public).Error; err != nil {
			return nil, err
		}
	}

	var assignedUser []models.HealthEducation
	if vis == "all" || vis == "assigned" {
		var err error
		assignedUser, err = s.listPublishedAssignedForUser(userID)
		if err != nil {
			return nil, err
		}
	}

	var rows []models.HealthEducation
	switch vis {
	case "public":
		rows = public
	case "assigned":
		rows = assignedUser
	default:
		byID := make(map[string]models.HealthEducation)
		for _, r := range public {
			byID[r.HEID] = r
		}
		for _, r := range assignedUser {
			byID[r.HEID] = r
		}
		for _, r := range byID {
			rows = append(rows, r)
		}
		sort.Slice(rows, func(i, j int) bool {
			return rows[i].UpdatedAt.After(rows[j].UpdatedAt)
		})
	}

	out := make([]schemas.HealthEducationResponse, 0, len(rows))
	for i := range rows {
		out = append(out, s.toResponseForReader(&rows[i], false))
	}
	return out, nil
}

func (s *HealthEducationService) userCanReadPublished(row *models.HealthEducation, userID string) bool {
	userID = strings.TrimSpace(userID)
	if row.ContentStatus != "published" {
		return false
	}
	if row.Visibility == "public" {
		return true
	}
	if row.Visibility != "assigned" {
		return false
	}
	for _, id := range parseTargetsJSON(row.TargetUserIDs) {
		if id == userID {
			return true
		}
	}
	return false
}

// GetForReader 用户端详情
func (s *HealthEducationService) GetForReader(userID, heID string) (schemas.HealthEducationResponse, error) {
	userID = strings.TrimSpace(userID)
	var row models.HealthEducation
	if err := s.db.Where("he_id = ?", heID).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return schemas.HealthEducationResponse{}, ErrHealthEducationNotFound
		}
		return schemas.HealthEducationResponse{}, err
	}
	if !s.userCanReadPublished(&row, userID) {
		return schemas.HealthEducationResponse{}, ErrHealthEducationForbidden
	}
	return s.toResponseForReader(&row, true), nil
}
