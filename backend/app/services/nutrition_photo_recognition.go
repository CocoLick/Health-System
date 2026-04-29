package services

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/yourusername/nutrition-system/app/models"
	"github.com/yourusername/nutrition-system/app/schemas"
	"github.com/yourusername/nutrition-system/config"
)

type NutritionPhotoRecognitionService struct{}

func NewNutritionPhotoRecognitionService() *NutritionPhotoRecognitionService {
	return &NutritionPhotoRecognitionService{}
}

type recognizeLLMFood struct {
	Name         string  `json:"name"`
	Confidence   float64 `json:"confidence"`
	Amount       float64 `json:"amount"`
	Unit         string  `json:"unit"`
	GramPerUnit  float64 `json:"gram_per_unit"`
	Calories     float64 `json:"calories"`
	Protein      float64 `json:"protein"`
	Carbohydrate float64 `json:"carbohydrate"`
	Fat          float64 `json:"fat"`
	Fiber        float64 `json:"fiber"`
}

type recognizeLLMOutput struct {
	Foods []recognizeLLMFood `json:"foods"`
}

func (s *NutritionPhotoRecognitionService) Recognize(userID string, req schemas.NutritionPhotoRecognizeRequest) (schemas.NutritionPhotoRecognizeResponse, error) {
	var out schemas.NutritionPhotoRecognizeResponse
	rawB64 := strings.TrimSpace(req.ImageBase64)
	if rawB64 == "" {
		return out, errors.New("图片不能为空")
	}

	cleanB64 := cleanImageBase64(rawB64)
	imgBytes, err := base64.StdEncoding.DecodeString(cleanB64)
	if err != nil {
		return out, errors.New("图片格式错误")
	}
	if len(imgBytes) == 0 {
		return out, errors.New("图片内容为空")
	}
	if len(imgBytes) > 3*1024*1024 {
		return out, errors.New("图片过大，请压缩后重试")
	}

	llmOut, err := s.callVisionLLM(cleanB64, req.MealType)
	if err != nil {
		return out, err
	}
	if len(llmOut.Foods) == 0 {
		return out, errors.New("未识别到食物，请换一张更清晰的图片")
	}

	ingredients := make([]models.Ingredient, 0)
	_ = config.DB.
		Where("status = ? AND (scope = 'public' OR owner_user_id = ?)", "enabled", userID).
		Limit(1000).
		Find(&ingredients).Error

	items := make([]schemas.NutritionPhotoRecognizeItem, 0, len(llmOut.Foods))
	total := schemas.NutritionTotalRequest{}
	for _, f := range llmOut.Foods {
		name := strings.TrimSpace(f.Name)
		if name == "" {
			continue
		}
		amount := f.Amount
		if amount <= 0 {
			amount = 1
		}
		unit := strings.TrimSpace(f.Unit)
		if unit == "" {
			unit = "份"
		}
		gramPerUnit := f.GramPerUnit
		if gramPerUnit <= 0 {
			gramPerUnit = 100
		}
		conf := f.Confidence
		if conf <= 0 {
			conf = 0.6
		}

		item := schemas.NutritionPhotoRecognizeItem{
			Name:        name,
			Confidence:  round1(conf),
			Amount:      round1(amount),
			Unit:        unit,
			GramPerUnit: round1(gramPerUnit),
			Nutrition: schemas.NutritionTotalRequest{
				Calories:     nonNegativeFloat(f.Calories),
				Protein:      nonNegativeFloat(f.Protein),
				Carbohydrate: nonNegativeFloat(f.Carbohydrate),
				Fat:          nonNegativeFloat(f.Fat),
				Fiber:        nonNegativeFloat(f.Fiber),
			},
			Matched: false,
		}

		if ing, ok := matchIngredient(name, ingredients); ok {
			nutri, _ := ing.GetNutritionDetails()
			ratio := (amount * gramPerUnit) / 100
			item.Name = ing.Name
			item.Unit = ing.Unit
			if item.Unit == "" {
				item.Unit = unit
			}
			if ing.GramPerUnit > 0 {
				item.GramPerUnit = round1(ing.GramPerUnit)
			}
			item.Nutrition = schemas.NutritionTotalRequest{
				Calories:     round1(nonNegativeFloat(ing.Calorie100g) * ratio),
				Protein:      round1(nonNegativeFloat(nutri.Protein) * ratio),
				Carbohydrate: round1(nonNegativeFloat(nutri.Carbohydrate) * ratio),
				Fat:          round1(nonNegativeFloat(nutri.Fat) * ratio),
				Fiber:        round1(nonNegativeFloat(nutri.Fiber) * ratio),
			}
			item.Matched = true
		} else {
			item.Nutrition.Calories = round1(item.Nutrition.Calories)
			item.Nutrition.Protein = round1(item.Nutrition.Protein)
			item.Nutrition.Carbohydrate = round1(item.Nutrition.Carbohydrate)
			item.Nutrition.Fat = round1(item.Nutrition.Fat)
			item.Nutrition.Fiber = round1(item.Nutrition.Fiber)
		}

		total.Calories += item.Nutrition.Calories
		total.Protein += item.Nutrition.Protein
		total.Carbohydrate += item.Nutrition.Carbohydrate
		total.Fat += item.Nutrition.Fat
		total.Fiber += item.Nutrition.Fiber
		items = append(items, item)
	}

	if len(items) == 0 {
		return out, errors.New("未识别到有效食物项")
	}

	out.RecognizedFoods = items
	out.PreviewTotalNutrition = schemas.NutritionTotalRequest{
		Calories:     round1(total.Calories),
		Protein:      round1(total.Protein),
		Carbohydrate: round1(total.Carbohydrate),
		Fat:          round1(total.Fat),
		Fiber:        round1(total.Fiber),
	}
	return out, nil
}

func cleanImageBase64(s string) string {
	if idx := strings.Index(s, ","); idx >= 0 && strings.Contains(strings.ToLower(s[:idx]), "base64") {
		return strings.TrimSpace(s[idx+1:])
	}
	return s
}

func (s *NutritionPhotoRecognitionService) callVisionLLM(imageBase64 string, mealType string) (recognizeLLMOutput, error) {
	var out recognizeLLMOutput
	baseURL := strings.TrimSpace(config.GetEnv("LLM_BASE_URL", ""))
	apiKey := strings.TrimSpace(config.GetEnv("LLM_API_KEY", ""))
	model := strings.TrimSpace(config.GetEnv("LLM_VISION_MODEL", ""))
	if model == "" {
		model = strings.TrimSpace(config.GetEnv("LLM_MODEL", ""))
	}
	if baseURL == "" || apiKey == "" || model == "" {
		return out, errors.New("拍照识别配置不完整，请先配置LLM参数")
	}

	prompt := fmt.Sprintf(
		"请识别图片中的食物并估算每个食物的分量与营养。餐次=%s。"+
			"请仅输出JSON对象，格式：{\"foods\":[{\"name\":\"米饭\",\"confidence\":0.9,\"amount\":1,\"unit\":\"碗\",\"gram_per_unit\":150,\"calories\":174,\"protein\":3.9,\"carbohydrate\":38.4,\"fat\":0.5,\"fiber\":0.3}]}。"+
			"若有多个食物请全部给出。",
		strings.TrimSpace(mealType),
	)

	body := map[string]interface{}{
		"model": model,
		"messages": []map[string]interface{}{
			{
				"role":    "system",
				"content": "你是营养分析助手。严格输出单个JSON对象，不要markdown，不要额外解释。",
			},
			{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": prompt,
					},
					{
						"type": "image_url",
						"image_url": map[string]string{
							"url": "data:image/jpeg;base64," + imageBase64,
						},
					},
				},
			},
		},
		"temperature": 0.2,
	}

	payload, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPost, strings.TrimRight(baseURL, "/")+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return out, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 80 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return out, errors.New("拍照识别请求失败，请稍后再试")
	}
	defer resp.Body.Close()
	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return out, errors.New("拍照识别服务暂不可用")
	}

	var llmResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(bodyBytes, &llmResp); err != nil {
		return out, errors.New("拍照识别响应解析失败")
	}
	if len(llmResp.Choices) == 0 {
		return out, errors.New("拍照识别结果为空")
	}

	jsonText := extractJSONObject(strings.TrimSpace(llmResp.Choices[0].Message.Content))
	if jsonText == "" {
		return out, errors.New("拍照识别结果格式无效")
	}
	if err := json.Unmarshal([]byte(jsonText), &out); err != nil {
		return out, errors.New("拍照识别结果解析失败")
	}
	return out, nil
}

func matchIngredient(name string, list []models.Ingredient) (models.Ingredient, bool) {
	n := strings.TrimSpace(name)
	if n == "" {
		return models.Ingredient{}, false
	}
	for _, ing := range list {
		if strings.EqualFold(strings.TrimSpace(ing.Name), n) {
			return ing, true
		}
	}
	for _, ing := range list {
		in := strings.TrimSpace(ing.Name)
		if strings.Contains(in, n) || strings.Contains(n, in) {
			return ing, true
		}
	}
	return models.Ingredient{}, false
}
