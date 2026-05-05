/**
 * 膳食计划一餐 → 记录饮食页预填（名称、份量、热量与宏量来自计划）
 */

function planMealTypeToRecordKey(typeStr) {
  const t = String(typeStr || '').trim();
  const map = {
    早餐: 'breakfast',
    早饭: 'breakfast',
    午餐: 'lunch',
    午饭: 'lunch',
    中餐: 'lunch',
    晚餐: 'dinner',
    晚饭: 'dinner',
    夜宵: 'snack',
    加餐: 'snack',
    点心: 'snack'
  };
  if (map[t]) return map[t];
  const lower = t.toLowerCase();
  if (['breakfast', 'lunch', 'dinner', 'snack'].includes(lower)) return lower;
  return 'snack';
}

function parseAmountAndUnit(amountStr) {
  const s = String(amountStr || '').trim();
  const m = s.match(/^([\d.]+)\s*(.*)$/);
  if (!m) return { num: '1', unit: '份' };
  const num = m[1];
  let unit = (m[2] || '').trim();
  if (!unit) unit = '份';
  return { num, unit };
}

function round1(x) {
  return Math.round(Number(x) * 10) / 10;
}

/** 为每条食物分配蛋白质/碳水/脂肪：优先用食物项数值，否则按餐次合计并按本条热量占比拆分 */
function buildMacroRows(meal, assignedCals) {
  const foods = meal.foods || [];
  const n = foods.length;
  const assigned = assignedCals.map((c) => Number(c) || 0);
  const totalAssigned = assigned.reduce((a, b) => a + b, 0);

  const fp = foods.map((f) => Number(f.protein) || 0);
  const fc = foods.map((f) => Number(f.carbohydrate) || 0);
  const ff = foods.map((f) => Number(f.fat) || 0);
  const sumFp = fp.reduce((a, b) => a + b, 0);
  const sumFc = fc.reduce((a, b) => a + b, 0);
  const sumFf = ff.reduce((a, b) => a + b, 0);

  const mp = Number(meal.protein) || 0;
  const mc = Number(meal.carbohydrate) || 0;
  const mf = Number(meal.fat) || 0;

  const useFoodLevel = sumFp + sumFc + sumFf > 1e-6;
  if (useFoodLevel) {
    return foods.map((_, i) => ({
      protein: round1(fp[i]),
      carbohydrate: round1(fc[i]),
      fat: round1(ff[i])
    }));
  }

  const hasMealMacro = mp + mc + mf > 1e-6;
  if (!hasMealMacro || n === 0) {
    return assigned.map(() => ({ protein: 0, carbohydrate: 0, fat: 0 }));
  }

  if (totalAssigned > 1e-6) {
    let cumP = 0;
    let cumC = 0;
    let cumF = 0;
    return assigned.map((cal, i) => {
      const ratio = cal / totalAssigned;
      if (i === n - 1) {
        return {
          protein: round1(mp - cumP),
          carbohydrate: round1(mc - cumC),
          fat: round1(mf - cumF)
        };
      }
      const p = round1(ratio * mp);
      const c = round1(ratio * mc);
      const f = round1(ratio * mf);
      cumP += p;
      cumC += c;
      cumF += f;
      return { protein: p, carbohydrate: c, fat: f };
    });
  }

  const eachP = mp / n;
  const eachC = mc / n;
  const eachF = mf / n;
  let cp = 0;
  let cc = 0;
  let cf = 0;
  return assigned.map((_, i) => {
    if (i === n - 1) {
      return {
        protein: round1(mp - cp),
        carbohydrate: round1(mc - cc),
        fat: round1(mf - cf)
      };
    }
    const p = round1(eachP);
    const c = round1(eachC);
    const f = round1(eachF);
    cp += p;
    cc += c;
    cf += f;
    return { protein: p, carbohydrate: c, fat: f };
  });
}

function buildFoodsFromPlanMeal(meal) {
  const foods = meal.foods || [];
  const mealCal = Math.max(0, Number(meal.calories) || 0);
  let assigned = foods.map((f) => Math.max(0, Number(f.calories) || 0));
  const sum = assigned.reduce((a, b) => a + b, 0);
  const zeroIdx = [];
  assigned.forEach((c, i) => {
    if (c === 0) zeroIdx.push(i);
  });
  if (sum === 0 && mealCal > 0 && foods.length > 0) {
    const n = foods.length;
    const each = Math.floor(mealCal / n);
    assigned = foods.map((_, i) => (i === n - 1 ? mealCal - each * (n - 1) : each));
  } else if (zeroIdx.length > 0 && sum < mealCal) {
    const rest = mealCal - sum;
    const each = Math.floor(rest / zeroIdx.length);
    zeroIdx.forEach((idx, j) => {
      assigned[idx] = j === zeroIdx.length - 1 ? rest - each * (zeroIdx.length - 1) : each;
    });
  }

  const macroRows = buildMacroRows(meal, assigned);

  return foods.map((f, i) => {
    const { num, unit } = parseAmountAndUnit(f.amount);
    const m = macroRows[i] || { protein: 0, carbohydrate: 0, fat: 0 };
    return {
      name: (f.name || '').trim() || '食物',
      amount: num,
      unit,
      gramPerUnit: 100,
      nutrition: {
        calories: assigned[i] || 0,
        protein: m.protein,
        carbohydrate: m.carbohydrate,
        fat: m.fat,
        fiber: 0
      }
    };
  });
}

module.exports = {
  planMealTypeToRecordKey,
  parseAmountAndUnit,
  buildFoodsFromPlanMeal
};
