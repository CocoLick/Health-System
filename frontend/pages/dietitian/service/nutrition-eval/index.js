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

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function r1(x) {
  return Math.round(n(x) * 10) / 10;
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
    form: {
      body_composition_text: '',
      dietary_pattern_text: '',
      micronutrient_text: '',
      risks_text: '',
      priority_lines: '',
      professional_conclusion: '',
      plan_recommendations: '',
      energy_need_kcal: '',
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
    dietRangeIndex: 2
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
      })
      .catch(() => {
        this.setData({ diet7Loading: false, diet7Error: '无法加载饮食记录' });
      });
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
    let energy = null;
    if (form.energy_need_kcal !== '' && form.energy_need_kcal != null) {
      const n = parseInt(String(form.energy_need_kcal), 10);
      if (!isNaN(n)) {
        energy = n;
      }
    }
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
    if (energy != null) {
      payload.energy_need_kcal = energy;
    }
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
