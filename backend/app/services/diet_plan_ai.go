package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"
)

type aiPlanOutput struct {
	Days []aiPlanDay `json:"days"`
}

type aiPlanDay struct {
	DayIndex int          `json:"day_index"`
	Meals    []aiPlanMeal `json:"meals"`
}

type aiPlanMeal struct {
	Type  string       `json:"type"`
	Time  string       `json:"time"`
	Foods []aiPlanFood `json:"foods"`
}

type aiPlanFood struct {
	Name     string  `json:"name"`
	Amount   string  `json:"amount"`
	Calories int     `json:"calories"`
	Protein  float64 `json:"protein"`
	Carb     float64 `json:"carbohydrate"`
	Fat      float64 `json:"fat"`
}

type aiOptimizeLLMResult struct {
	OptimizationSummary string      `json:"optimization_summary"`
	Days                []aiPlanDay `json:"days"`
}

// UnmarshalJSON 兼容不同模型的字段命名，避免因键名差异导致营养素被解析为 0。
func (f *aiPlanFood) UnmarshalJSON(data []byte) error {
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	f.Name = readStringAlias(raw, "name", "food_name", "food")
	f.Amount = readStringAlias(raw, "amount", "portion", "serving", "serving_size")
	f.Calories = int(math.Round(readFloatAlias(raw, "calories", "kcal", "energy", "energy_kcal")))
	f.Protein = readFloatAlias(raw, "protein", "protein_g", "proteins")
	f.Carb = readFloatAlias(raw, "carbohydrate", "carb", "carbs", "carbohydrates", "carbohydrate_g")
	f.Fat = readFloatAlias(raw, "fat", "fat_g", "lipid", "lipids")
	return nil
}

type chatCompletionsRequest struct {
	Model       string              `json:"model"`
	Messages    []map[string]string `json:"messages"`
	Temperature float64             `json:"temperature,omitempty"`
	MaxTokens   *int                `json:"max_tokens,omitempty"`
}

type chatCompletionsResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (s *DietPlanService) buildAIDraft(targetUserID string, req schemas.AIDietPlanGenerateRequest) (schemas.AIDietPlanDraftResponse, error) {
	if strings.TrimSpace(targetUserID) == "" {
		return schemas.AIDietPlanDraftResponse{}, errors.New("用户ID不能为空")
	}

	cycleDays := req.CycleDays
	if cycleDays <= 0 {
		cycleDays = 7
	}
	if cycleDays > 30 {
		cycleDays = 30
	}

	target := s.estimateNutritionTarget(targetUserID, req.ActivityLevel)
	goal := strings.TrimSpace(req.DietGoal)
	if goal == "other" {
		goal = strings.TrimSpace(req.OtherGoal)
	}
	if goal == "" {
		goal = s.resolveUserGoalSnapshot(targetUserID)
	}
	if goal == "" {
		goal = "智能匹配"
	}

	generationSource := "llm"
	aiResp, err := s.callDietPlanLLM(targetUserID, cycleDays, goal, target, req.HealthProfile, req.AdditionalRequirements)
	if err != nil {
		log.Printf("buildAIDraft: llm call failed, fallback enabled: %v", err)
		aiResp = s.buildFallbackAIOutput(cycleDays)
		generationSource = "fallback"
	}

	planDays := s.toCreatePlanDays(aiResp, cycleDays, target)
	if len(planDays) == 0 {
		return schemas.AIDietPlanDraftResponse{}, errors.New("智能推荐结果为空")
	}

	planTitle := strings.TrimSpace(req.PlanTitle)
	if planTitle == "" {
		planTitle = "智能推荐膳食计划"
	}

	return schemas.AIDietPlanDraftResponse{
		UserID:           targetUserID,
		PlanTitle:        planTitle,
		CycleDays:        cycleDays,
		DietGoal:         goal,
		GenerationSource: generationSource,
		PlanDays:         planDays,
	}, nil
}

// GenerateAIDietPlanDraft 规划师端：仅生成初稿，不落库
func (s *DietPlanService) GenerateAIDietPlanDraft(targetUserID string, req schemas.AIDietPlanGenerateRequest) (schemas.AIDietPlanDraftResponse, error) {
	return s.buildAIDraft(targetUserID, req)
}

// GenerateAIDietPlan 调用大模型生成膳食计划并直接发布
func (s *DietPlanService) GenerateAIDietPlan(userID string, req schemas.AIDietPlanGenerateRequest) (schemas.DietPlanDetail, string, error) {
	draft, err := s.buildAIDraft(userID, req)
	if err != nil {
		return schemas.DietPlanDetail{}, "", err
	}

	createReq := schemas.DietPlanCreate{
		UserID:      userID,
		DietitianID: config.GetEnv("AI_DIETITIAN_ID", "D20260325001"),
		PlanTitle:   draft.PlanTitle,
		Source:      "ai",
		DietGoal:    draft.DietGoal,
		CycleDays:   draft.CycleDays,
		PlanDays:    draft.PlanDays,
	}

	created, err := s.CreateDietPlan(createReq)
	if err != nil {
		return schemas.DietPlanDetail{}, "", err
	}

	if _, err := s.PublishDietPlan(created.PlanID, userID, ""); err != nil {
		return schemas.DietPlanDetail{}, "", err
	}

	detail, err := s.GetDietPlanDetail(created.PlanID, userID)
	if err != nil {
		return schemas.DietPlanDetail{}, "", err
	}
	detail.GenerationSource = draft.GenerationSource
	return detail, draft.GenerationSource, nil
}

func (s *DietPlanService) resolveUserGoalSnapshot(userID string) string {
	var sr models.ServiceRequest
	err := config.DB.Where("user_id = ? AND status IN ?", userID, []string{"approved", "pending"}).
		Order("update_time DESC").
		First(&sr).Error
	if err != nil {
		return ""
	}
	return strings.TrimSpace(formatSnapshotDietGoal(&sr))
}

func (s *DietPlanService) estimateNutritionTarget(userID, activityLevel string) schemas.NutritionTarget {
	target := schemas.NutritionTarget{
		Calories:     1800,
		Protein:      90,
		Carbohydrate: 225,
		Fat:          55,
	}

	var hd models.HealthData
	if err := config.DB.Where("user_id = ?", userID).Order("updated_at DESC").First(&hd).Error; err != nil {
		return target
	}
	if hd.Height <= 0 || hd.Weight <= 0 || hd.Age <= 0 {
		return target
	}

	activityFactor := 1.55
	switch strings.TrimSpace(activityLevel) {
	case "sedentary":
		activityFactor = 1.2
	case "lightly_active":
		activityFactor = 1.375
	case "very_active":
		activityFactor = 1.725
	}

	var bmr float64
	if hd.Gender == "male" {
		bmr = 10*hd.Weight + 6.25*hd.Height - 5*float64(hd.Age) + 5
	} else {
		bmr = 10*hd.Weight + 6.25*hd.Height - 5*float64(hd.Age) - 161
	}
	if bmr <= 0 {
		return target
	}

	totalCalories := bmr * activityFactor
	target.Calories = round1(totalCalories)
	target.Protein = round1(totalCalories * 0.2 / 4)
	target.Fat = round1(totalCalories * 0.25 / 9)
	target.Carbohydrate = round1(totalCalories * 0.55 / 4)
	return target
}

func (s *DietPlanService) callDietPlanLLM(userID string, cycleDays int, goal string, target schemas.NutritionTarget, healthProfile, extra string) (aiPlanOutput, error) {
	baseURL := strings.TrimSpace(config.GetEnv("LLM_BASE_URL", ""))
	apiKey := strings.TrimSpace(config.GetEnv("LLM_API_KEY", ""))
	model := strings.TrimSpace(config.GetEnv("LLM_MODEL", ""))
	if baseURL == "" || apiKey == "" || model == "" {
		return aiPlanOutput{}, errors.New("LLM配置不完整，请设置 LLM_BASE_URL、LLM_API_KEY、LLM_MODEL")
	}

	var hd models.HealthData
	_ = config.DB.Where("user_id = ?", userID).Order("updated_at DESC").First(&hd).Error

	var ingredients []models.Ingredient
	_ = config.DB.Where("status = ?", "enabled").Limit(40).Find(&ingredients).Error
	ingredientNames := make([]string, 0, len(ingredients))
	for _, ing := range ingredients {
		n := strings.TrimSpace(ing.Name)
		if n != "" {
			ingredientNames = append(ingredientNames, n)
		}
	}

	userPrompt := fmt.Sprintf(
		"请为用户生成%d天中文膳食计划。用户信息：gender=%s, age=%d, height=%.1f, weight=%.1f, allergy=%s, goal=%s。健康补充信息：%s。目标每日营养：calories=%.1f, protein=%.1f, carbohydrate=%.1f, fat=%.1f。可优先食材：%s。额外要求：%s。"+
			"请只输出JSON，结构为 {\"days\":[{\"day_index\":1,\"meals\":[{\"type\":\"早餐\",\"time\":\"07:30\",\"foods\":[{\"name\":\"鸡蛋\",\"amount\":\"1个\",\"calories\":70,\"protein\":6.3,\"carbohydrate\":0.6,\"fat\":5.0}]}]}]}。"+
			"每天至少包含早餐、午餐、晚餐，可选加餐；foods 至少2项。每个 food 必须返回 calories、protein、carbohydrate、fat。",
		cycleDays, hd.Gender, hd.Age, hd.Height, hd.Weight, strings.TrimSpace(hd.AllergyHistory), goal,
		strings.TrimSpace(healthProfile),
		target.Calories, target.Protein, target.Carbohydrate, target.Fat,
		strings.Join(ingredientNames, "、"),
		strings.TrimSpace(extra),
	)
	compactPrompt := fmt.Sprintf(
		"生成%d天中文膳食计划，只输出JSON，结构：{\"days\":[{\"day_index\":1,\"meals\":[{\"type\":\"早餐\",\"time\":\"07:30\",\"foods\":[{\"name\":\"鸡蛋\",\"amount\":\"1个\",\"calories\":70,\"protein\":6.3,\"carbohydrate\":0.6,\"fat\":5.0}]}]}]}。"+
			"用户：gender=%s, age=%d, height=%.1f, weight=%.1f, allergy=%s, goal=%s, health_profile=%s。目标营养：calories=%.1f, protein=%.1f, carbohydrate=%.1f, fat=%.1f。每个 food 必须返回 calories、protein、carbohydrate、fat。",
		cycleDays, hd.Gender, hd.Age, hd.Height, hd.Weight, strings.TrimSpace(hd.AllergyHistory), goal,
		strings.TrimSpace(healthProfile),
		target.Calories, target.Protein, target.Carbohydrate, target.Fat,
	)

	timeout := llmTimeoutFromEnv()
	content, err := s.requestLLMContent(baseURL, apiKey, model, userPrompt, timeout)
	if err != nil {
		// DashScope 有时首包较慢；超时时降载重试一次。
		if isTimeoutErr(err) {
			log.Printf("callDietPlanLLM: first attempt timeout (%v), retrying with compact prompt", timeout)
			content, err = s.requestLLMContent(baseURL, apiKey, model, compactPrompt, timeout+30*time.Second)
		}
		if err != nil {
			return aiPlanOutput{}, err
		}
	}

	jsonText := extractJSONObject(content)
	if jsonText == "" {
		return aiPlanOutput{}, errors.New("LLM结果不是有效JSON")
	}

	var out aiPlanOutput
	if err := json.Unmarshal([]byte(jsonText), &out); err != nil {
		return aiPlanOutput{}, err
	}
	return out, nil
}

func (s *DietPlanService) requestLLMContent(baseURL, apiKey, model, prompt string, timeout time.Duration) (string, error) {
	return s.requestLLMContentOpts(baseURL, apiKey, model, prompt, timeout, 0.5, 0, "", "你是资深临床营养师，请输出严格可解析的JSON，不要包含markdown代码块。")
}

// requestLLMContentOpts 温度、max_out_tokens、优先模型、系统提示可配；maxOut<=0 不传 max_tokens
func (s *DietPlanService) requestLLMContentOpts(baseURL, apiKey, model, prompt string, timeout time.Duration, temperature float64, maxOut int, modelOverride, systemPrompt string) (string, error) {
	if temperature <= 0 {
		temperature = 0.5
	}
	if strings.TrimSpace(systemPrompt) == "" {
		systemPrompt = "你是资深临床营养师，请输出严格可解析的JSON，不要包含markdown代码块。"
	}
	m := strings.TrimSpace(modelOverride)
	if m == "" {
		m = model
	}
	var maxPtr *int
	if maxOut > 0 {
		v := maxOut
		maxPtr = &v
	}
	reqBody := chatCompletionsRequest{
		Model: m,
		Messages: []map[string]string{
			{
				"role":    "system",
				"content": systemPrompt,
			},
			{
				"role":    "user",
				"content": prompt,
			},
		},
		Temperature: temperature,
		MaxTokens:   maxPtr,
	}
	bodyBytes, _ := json.Marshal(reqBody)
	httpReq, err := http.NewRequest(http.MethodPost, strings.TrimRight(baseURL, "/")+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	// DashScope 兼容模式推荐显式开启兼容头
	httpReq.Header.Set("X-DashScope-DataInspection", "disable")

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("LLM请求失败（请检查网络/URL/API Key/模型名）: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("LLM接口调用失败: status=%d body=%s", resp.StatusCode, string(respBody))
	}

	var chatResp chatCompletionsResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", err
	}
	if len(chatResp.Choices) == 0 {
		return "", errors.New("LLM返回为空")
	}
	return strings.TrimSpace(chatResp.Choices[0].Message.Content), nil
}

func llmTimeoutFromEnv() time.Duration {
	// 默认 90 秒，避免大模型首包较慢导致误降级。
	s := strings.TrimSpace(config.GetEnv("LLM_TIMEOUT_SECONDS", "90"))
	v, err := strconv.Atoi(s)
	if err != nil || v <= 0 {
		v = 90
	}
	if v > 300 {
		v = 300
	}
	return time.Duration(v) * time.Second
}

// llmTimeoutOptimizeFromEnv 智能优化输入更长，默认可略放宽首包时间（仍受 HTTP 总超时限制）
func llmTimeoutOptimizeFromEnv() time.Duration {
	s := strings.TrimSpace(config.GetEnv("LLM_OPTIMIZE_TIMEOUT_SECONDS", ""))
	if s == "" {
		return llmTimeoutFromEnv()
	}
	v, err := strconv.Atoi(s)
	if err != nil || v <= 0 {
		return llmTimeoutFromEnv()
	}
	if v > 300 {
		v = 300
	}
	return time.Duration(v) * time.Second
}

func intFromEnvDefault(key string, def int) int {
	s := strings.TrimSpace(config.GetEnv(key, ""))
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}

func floatFromEnvDefault(key string, def float64) float64 {
	s := strings.TrimSpace(config.GetEnv(key, ""))
	if s == "" {
		return def
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return def
	}
	return v
}

func isTimeoutErr(err error) bool {
	if err == nil {
		return false
	}
	e := strings.ToLower(err.Error())
	if strings.Contains(e, "context deadline exceeded") || strings.Contains(e, "timeout") {
		return true
	}
	if ue, ok := err.(*url.Error); ok {
		if ue.Timeout() {
			return true
		}
	}
	return false
}

func (s *DietPlanService) toCreatePlanDays(out aiPlanOutput, cycleDays int, target schemas.NutritionTarget) []schemas.PlanDayCreate {
	now := time.Now()
	result := make([]schemas.PlanDayCreate, 0, cycleDays)

	for i := 0; i < cycleDays; i++ {
		date := now.AddDate(0, 0, i).Format("2006-01-02")
		var src aiPlanDay
		if i < len(out.Days) {
			src = out.Days[i]
		}
		meals := normalizeMeals(src.Meals)
		if len(meals) == 0 {
			meals = defaultMeals()
		}

		mealCreates := make([]schemas.MealCreate, 0, len(meals))
		for _, meal := range meals {
			foods := make([]schemas.FoodCreate, 0, len(meal.Foods))
			for _, food := range meal.Foods {
				name := strings.TrimSpace(food.Name)
				if name == "" {
					continue
				}
				amount := strings.TrimSpace(food.Amount)
				if amount == "" {
					amount = "100g"
				}
				p := nonNegativeFloat(food.Protein)
				c := nonNegativeFloat(food.Carb)
				fv := nonNegativeFloat(food.Fat)
				cal := food.Calories
				// 当模型漏传 calories 时，用三大营养素反推热量。
				if cal <= 0 && (p > 0 || c > 0 || fv > 0) {
					cal = int(math.Round(p*4 + c*4 + fv*9))
				}
				if cal <= 0 {
					cal = 80
				}
				// 当模型只给了热量但漏传三大营养素时，给一个温和兜底，避免未知食材最终落库为 0。
				if p <= 0 && c <= 0 && fv <= 0 && cal > 0 {
					p = round1((float64(cal) * 0.2) / 4)
					c = round1((float64(cal) * 0.55) / 4)
					fv = round1((float64(cal) * 0.25) / 9)
				}
				foods = append(foods, schemas.FoodCreate{
					Name:         name,
					Amount:       amount,
					Calories:     cal,
					Protein:      p,
					Carbohydrate: c,
					Fat:          fv,
				})
			}
			if len(foods) == 0 {
				continue
			}
			mealCreates = append(mealCreates, schemas.MealCreate{
				Type:         meal.Type,
				Time:         meal.Time,
				Calories:     sumFoodCalories(foods),
				Protein:      0,
				Carbohydrate: 0,
				Fat:          0,
				Foods:        foods,
			})
		}
		if len(mealCreates) == 0 {
			continue
		}

		result = append(result, schemas.PlanDayCreate{
			DayIndex:     i + 1,
			PlanDate:     date,
			Calories:     int(math.Round(target.Calories)),
			Protein:      target.Protein,
			Carbohydrate: target.Carbohydrate,
			Fat:          target.Fat,
			Meals:        mealCreates,
		})
	}
	return result
}

func readStringAlias(m map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if v, ok := m[key]; ok {
			switch t := v.(type) {
			case string:
				return strings.TrimSpace(t)
			case json.Number:
				return strings.TrimSpace(t.String())
			}
		}
	}
	return ""
}

func readFloatAlias(m map[string]interface{}, keys ...string) float64 {
	for _, key := range keys {
		v, ok := m[key]
		if !ok {
			continue
		}
		switch t := v.(type) {
		case float64:
			return t
		case float32:
			return float64(t)
		case int:
			return float64(t)
		case int64:
			return float64(t)
		case json.Number:
			f, err := t.Float64()
			if err == nil {
				return f
			}
		case string:
			s := strings.TrimSpace(t)
			if s == "" {
				continue
			}
			f, err := strconv.ParseFloat(s, 64)
			if err == nil {
				return f
			}
		}
	}
	return 0
}

func normalizeMeals(in []aiPlanMeal) []aiPlanMeal {
	out := make([]aiPlanMeal, 0, len(in))
	for _, m := range in {
		mt := strings.TrimSpace(m.Type)
		if mt == "" {
			continue
		}
		tm := strings.TrimSpace(m.Time)
		if tm == "" {
			tm = defaultMealTime(mt)
		}
		out = append(out, aiPlanMeal{
			Type:  mt,
			Time:  tm,
			Foods: m.Foods,
		})
	}
	return out
}

func defaultMeals() []aiPlanMeal {
	return []aiPlanMeal{
		{
			Type: "早餐",
			Time: "07:30",
			Foods: []aiPlanFood{
				{Name: "鸡蛋", Amount: "1个", Calories: 70},
				{Name: "牛奶", Amount: "250ml", Calories: 120},
			},
		},
		{
			Type: "午餐",
			Time: "12:00",
			Foods: []aiPlanFood{
				{Name: "米饭", Amount: "150g", Calories: 175},
				{Name: "鸡胸肉", Amount: "120g", Calories: 190},
			},
		},
		{
			Type: "晚餐",
			Time: "18:00",
			Foods: []aiPlanFood{
				{Name: "红薯", Amount: "150g", Calories: 130},
				{Name: "西兰花", Amount: "150g", Calories: 50},
			},
		},
	}
}

func defaultMealTime(mealType string) string {
	switch mealType {
	case "早餐":
		return "07:30"
	case "午餐":
		return "12:00"
	case "晚餐":
		return "18:00"
	case "加餐":
		return "15:00"
	default:
		return "12:00"
	}
}

func sumFoodCalories(foods []schemas.FoodCreate) int {
	total := 0
	for _, f := range foods {
		total += f.Calories
	}
	return total
}

func extractJSONObject(s string) string {
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start == -1 || end == -1 || end < start {
		return ""
	}
	return s[start : end+1]
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}

func nonNegativeFloat(v float64) float64 {
	if v < 0 {
		return 0
	}
	return v
}

func (s *DietPlanService) buildFallbackAIOutput(cycleDays int) aiPlanOutput {
	out := aiPlanOutput{
		Days: make([]aiPlanDay, 0, cycleDays),
	}
	dayTemplates := [][][]aiPlanFood{
		{
			{{Name: "鸡蛋", Amount: "1个", Calories: 70}, {Name: "牛奶", Amount: "250ml", Calories: 120}, {Name: "全麦面包", Amount: "2片", Calories: 140}},
			{{Name: "米饭", Amount: "150g", Calories: 175, Protein: 3.9, Carb: 38.4, Fat: 0.5}, {Name: "鸡胸肉", Amount: "120g", Calories: 190, Protein: 37.2, Carb: 0, Fat: 4.3}, {Name: "西兰花", Amount: "150g", Calories: 50, Protein: 4.2, Carb: 10.5, Fat: 0.6}},
			{{Name: "红薯", Amount: "150g", Calories: 130, Protein: 2.4, Carb: 30.2, Fat: 0.2}, {Name: "鱼肉", Amount: "120g", Calories: 145, Protein: 25.0, Carb: 0, Fat: 4.6}, {Name: "黄瓜", Amount: "120g", Calories: 20, Protein: 0.8, Carb: 3.6, Fat: 0.2}},
			{{Name: "苹果", Amount: "1个", Calories: 90, Protein: 0.4, Carb: 23.0, Fat: 0.3}, {Name: "坚果", Amount: "10g", Calories: 60, Protein: 1.8, Carb: 2.0, Fat: 5.2}},
		},
		{
			{{Name: "燕麦", Amount: "50g", Calories: 190, Protein: 6.6, Carb: 33.0, Fat: 3.4}, {Name: "酸奶", Amount: "150g", Calories: 110, Protein: 5.4, Carb: 12.0, Fat: 3.8}, {Name: "香蕉", Amount: "1根", Calories: 95, Protein: 1.2, Carb: 23.0, Fat: 0.3}},
			{{Name: "荞麦面", Amount: "180g", Calories: 260, Protein: 9.5, Carb: 52.0, Fat: 1.5}, {Name: "虾仁", Amount: "120g", Calories: 120, Protein: 25.0, Carb: 0.4, Fat: 1.0}, {Name: "菠菜", Amount: "150g", Calories: 35, Protein: 4.3, Carb: 5.4, Fat: 0.6}},
			{{Name: "玉米", Amount: "1根", Calories: 120, Protein: 4.2, Carb: 26.0, Fat: 1.5}, {Name: "牛肉", Amount: "100g", Calories: 155, Protein: 20.0, Carb: 0.2, Fat: 8.0}, {Name: "番茄", Amount: "150g", Calories: 30, Protein: 1.4, Carb: 6.0, Fat: 0.3}},
			{{Name: "橙子", Amount: "1个", Calories: 80, Protein: 1.1, Carb: 18.0, Fat: 0.2}, {Name: "无糖酸奶", Amount: "100g", Calories: 70, Protein: 3.5, Carb: 6.0, Fat: 2.6}},
		},
	}
	for i := 0; i < cycleDays; i++ {
		tpl := dayTemplates[i%len(dayTemplates)]
		out.Days = append(out.Days, aiPlanDay{
			DayIndex: i + 1,
			Meals: []aiPlanMeal{
				{Type: "早餐", Time: "07:30", Foods: tpl[0]},
				{Type: "午餐", Time: "12:00", Foods: tpl[1]},
				{Type: "晚餐", Time: "18:00", Foods: tpl[2]},
				{Type: "加餐", Time: "15:00", Foods: tpl[3]},
			},
		})
	}
	return out
}

// GenerateOptimizeAIDraft 根据当前计划 + 身体变化 + 用户反馈生成优化草案（不落库，需规划师审阅后保存）
func (s *DietPlanService) GenerateOptimizeAIDraft(dietitianID, planID string, req schemas.AIDietPlanOptimizeRequest) (schemas.AIDietPlanOptimizeDraftResponse, error) {
	out := schemas.AIDietPlanOptimizeDraftResponse{ContextUsed: map[string]interface{}{}}
	userID := strings.TrimSpace(req.UserID)
	if userID == "" {
		return out, errors.New("用户ID不能为空")
	}
	if _, err := s.getPlanForDietitianContext(planID, userID, dietitianID); err != nil {
		return out, err
	}

	detail, err := s.GetDietPlanDetail(planID, userID)
	if err != nil {
		return out, err
	}

	cycleDays := detail.CycleDays
	if cycleDays <= 0 {
		cycleDays = len(detail.PlanDays)
	}
	if cycleDays <= 0 {
		cycleDays = 7
	}

	hs := NewHealthDataService()
	var changeJSON []byte
	chg, errChg := hs.GetHealthDataChangeSummary(userID)
	if errChg == nil {
		changeJSON, _ = json.Marshal(chg)
	} else {
		changeJSON, _ = json.Marshal(map[string]string{"error": errChg.Error()})
	}

	fbSvc := NewFeedbackService()
	feedLines, _ := fbSvc.TextLinesForDietPlanOptimize(dietitianID, userID, planID, req.FeedbackIDs)

	var hd models.HealthData
	_ = config.DB.Where("user_id = ?", userID).Order("updated_at DESC").First(&hd).Error
	activity := strings.TrimSpace(hd.ActivityLevel)
	if activity == "" {
		activity = "moderately_active"
	}
	target := s.estimateNutritionTarget(userID, activity)

	// 控制输入体积可明显缩短首包/总耗时；可在 .env 调 LLM_OPTIMIZE_PLAN_JSON_BYTES
	planJSONBudget := intFromEnvDefault("LLM_OPTIMIZE_PLAN_JSON_BYTES", 8000)
	compact := compactDietPlanForLLMMax(detail, planJSONBudget)
	plannerNote := strings.TrimSpace(req.PlannerNote)

	generationSource := "llm"
	aiRes, lerr := s.callDietPlanOptimizeLLM(cycleDays, target, string(changeJSON), compact, feedLines, plannerNote, hd, detail.DietGoal)
	if lerr != nil {
		log.Printf("GenerateOptimizeAIDraft: llm failed, fallback: %v", lerr)
		aiRes.OptimizationSummary = "智能服务暂不可用，已按均衡营养规则生成建议草案，请结合用户身体数据与反馈人工审阅后调整。"
		aiRes.Days = s.buildFallbackAIOutput(cycleDays).Days
		generationSource = "fallback"
	}
	summary := strings.TrimSpace(aiRes.OptimizationSummary)
	if summary == "" {
		summary = "已根据身体变化、反馈与当前计划生成一版调整草案，请审阅各日配餐与营养素后再保存。"
	}

	planDays := s.toCreatePlanDaysFromAIOptimize(aiPlanOutput{Days: aiRes.Days}, detail, target, cycleDays)
	if len(planDays) == 0 {
		return out, errors.New("智能优化结果为空")
	}

	goal := strings.TrimSpace(detail.DietGoal)
	if goal == "" {
		goal = s.resolveUserGoalSnapshot(userID)
	}
	if goal == "" {
		goal = "智能优化"
	}

	insuff := false
	if errChg == nil {
		if v, ok := chg["insufficient_sample"].(bool); ok {
			insuff = v
		}
	}
	out = schemas.AIDietPlanOptimizeDraftResponse{
		PlanID:              planID,
		UserID:              userID,
		PlanTitle:           detail.PlanTitle,
		CycleDays:           cycleDays,
		DietGoal:            goal,
		OptimizationSummary: summary,
		GenerationSource:    generationSource,
		PlanDays:            planDays,
		ContextUsed: map[string]interface{}{
			"change_summary":       string(changeJSON),
			"feedback_count":     len(feedLines),
			"planner_note_length":  len([]rune(plannerNote)),
			"insufficient_sample": insuff,
		},
	}
	return out, nil
}

func compactDietPlanForLLM(d schemas.DietPlanDetail) string {
	return compactDietPlanForLLMMax(d, 12000)
}

func compactDietPlanForLLMMax(d schemas.DietPlanDetail, maxBytes int) string {
	type cf struct {
		Name   string `json:"name"`
		Amount string `json:"amount"`
	}
	type cm struct {
		Type  string `json:"type"`
		Time  string `json:"time"`
		Foods []cf   `json:"foods"`
	}
	type cd struct {
		DayIndex int    `json:"day_index"`
		Date     string `json:"date"`
		Meals    []cm   `json:"meals"`
	}
	compact := make([]cd, 0, len(d.PlanDays))
	for _, day := range d.PlanDays {
		meals := make([]cm, 0, len(day.Meals))
		for _, m := range day.Meals {
			foods := make([]cf, 0, len(m.Foods))
			for _, f := range m.Foods {
				foods = append(foods, cf{Name: strings.TrimSpace(f.Name), Amount: strings.TrimSpace(f.Amount)})
			}
			meals = append(meals, cm{Type: strings.TrimSpace(m.Type), Time: strings.TrimSpace(m.Time), Foods: foods})
		}
		compact = append(compact, cd{
			DayIndex: day.DayIndex,
			Date:     strings.TrimSpace(day.PlanDate),
			Meals:    meals,
		})
	}
	b, _ := json.Marshal(compact)
	if maxBytes <= 0 {
		maxBytes = 12000
	}
	if len(b) > maxBytes {
		return fmt.Sprintf("{\"note\":\"内容过长已截断\",\"title\":%q,\"day_count\":%d}", d.PlanTitle, len(d.PlanDays))
	}
	return string(b)
}

func (s *DietPlanService) callDietPlanOptimizeLLM(
	cycleDays int,
	target schemas.NutritionTarget,
	changeJSON, currentPlanJSON string,
	feedbackLines []string,
	plannerNote string,
	hd models.HealthData,
	planDietGoal string,
) (aiOptimizeLLMResult, error) {
	var zero aiOptimizeLLMResult
	baseURL := strings.TrimSpace(config.GetEnv("LLM_BASE_URL", ""))
	apiKey := strings.TrimSpace(config.GetEnv("LLM_API_KEY", ""))
	model := strings.TrimSpace(config.GetEnv("LLM_MODEL", ""))
	if baseURL == "" || apiKey == "" || model == "" {
		return zero, errors.New("LLM配置不完整，请设置 LLM_BASE_URL、LLM_API_KEY、LLM_MODEL")
	}

	// 输入体积是耗时的主因：主 prompt 与重试均做二次截断，容量可用环境变量调
	plannerNote = strings.TrimSpace(plannerNote)
	inPlan := intFromEnvDefault("LLM_OPTIMIZE_IN_PLAN_BYTES", 6000)
	inChg := intFromEnvDefault("LLM_OPTIMIZE_IN_CHANGE_BYTES", 2000)
	inFb := intFromEnvDefault("LLM_OPTIMIZE_IN_FEEDBACK_BYTES", 2500)
	currentPlanJSON = strings.TrimSpace(currentPlanJSON)
	changeJSON = strings.TrimSpace(changeJSON)
	if inPlan > 0 && len(currentPlanJSON) > inPlan {
		currentPlanJSON = truncateForPrompt(currentPlanJSON, inPlan)
	}
	if inChg > 0 && len(changeJSON) > inChg {
		changeJSON = truncateForPrompt(changeJSON, inChg)
	}
	inNote := intFromEnvDefault("LLM_OPTIMIZE_IN_PLANNER_NOTE_BYTES", 1200)
	if inNote > 0 && len(plannerNote) > inNote {
		plannerNote = truncateForPrompt(plannerNote, inNote)
	}

	fbText := "（无）"
	if len(feedbackLines) > 0 {
		fbText = strings.Join(feedbackLines, "\n")
	}
	if inFb > 0 && len(fbText) > inFb {
		fbText = truncateForPrompt(fbText, inFb)
	}
	if plannerNote == "" {
		plannerNote = "（无）"
	}
	goal := strings.TrimSpace(planDietGoal)
	if goal == "" {
		goal = "（与当前计划一致）"
	}
	// 说明略收紧，减少总 token
	userPrompt := fmt.Sprintf(
		"在「当前膳食计划」上结合【身体数据变化】、【用户反馈】、【规划师说明】做调整。只输出**一个** JSON，含 optimization_summary 与 days，勿 markdown。结构：\n"+
			`{"optimization_summary":"主调整点与注意项","days":[{"day_index":1,"meals":[...]}]}`+"\n"+
			"约束：共 %d 天，day_index=1..%d；各餐含早午晚，可加餐；每 food 含 name, amount, calories, protein, carbohydrate, fat；日热量接近期望 %.0f kcal。过敏：%s。原目标：%s。\n\n"+
			"【身体变化】%s\n\n【当前计划】%s\n\n【用户反馈】\n%s\n\n【规划师说明】%s",
		cycleDays, cycleDays, target.Calories, strings.TrimSpace(hd.AllergyHistory), goal,
		changeJSON, currentPlanJSON, fbText, plannerNote,
	)
	compactPlan := intFromEnvDefault("LLM_OPTIMIZE_COMPACT_PLAN_BYTES", 3200)
	compactChg := intFromEnvDefault("LLM_OPTIMIZE_COMPACT_CHANGE_BYTES", 1500)
	compactPrompt := fmt.Sprintf(
		"仅输出JSON: {\"optimization_summary\":\"...\",\"days\":[]}, %d天, day_index 1..%d, 早午晚+加餐, food 营养素齐全, 日热量~%.0f, 过敏%q。计划:%s 身体:%s。",
		cycleDays, cycleDays, target.Calories, strings.TrimSpace(hd.AllergyHistory),
		truncateForPrompt(currentPlanJSON, compactPlan), truncateForPrompt(changeJSON, compactChg),
	)

	temp := floatFromEnvDefault("LLM_OPTIMIZE_TEMPERATURE", 0.35)
	maxOut := intFromEnvDefault("LLM_OPTIMIZE_MAX_TOKENS", 0)
	optModel := strings.TrimSpace(config.GetEnv("LLM_MODEL_OPTIMIZE", ""))
	sys := strings.TrimSpace(config.GetEnv("LLM_OPTIMIZE_SYSTEM_PROMPT", "你是临床营养师。只输出一个可解析的 JSON 对象，不要 markdown，不要其他文字。"))
	if sys == "" {
		sys = "你是临床营养师。只输出一个可解析的 JSON 对象，不要 markdown，不要其他文字。"
	}

	timeout := llmTimeoutOptimizeFromEnv()
	call := func(p string, t time.Duration) (string, error) {
		return s.requestLLMContentOpts(baseURL, apiKey, model, p, t, temp, maxOut, optModel, sys)
	}
	content, err := call(userPrompt, timeout)
	if err != nil {
		if isTimeoutErr(err) {
			log.Printf("callDietPlanOptimizeLLM: timeout, retry compact")
			extra := intFromEnvDefault("LLM_OPTIMIZE_TIMEOUT_RETRY_EXTRA_SECONDS", 30)
			content, err = call(compactPrompt, timeout+time.Duration(extra)*time.Second)
		}
		if err != nil {
			return zero, err
		}
	}

	jsonText := extractJSONObject(content)
	if jsonText == "" {
		return zero, errors.New("LLM结果不是有效JSON")
	}
	var res aiOptimizeLLMResult
	if err := json.Unmarshal([]byte(jsonText), &res); err != nil {
		return zero, err
	}
	if len(res.Days) == 0 {
		return zero, errors.New("LLM未返回days")
	}
	return res, nil
}

func truncateForPrompt(s string, max int) string {
	s = strings.TrimSpace(s)
	if max <= 0 || len(s) <= max {
		return s
	}
	if max < 3 {
		return s[:max]
	}
	return s[:max-1] + "…"
}

func (s *DietPlanService) toCreatePlanDaysFromAIOptimize(out aiPlanOutput, detail schemas.DietPlanDetail, target schemas.NutritionTarget, cycleDays int) []schemas.PlanDayCreate {
	now := time.Now()
	dates := make([]string, cycleDays)
	for i := 0; i < cycleDays; i++ {
		if i < len(detail.PlanDays) {
			d := strings.TrimSpace(detail.PlanDays[i].PlanDate)
			if d != "" {
				dates[i] = d
				continue
			}
		}
		if len(detail.PlanDays) > 0 {
			if t, err := time.Parse("2006-01-02", strings.TrimSpace(detail.PlanDays[0].PlanDate)); err == nil {
				dates[i] = t.AddDate(0, 0, i).Format("2006-01-02")
				continue
			}
		}
		dates[i] = now.AddDate(0, 0, i).Format("2006-01-02")
	}

	created := s.toCreatePlanDays(out, cycleDays, target)
	for i := range created {
		if i < len(dates) && strings.TrimSpace(dates[i]) != "" {
			created[i].PlanDate = dates[i]
		}
	}
	return created
}
