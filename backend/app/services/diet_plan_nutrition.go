package services

import (
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/yourusername/nutrition-system/app/models"
	"gorm.io/gorm"
)

var amountLeadingNumberRe = regexp.MustCompile(`^\s*([0-9]+(?:\.[0-9]+)?)\s*(.*)$`)

func indexIngredientsByName(list []models.Ingredient) map[string]*models.Ingredient {
	m := make(map[string]*models.Ingredient)
	for i := range list {
		k := strings.ToLower(strings.TrimSpace(list[i].Name))
		if k == "" {
			continue
		}
		if _, ok := m[k]; !ok {
			m[k] = &list[i]
		}
	}
	return m
}

func parseAmountParts(amount string) (qty float64, unit string) {
	s := strings.TrimSpace(amount)
	if s == "" {
		return 0, ""
	}
	s = strings.ReplaceAll(s, "克", "g")
	m := amountLeadingNumberRe.FindStringSubmatch(s)
	if len(m) < 3 {
		return 0, ""
	}
	q, err := strconv.ParseFloat(m[1], 64)
	if err != nil || q <= 0 {
		return 0, ""
	}
	u := strings.TrimSpace(strings.ToLower(m[2]))
	return q, u
}

func defaultGramsPerUnit(unit string) float64 {
	switch strings.TrimSpace(unit) {
	case "", "g":
		return 1
	case "个":
		return 100
	case "碗":
		return 200
	case "杯":
		return 250
	case "勺":
		return 15
	case "ml", "毫升":
		return 1
	default:
		return 1
	}
}

// portionGramsEquivalent 将「数量+单位」换算为用于按每100g（或每100ml）比例缩放的营养计算基数（克或毫升数值）。
// 当用户明确写「xx g / 克」时，q 即克重，不能再用 gram_per_unit 相乘，否则会误将「100g」算成 100*100 克（种子数据中 gram_per_unit 常为 100 表示每份基准）。
func portionGramsEquivalent(amount string, ing *models.Ingredient) float64 {
	q, u := parseAmountParts(amount)
	if q <= 0 {
		return 0
	}
	// 明确按克
	if u == "g" {
		return q
	}
	// 仅数字无单位，视为克
	if u == "" {
		return q
	}
	if ing != nil {
		iu := strings.ToLower(strings.TrimSpace(ing.Unit))
		// 液体 ml 与克：按数字直接参与「每100」比例（如牛奶按 ml 与种子库一致）
		if (u == "ml" || u == "毫升") && iu == "ml" {
			return q
		}
		// 用户单位与食材常用单位一致时（个对个、碗对碗）：数量 * 每单位克数
		if iu != "" && u != "" && iu == u && iu != "g" && iu != "ml" && ing.GramPerUnit > 0 {
			return q * ing.GramPerUnit
		}
	}
	return q * defaultGramsPerUnit(u)
}

func nutrientsForPortion(ing *models.Ingredient, amount string, fallbackCal int, fallbackP, fallbackC, fallbackF float64) (cal int, p, c, f float64) {
	base := portionGramsEquivalent(amount, ing)
	if ing == nil {
		return fallbackCal, fallbackP, fallbackC, fallbackF
	}
	// 分量无法解析时，按 100g/100 单位 估算，避免有食材匹配却写入全 0
	if base <= 0 {
		base = 100
	}
	ratio := base / 100.0
	det, err := ing.GetNutritionDetails()
	if err != nil {
		det = models.NutritionDetails{}
	}
	p = det.Protein * ratio
	c = det.Carbohydrate * ratio
	f = det.Fat * ratio
	cal = int(math.Round(ing.Calorie100g * ratio))
	if cal < 0 {
		cal = 0
	}
	return cal, p, c, f
}

func roundNutrient1(x float64) float64 {
	return math.Round(x*10) / 10
}

func loadIngredientList(db *gorm.DB) ([]models.Ingredient, error) {
	var list []models.Ingredient
	if err := db.Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}
