const api = require('../../../../utils/api');

function activityText(level) {
  const m = {
    sedentary: '久坐少动',
    lightly_active: '轻度活动',
    moderately_active: '中度活动',
    very_active: '高强度活动'
  };
  return m[level] || level || '—';
}

function dietGoalText(goal, other) {
  if (goal === 'other' && other) {
    return other;
  }
  const map = {
    weight_loss: '减脂',
    weight_gain: '增重',
    diabetes_control: '控糖',
    health_maintain: '养生',
    sports_nutrition: '运动营养',
    pregnancy: '孕期营养'
  };
  return map[goal] || goal || '—';
}

function computeBMI(heightCm, weightKg) {
  if (!heightCm || !weightKg) {
    return '';
  }
  const m = heightCm / 100;
  if (m <= 0) {
    return '';
  }
  const v = weightKg / (m * m);
  return (Math.round(v * 10) / 10).toFixed(1);
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function addDaysYmd(ymd, n) {
  const p = String(ymd || '').split('-');
  if (p.length !== 3) {
    return ymd;
  }
  const d = new Date(
    parseInt(p[0], 10),
    parseInt(p[1], 10) - 1,
    parseInt(p[2], 10) + n
  );
  if (isNaN(d.getTime())) {
    return ymd;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function defaultDietStartYmd() {
  return addDaysYmd(todayYmd(), -6);
}

function buildDateListFromStart(startYmd, numDays) {
  const n = Math.min(Math.max(1, parseInt(String(numDays), 10) || 1), 30);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(addDaysYmd(startYmd, i));
  }
  return out;
}

function createRecentDayKeys(days) {
  const nDays = Math.max(1, Number(days) || 7);
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < nDays; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`);
  }
  return out;
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function r1(x) {
  return Math.round(n(x) * 10) / 10;
}

function aggregateLatestByDay(rows) {
  const dayMap = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = row.date;
    if (!key) return;
    const prev = dayMap[key];
    if (!prev) {
      dayMap[key] = row;
      return;
    }
    const t1 = new Date(prev.snapshotAt || prev.date).getTime();
    const t2 = new Date(row.snapshotAt || row.date).getTime();
    if (t2 > t1) {
      dayMap[key] = row;
    }
  });
  return Object.keys(dayMap)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .map((k) => dayMap[k]);
}

function buildLineChart(points, unit, minWidthRpx, heightRpx) {
  const list = Array.isArray(points) ? points : [];
  const valid = list.filter((p) => p.value != null).map((p) => Number(p.value));
  const min = valid.length ? Math.min.apply(null, valid) : 0;
  const max = valid.length ? Math.max.apply(null, valid) : 1;
  const range = Math.max(max - min, 1);
  const slotWidth = 72;
  const pointCount = Math.max(list.length, 1);
  const widthRpx = Math.max(Number(minWidthRpx) || 0, pointCount * slotWidth);
  const xPad = slotWidth / 2;
  const yPad = 10;
  const xUse = Math.max((pointCount - 1) * slotWidth, 1);
  const yUse = Math.max(heightRpx - yPad * 2, 1);
  const chartPoints = list.map((p, idx) => {
    const total = Math.max(list.length - 1, 1);
    const x = xPad + (idx / total) * xUse;
    const ratio = p.value == null ? null : (Number(p.value) - min) / range;
    const y = ratio == null ? null : yPad + (1 - ratio) * yUse;
    return {
      id: p.id || `${idx}`,
      label: p.label || '',
      valueText: p.value == null ? '--' : `${Number(p.value).toFixed(1)}`,
      xPos: `${Math.round(x * 10) / 10}rpx`,
      yPos: y == null ? '' : `${Math.round(y * 10) / 10}rpx`,
      xNum: x,
      yNum: y,
      isEmpty: p.value == null
    };
  });
  const segments = [];
  const validPoints = chartPoints.filter((p) => !p.isEmpty);
  for (let i = 1; i < validPoints.length; i += 1) {
    const p1 = validPoints[i - 1];
    const p2 = validPoints[i];
    const dx = p2.xNum - p1.xNum;
    const dy = p2.yNum - p1.yNum;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    segments.push({
      id: `${p1.id}-${p2.id}`,
      left: `${Math.round(p1.xNum * 10) / 10}rpx`,
      top: `${Math.round(p1.yNum * 10) / 10}rpx`,
      width: `${Math.round(len * 10) / 10}rpx`,
      angle: `rotate(${angle}deg)`
    });
  }
  const ticks = [];
  for (let i = 0; i < 5; i += 1) {
    const ratio = i / 4;
    const v = max - (max - min) * ratio;
    ticks.push({
      id: `tick-${i}`,
      text: Number(v).toFixed(1),
      yPos: `${Math.round((yPad + ratio * yUse) * 10) / 10}rpx`
    });
  }
  return {
    chartPoints,
    segments,
    ticks,
    unitText: unit,
    widthRpx: `${widthRpx}rpx`,
    heightRpx: `${heightRpx}rpx`
  };
}

function joinDayMacroParts(p, c, f, fib) {
  const parts = [];
  if (n(p) > 0) {
    parts.push(`蛋白${r1(p)}g`);
  }
  if (n(c) > 0) {
    parts.push(`碳水${r1(c)}g`);
  }
  if (n(f) > 0) {
    parts.push(`脂肪${r1(f)}g`);
  }
  if (n(fib) > 0) {
    parts.push(`纤${r1(fib)}g`);
  }
  return parts.join(' · ');
}

/** 食材行：热量 + 非零宏量 */
function formatItemLine(it) {
  const name = it.food_name != null ? String(it.food_name) : '食物';
  const amt = it.amount != null ? it.amount : '';
  const u = it.unit || 'g';
  const cal = r1(it.calories);
  const p = n(it.protein);
  const c = n(it.carbohydrate);
  const f = n(it.fat);
  const fib = n(it.fiber);
  let s = `${name} ${amt}${u}，约${cal}kcal`;
  const tail = [];
  if (p > 0) {
    tail.push(`蛋白${r1(it.protein)}g`);
  }
  if (c > 0) {
    tail.push(`碳水${r1(it.carbohydrate)}g`);
  }
  if (f > 0) {
    tail.push(`脂肪${r1(it.fat)}g`);
  }
  if (fib > 0) {
    tail.push(`纤${r1(it.fiber)}g`);
  }
  if (tail.length) {
    s += `（${tail.join(' ')}）`;
  }
  return s;
}

/** 餐次下一行小字（仅非零项） */
function formatMealMacro(p, c, f, fib) {
  return joinDayMacroParts(p, c, f, fib);
}

function formatDiet7DayTitle(iso) {
  const parts = String(iso || '').split('-');
  if (parts.length !== 3) {
    return String(iso || '—');
  }
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const d = new Date(y, m - 1, day);
  if (isNaN(d.getTime())) {
    return String(iso);
  }
  const wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${m}月${day}日 ${wk[d.getDay()]}`;
}

/** 从规划师服务申请列表中选取与当前用户最相关的一条（与面板逻辑一致并放宽匹配） */
function pickServiceRequestForUser(rows, userId, preferredRequestId) {
  const uid = String(userId || '').trim();
  const list = Array.isArray(rows) ? rows : [];
  if (!uid) {
    return null;
  }
  if (preferredRequestId) {
    const byId = list.find((x) => String(x.request_id) === String(preferredRequestId));
    if (byId) {
      return byId;
    }
  }
  const mine = list.filter((x) => String(x.user_id) === uid);
  if (!mine.length) {
    return null;
  }
  const rank = (s) => {
    if (s === 'pending' || s === 'approved') {
      return 2;
    }
    if (s === 'completed') {
      return 1;
    }
    return 0;
  };
  mine.sort((a, b) => {
    const d = rank(b.status) - rank(a.status);
    if (d !== 0) {
      return d;
    }
    const ta = new Date(a.create_time || a.update_time || 0).getTime();
    const tb = new Date(b.create_time || b.update_time || 0).getTime();
    return tb - ta;
  });
  return mine[0];
}

Page({
  data: {
    userId: '',
    serviceRequestId: '',
    context: {
      bmi: '',
      activityText: '',
      dietGoalText: '—',
      otherGoal: ''
    },
    statusLabels: ['（未选）', '总体正常', '能量过剩倾向', '能量不足倾向', '膳食结构不均衡', '依据有限待复评'],
    statusValues: ['', 'normal', 'excess_energy', 'low_energy', 'imbalanced', 'unclear_data'],
    statusIndex: 0,
    priorityPlaceholder: '例如：能量过剩\n蔬菜不足',
    form: {
      body_composition_text: '',
      dietary_pattern_text: '',
      micronutrient_text: '',
      risks_text: '',
      priority_lines: '',
      professional_conclusion: '',
      plan_recommendations: '',
      valid_until: ''
    },
    /** 被评估用户饮食（与 /api/nutrition/record/date?user_id= 配合） */
    diet7Rows: [],
    diet7Loading: false,
    diet7Error: '',
    diet7ShowDetail: false,
    diet7Selected: null,
    /** 历史范围：自某天起连续 N 天 */
    todayYmd: todayYmd(),
    dietStartDate: defaultDietStartYmd(),
    dietRangeLabels: ['3 天', '5 天', '7 天', '10 天', '14 天', '30 天'],
    dietRangeValues: [3, 5, 7, 10, 14, 30],
    dietRangeIndex: 2,
    energyChart: { points: [], segments: [], ticks: [], width: '620rpx', height: '130rpx' },
    energyChartUnit: 'kcal',
    nutrientStruct: [],
    nutrientStructCompare: [],
    healthTrendMetric: 'weight',
    healthTrendTabs: [
      { key: 'weight', label: '体重' },
      { key: 'bloodSugar', label: '血糖' },
      { key: 'heartRate', label: '心率' }
    ],
    healthTrendDays: 30,
    healthTrendDayTabs: [7, 30, 365],
    healthHistoryRows: [],
    healthTrendChart: { points: [], segments: [], ticks: [], width: '700rpx', height: '140rpx' },
    healthTrendUnit: 'kg',
    recommendation: null,
    intakeDeviation: null,
    accordion: {
      /** 饮食记录与补充说明：每日汇总列表折叠 */
      dietHistory: true,
      writingHints: false
    }
  },

  onLoad(options) {
    const userId = options.userId || '';
    const serviceRequestId = options.serviceRequestId || '';
    if (!userId) {
      wx.showToast({ title: '缺少用户', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({
      userId,
      serviceRequestId,
      todayYmd: todayYmd(),
      dietStartDate: defaultDietStartYmd()
    });
    this.loadContext();
  },

  onShow() {
    this.setData({ todayYmd: todayYmd() });
  },

  loadContext() {
    const { userId, serviceRequestId } = this.data;
    wx.showLoading({ title: '加载中...' });
    const p1 = api.healthData.getUserHealthData(userId).catch(() => ({ code: 0 }));
    const p2 = api.serviceRequest.getDietitianList().catch(() => ({ code: 0 }));
    Promise.all([p1, p2])
      .then(([hRes, rRes]) => {
        wx.hideLoading();
        let bmiStr = '';
        let activityStr = '';
        if (hRes && (hRes.code === 200 || hRes.code === '200') && hRes.data) {
          const d = hRes.data;
          bmiStr = computeBMI(d.height, d.weight);
          activityStr = activityText(d.activity_level);
        }
        const list = rRes && rRes.data != null ? rRes.data : [];
        const req =
          rRes && (rRes.code === 200 || rRes.code === '200')
            ? pickServiceRequestForUser(list, userId, serviceRequestId)
            : null;
        let dietStr = '—';
        let other = '';
        let srId = String(serviceRequestId || '').trim();
        if (req) {
          srId = srId || String(req.request_id || '');
          dietStr = dietGoalText(req.diet_goal, req.other_goal);
          other = req.other_goal ? String(req.other_goal) : '';
        }
        const upd = {
          'context.bmi': bmiStr,
          'context.activityText': activityStr,
          'context.dietGoalText': dietStr,
          'context.otherGoal': other,
          serviceRequestId: srId || this.data.serviceRequestId
        };
        this.setData(upd);
        this.loadDiet7();
        this.loadHealthHistory();
        this.loadRecommendationForUser();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  onDietStartDateChange(e) {
    const v = (e.detail && e.detail.value) || '';
    if (v) {
      this.setData({ dietStartDate: v });
      this.loadDiet7();
    }
  },

  onDietRangeChange(e) {
    const idx = parseInt(e.detail.value, 10);
    if (isNaN(idx)) {
      return;
    }
    this.setData({ dietRangeIndex: idx });
    this.loadDiet7();
  },

  loadDiet7() {
    const userId = String(this.data.userId || '').trim();
    if (!userId) {
      return;
    }
    this.setData({ diet7Loading: true, diet7Error: '' });
    const numDays =
      (this.data.dietRangeValues && this.data.dietRangeValues[this.data.dietRangeIndex]) || 7;
    const dates = buildDateListFromStart(this.data.dietStartDate, numDays);
    const mealOrder = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
    const label = (t) =>
      ({ breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }[t] || t || '餐次');
    Promise.all(
      dates.map((date) =>
        api.nutrition.getRecordsByDate(date, userId).catch(() => ({ code: 0, data: null }))
      )
    )
      .then((results) => {
        const diet7Rows = dates.map((date, i) => {
          const res = results[i];
          const ok = res && (res.code === 200 || res.code === '200');
          const raw = ok && res.data != null ? res.data : [];
          const recs = Array.isArray(raw) ? raw : [];
          let kcal = 0;
          let sumP = 0;
          let sumC = 0;
          let sumF = 0;
          let sumFib = 0;
          recs.forEach((r) => {
            kcal += n(r.total_calories);
            sumP += n(r.total_protein);
            sumC += n(r.total_carbohydrate);
            sumF += n(r.total_fat);
            sumFib += n(r.total_fiber);
          });
          const totalKcalR = r1(kcal);
          const totalProteinR = r1(sumP);
          const totalCarbR = r1(sumC);
          const totalFatR = r1(sumF);
          const totalFiberR = r1(sumFib);
          const hasNutrition =
            totalKcalR > 0 || totalProteinR > 0 || totalCarbR > 0 || totalFatR > 0 || totalFiberR > 0;
          const meals = recs
            .map((r) => ({
              mealType: r.meal_type,
              mealLabel: label(r.meal_type),
              kcal: r1(r.total_calories),
              protein: r1(r.total_protein),
              carb: r1(r.total_carbohydrate),
              fat: r1(r.total_fat),
              fiber: r1(r.total_fiber),
              macroSub: formatMealMacro(
                r.total_protein,
                r.total_carbohydrate,
                r.total_fat,
                r.total_fiber
              ),
              items: (r.items || []).map((it) => ({
                food_name: it.food_name,
                line: formatItemLine(it)
              }))
            }))
            .sort(
              (a, b) =>
                (mealOrder[a.mealType] != null ? mealOrder[a.mealType] : 9) -
                (mealOrder[b.mealType] != null ? mealOrder[b.mealType] : 9)
            );
          return {
            date,
            dayTitle: formatDiet7DayTitle(date),
            totalKcal: totalKcalR,
            totalProtein: totalProteinR,
            totalCarb: totalCarbR,
            totalFat: totalFatR,
            totalFiber: totalFiberR,
            hasNutrition,
            dayMacroSub: joinDayMacroParts(sumP, sumC, sumF, sumFib),
            mealCount: recs.length,
            meals
          };
        });
        this.setData({ diet7Rows, diet7Loading: false });
        this.buildDietCharts();
      })
      .catch(() => {
        this.setData({ diet7Loading: false, diet7Error: '无法加载饮食记录' });
      });
  },

  loadHealthHistory() {
    const userId = String(this.data.userId || '').trim();
    if (!userId) return;
    api.healthData.getUserHistory(userId)
      .then((res) => {
        if (res.code !== 200 || !Array.isArray(res.data)) {
          this.setData({ healthHistoryRows: [] });
          this.buildHealthTrendChart();
          return;
        }
        const rows = res.data.map((item) => ({
          id: item.history_id || item.data_id || '',
          date: item.snapshot_at ? String(item.snapshot_at).slice(0, 10) : '',
          snapshotAt: item.snapshot_at || item.created_at || '',
          weight: n(item.weight),
          bloodSugar: n(item.blood_sugar),
          heartRate: n(item.heart_rate)
        }));
        this.setData({ healthHistoryRows: rows });
        this.buildHealthTrendChart();
      })
      .catch(() => {
        this.setData({ healthHistoryRows: [] });
        this.buildHealthTrendChart();
      });
  },

  buildDietCharts() {
    const rows = Array.isArray(this.data.diet7Rows) ? this.data.diet7Rows : [];
    const energyPoints = rows.map((r) => ({
      id: r.date,
      label: String(r.date || '').slice(5),
      value: r.hasNutrition ? n(r.totalKcal) : null
    }));
    const energyChartData = buildLineChart(energyPoints, 'kcal', 620, 130);
    const totalP = rows.reduce((acc, r) => acc + n(r.totalProtein), 0);
    const totalC = rows.reduce((acc, r) => acc + n(r.totalCarb), 0);
    const totalF = rows.reduce((acc, r) => acc + n(r.totalFat), 0);
    const kcalP = totalP * 4;
    const kcalC = totalC * 4;
    const kcalF = totalF * 9;
    const kcalAll = Math.max(kcalP + kcalC + kcalF, 1);
    const nutrientStruct = [
      { key: 'protein', label: '蛋白质', pct: Math.round((kcalP / kcalAll) * 1000) / 10, color: '#22c55e' },
      { key: 'carb', label: '碳水', pct: Math.round((kcalC / kcalAll) * 1000) / 10, color: '#3b82f6' },
      { key: 'fat', label: '脂肪', pct: Math.round((kcalF / kcalAll) * 1000) / 10, color: '#f59e0b' }
    ];
    this.setData({
      energyChart: {
        points: energyChartData.chartPoints,
        segments: energyChartData.segments,
        ticks: energyChartData.ticks,
        width: energyChartData.widthRpx,
        height: energyChartData.heightRpx
      },
      energyChartUnit: energyChartData.unitText || 'kcal',
      nutrientStruct
    });
    this.buildNutrientStructCompare();
    this.buildIntakeDeviation();
  },

  buildNutrientStructCompare() {
    const actual = Array.isArray(this.data.nutrientStruct) ? this.data.nutrientStruct : [];
    const rec = this.data.recommendation;
    if (!actual.length || !rec) {
      this.setData({ nutrientStructCompare: [] });
      return;
    }
    const kcalP = n(rec.protein) * 4;
    const kcalC = n(rec.carbohydrate) * 4;
    const kcalF = n(rec.fat) * 9;
    const sum = Math.max(kcalP + kcalC + kcalF, 1);
    const recMap = {
      protein: Math.round((kcalP / sum) * 1000) / 10,
      carb: Math.round((kcalC / sum) * 1000) / 10,
      fat: Math.round((kcalF / sum) * 1000) / 10
    };
    const compare = actual.map((item) => {
      const recPct = recMap[item.key] != null ? recMap[item.key] : 0;
      const delta = Math.round((n(item.pct) - recPct) * 10) / 10;
      return {
        key: item.key,
        label: item.label,
        color: item.color,
        actualPct: item.pct,
        recPct: recPct,
        deltaPct: delta
      };
    });
    this.setData({ nutrientStructCompare: compare });
  },

  loadRecommendationForUser() {
    const userId = String(this.data.userId || '').trim();
    if (!userId) return;
    api.nutrition.getUserRecommendation(userId)
      .then((res) => {
        if (res.code !== 200 || !res.data) {
          this.setData({ recommendation: null });
          this.buildIntakeDeviation();
          return;
        }
        const d = res.data;
        this.setData({
          recommendation: {
            calories: r1((d.nutrients && d.nutrients.calories) || 0),
            protein: r1((d.nutrients && d.nutrients.protein) || 0),
            carbohydrate: r1((d.nutrients && d.nutrients.carbohydrate) || 0),
            fat: r1((d.nutrients && d.nutrients.fat) || 0),
            bmr: r1(d.bmr || 0),
            activityLevel: d.activity_level || '',
            activityLevelText: activityText(d.activity_level)
          }
        });
        this.buildNutrientStructCompare();
        this.buildIntakeDeviation();
      })
      .catch(() => {
        this.setData({ recommendation: null });
        this.buildNutrientStructCompare();
        this.buildIntakeDeviation();
      });
  },

  buildIntakeDeviation() {
    const rec = this.data.recommendation;
    const rows = Array.isArray(this.data.diet7Rows) ? this.data.diet7Rows : [];
    const valid = rows.filter((r) => !!r.hasNutrition);
    if (!rec || !valid.length) {
      this.setData({ intakeDeviation: null });
      return;
    }
    const avg = {
      calories: valid.reduce((acc, r) => acc + n(r.totalKcal), 0) / valid.length,
      protein: valid.reduce((acc, r) => acc + n(r.totalProtein), 0) / valid.length,
      carbohydrate: valid.reduce((acc, r) => acc + n(r.totalCarb), 0) / valid.length,
      fat: valid.reduce((acc, r) => acc + n(r.totalFat), 0) / valid.length
    };
    const diff = (actual, target) => {
      const d = n(actual) - n(target);
      const pct = n(target) > 0 ? (d / n(target)) * 100 : 0;
      return {
        delta: r1(d),
        pct: r1(pct)
      };
    };
    this.setData({
      intakeDeviation: {
        validDays: valid.length,
        totalDays: rows.length,
        avg: {
          calories: r1(avg.calories),
          protein: r1(avg.protein),
          carbohydrate: r1(avg.carbohydrate),
          fat: r1(avg.fat)
        },
        diff: {
          calories: diff(avg.calories, rec.calories),
          protein: diff(avg.protein, rec.protein),
          carbohydrate: diff(avg.carbohydrate, rec.carbohydrate),
          fat: diff(avg.fat, rec.fat)
        }
      }
    });
  },

  buildHealthTrendChart() {
    const fieldMap = { weight: 'weight', bloodSugar: 'bloodSugar', heartRate: 'heartRate' };
    const unitMap = { weight: 'kg', bloodSugar: 'mmol/L', heartRate: '次/分' };
    const field = fieldMap[this.data.healthTrendMetric] || 'weight';
    const unit = unitMap[this.data.healthTrendMetric] || 'kg';
    const days = Number(this.data.healthTrendDays) || 30;
    const dailyAsc = aggregateLatestByDay(
      this.data.healthHistoryRows.map((r) => Object.assign({}, r, { date: r.date }))
    );
    const dayMap = {};
    dailyAsc.forEach((row) => {
      if (row && row.date) {
        dayMap[row.date] = row;
      }
    });
    const dayKeysAsc = createRecentDayKeys(days).reverse();
    const pointsRaw = dayKeysAsc.map((dateKey) => {
      const row = dayMap[dateKey];
      const raw = row ? n(row[field]) : 0;
      return {
        id: row ? (row.id || dateKey) : `empty-${dateKey}`,
        date: dateKey,
        label: String(dateKey).slice(5),
        value: raw > 0 ? raw : null
      };
    });

    if (days === 365) {
      const monthMap = {};
      pointsRaw.forEach((p) => {
        const d = new Date(p.date);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const mk = `${d.getMonth() + 1}月`;
        if (!monthMap[key]) monthMap[key] = { label: mk, values: [] };
        if (p.value != null) monthMap[key].values.push(p.value);
      });
      const monthKeys = [];
      const now = new Date();
      now.setDate(1);
      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setMonth(now.getMonth() - i);
        monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      const monthly = monthKeys.map((k) => {
        const b = monthMap[k];
        const arr = b ? b.values : [];
        const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        const label = b ? b.label : `${parseInt(k.slice(5), 10)}月`;
        return { id: k, label, value: avg };
      });
      const c = buildLineChart(monthly, unit, 700, 140);
      this.setData({
        healthTrendChart: {
          points: c.chartPoints,
          segments: c.segments,
          ticks: c.ticks,
          width: c.widthRpx,
          height: c.heightRpx
        },
        healthTrendUnit: c.unitText || unit
      });
      return;
    }
    const chartData = buildLineChart(pointsRaw, unit, 700, 140);
    this.setData({
      healthTrendChart: {
        points: chartData.chartPoints,
        segments: chartData.segments,
        ticks: chartData.ticks,
        width: chartData.widthRpx,
        height: chartData.heightRpx
      },
      healthTrendUnit: chartData.unitText || unit
    });
  },

  switchHealthTrendMetric(e) {
    const metric = e.currentTarget.dataset.metric;
    if (!metric || metric === this.data.healthTrendMetric) return;
    this.setData({ healthTrendMetric: metric });
    this.buildHealthTrendChart();
  },

  switchHealthTrendDays(e) {
    const days = Number(e.currentTarget.dataset.days);
    if (!days || days === this.data.healthTrendDays) return;
    this.setData({ healthTrendDays: days });
    this.buildHealthTrendChart();
  },

  onTapDiet7Day(e) {
    const date = e.currentTarget.dataset.date;
    const row = (this.data.diet7Rows || []).find((r) => r.date === date);
    if (!row) {
      return;
    }
    this.setData({ diet7ShowDetail: true, diet7Selected: row });
  },

  closeDiet7Detail() {
    this.setData({ diet7ShowDetail: false, diet7Selected: null });
  },

  noop() {},

  /**
   * 锚点在 wx:else（非 loading/错误）内；pageScrollTo 在不可滚或 scrollTop 越界时易 Error: timeout。
   */
  _scrollToDietRecordsAnchorWithRetry(attempt) {
    const n = typeof attempt === 'number' ? attempt : 0;
    const maxAttempts = 24;
    const winInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const winH = Number(winInfo.windowHeight || winInfo.screenHeight) || 667;

    const query = wx.createSelectorQuery().in(this);
    query.select('#diet-records-anchor').boundingClientRect();
    query.select('.page').boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec((res) => {
      const rect = res && res[0];
      const containerRect = res && res[1];
      const viewport = res && res[2];
      if (
        rect &&
        viewport &&
        typeof rect.top === 'number' &&
        typeof viewport.scrollTop === 'number'
      ) {
        const offsetPx = 12;
        const st = viewport.scrollTop || 0;
        let maxScroll = Number.POSITIVE_INFINITY;
        if (
          containerRect &&
          typeof containerRect.top === 'number' &&
          typeof containerRect.height === 'number'
        ) {
          maxScroll = Math.max(0, Math.round(st + containerRect.top + containerRect.height - winH));
        }
        const desired = Math.round(st + rect.top - offsetPx);
        const nextTop = Math.min(Math.max(0, desired), maxScroll);
        if (Math.abs(nextTop - st) < 6) {
          return;
        }
        wx.pageScrollTo({
          scrollTop: nextTop,
          duration: 280,
          fail: () => {
            wx.showToast({ title: '跳转失败，请手动向上翻阅', icon: 'none' });
          }
        });
        return;
      }
      if (n >= maxAttempts) {
        wx.showToast({ title: '跳转失败，请手动向上翻阅', icon: 'none' });
        return;
      }
      setTimeout(() => this._scrollToDietRecordsAnchorWithRetry(n + 1), 72);
    });
  },

  scrollToDietRecords() {
    if (this.data.diet7Loading) {
      wx.showToast({ title: '饮食记录加载中', icon: 'none' });
      return;
    }
    if (this.data.diet7Error) {
      wx.showToast({ title: '饮食记录暂不可用', icon: 'none' });
      return;
    }
    this.setData({ 'accordion.dietHistory': true }, () => {
      wx.nextTick(() => {
        this._scrollToDietRecordsAnchorWithRetry(0);
      });
    });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`form.${field}`]: value
    });
  },

  onStatusChange(e) {
    const idx = parseInt(e.detail.value, 10);
    this.setData({ statusIndex: idx });
  },

  onValidUntilChange(e) {
    this.setData({ 'form.valid_until': e.detail.value });
  },

  toggleSection(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    const path = `accordion.${key}`;
    this.setData({ [path]: !this.data.accordion[key] });
  },

  toggleAllSections() {
    const cur = this.data.accordion || {};
    const allOpen = !!(cur.dietHistory && cur.writingHints);
    const next = !allOpen;
    this.setData({
      accordion: {
        dietHistory: next,
        writingHints: next
      }
    });
  },

  submit() {
    const { userId, serviceRequestId, statusValues, statusIndex, form } = this.data;
    const conclusion = (form.professional_conclusion || '').trim();
    if (!conclusion) {
      wx.showToast({ title: '请填写专业评估结论', icon: 'none' });
      return;
    }
    const priorities = (form.priority_lines || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      user_id: userId,
      nutrition_status: statusValues[statusIndex] || '',
      body_composition_text: form.body_composition_text,
      dietary_pattern_text: form.dietary_pattern_text,
      micronutrient_text: form.micronutrient_text,
      risks_text: form.risks_text,
      priority_issues: priorities,
      professional_conclusion: conclusion,
      plan_recommendations: form.plan_recommendations
    };
    if (serviceRequestId) {
      payload.service_request_id = serviceRequestId;
    }
    if (form.valid_until) {
      payload.valid_until = form.valid_until;
    }
    wx.showLoading({ title: '提交中...' });
    api.evaluation
      .submit(payload)
      .then((res) => {
        wx.hideLoading();
        if (res.code === 200) {
          wx.showToast({ title: '已保存', icon: 'success' });
          try {
            const ec = this.getOpenerEventChannel();
            if (ec && ec.emit) {
              ec.emit('evaluationSaved', {});
            }
          } catch (e) {
            /* no opener */
          }
          setTimeout(() => wx.navigateBack(), 800);
        } else {
          wx.showToast({ title: res.message || '提交失败', icon: 'none' });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        const msg = (err && err.data && err.data.message) || '网络错误';
        wx.showToast({ title: msg, icon: 'none' });
      });
  }
});
