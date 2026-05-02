const api = require('../../../utils/api');

function formatEvalDateTime(iso) {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return String(iso);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

function nutritionStatusLabel(code) {
  const map = {
    normal: '总体正常',
    excess_energy: '能量过剩倾向',
    low_energy: '能量不足倾向',
    imbalanced: '膳食结构不均衡',
    unclear_data: '依据有限待复评'
  };
  return map[code] || code || '—';
}

function evaluationExpired(ev) {
  if (!ev || !ev.valid_until) {
    return false;
  }
  const end = new Date(ev.valid_until);
  const today = new Date();
  end.setHours(23, 59, 59, 999);
  today.setHours(0, 0, 0, 0);
  return end < today;
}

function activityLevelText(level) {
  const map = {
    sedentary: '久坐',
    lightly_active: '轻度',
    moderately_active: '中度',
    very_active: '高强度'
  };
  return map[level] || '—';
}

function displayGender(g) {
  if (g === 'male' || g === '男') return '男';
  if (g === 'female' || g === '女') return '女';
  return '';
}

function backendGender(g) {
  if (g === '男' || g === 'male') return 'male';
  if (g === '女' || g === 'female') return 'female';
  return '';
}

function mapActivityToIndex(level) {
  if (!level) {
    return -1;
  }
  const m = { sedentary: 0, lightly_active: 1, moderately_active: 2, very_active: 3 };
  return Object.prototype.hasOwnProperty.call(m, level) ? m[level] : -1;
}

function mapNutritionToIndex(goal) {
  if (!goal) {
    return -1;
  }
  const m = { lose_weight: 0, maintain: 1, healthy_gain: 2 };
  return Object.prototype.hasOwnProperty.call(m, goal) ? m[goal] : -1;
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cleanText(v) {
  return String(v == null ? '' : v).trim();
}

function parseInteger(v) {
  const text = cleanText(v);
  if (!text) {
    return null;
  }
  if (!/^-?\d+$/.test(text)) {
    return null;
  }
  const n = Number(text);
  return Number.isInteger(n) ? n : null;
}

function parseDecimal(v) {
  const text = cleanText(v);
  if (!text) {
    return null;
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function parseBloodPressure(v) {
  const text = cleanText(v);
  if (!text) {
    return { ok: true, text: '' };
  }
  // 兼容常见输入：120/80、120／80、120 / 80、120/80mmHg
  const normalized = text
    .replace(/\s+/g, '')
    .replace(/mmhg/ig, '')
    .replace(/毫米汞柱/g, '')
    .replace(/[／\\]/g, '/');
  const m = normalized.match(/^(\d{2,3})\/(\d{2,3})$/);
  if (!m) {
    return { ok: false, message: '血压请按120/80填写（支持120／80）' };
  }
  const systolic = Number(m[1]);
  const diastolic = Number(m[2]);
  if (systolic <= diastolic) {
    return { ok: false, message: '血压填写异常：收缩压应大于舒张压' };
  }
  if (systolic < 70 || systolic > 250 || diastolic < 40 || diastolic > 150) {
    return { ok: false, message: '血压超出合理范围（收缩压70-250，舒张压40-150）' };
  }
  return { ok: true, text: `${systolic}/${diastolic}` };
}

function formatDelta(value, unit) {
  if (value == null || !Number.isFinite(value)) {
    return '--';
  }
  const abs = Math.abs(value).toFixed(1);
  if (value > 0) {
    return `+${abs}${unit}`;
  }
  if (value < 0) {
    return `-${abs}${unit}`;
  }
  return `0.0${unit}`;
}

function calcDelta(latest, baseline) {
  const a = safeNumber(latest);
  const b = safeNumber(baseline);
  if (a == null || b == null) {
    return null;
  }
  return a - b;
}

function formatDateKey(ts) {
  if (!ts) {
    return '';
  }
  const d = new Date(ts);
  if (isNaN(d.getTime())) {
    return String(ts).slice(0, 10);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function aggregateLatestByDay(rows) {
  const dayMap = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = row.date || formatDateKey(row.snapshotAt);
    if (!key) {
      return;
    }
    const prev = dayMap[key];
    if (!prev) {
      dayMap[key] = row;
      return;
    }
    const currentTs = new Date(row.snapshotAt || row.date).getTime();
    const prevTs = new Date(prev.snapshotAt || prev.date).getTime();
    if (currentTs > prevTs) {
      dayMap[key] = row;
    }
  });
  return Object.keys(dayMap)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .map((dateKey) => dayMap[dateKey]);
}

function createRecentDayKeys(days) {
  const n = Math.max(1, Number(days) || 7);
  const list = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    list.push(formatDateKey(d));
  }
  return list;
}

function filterRowsByRecentDays(rows, days) {
  const daySet = {};
  createRecentDayKeys(days).forEach((key) => {
    daySet[key] = true;
  });
  return (Array.isArray(rows) ? rows : []).filter((row) => row && daySet[row.date]);
}

function buildHistoryVisualModel(historyRows, metric, days) {
  const dayKeysDesc = createRecentDayKeys(days);
  const dayMap = {};
  (Array.isArray(historyRows) ? historyRows : []).forEach((row) => {
    if (row && row.date) {
      dayMap[row.date] = row;
    }
  });
  const dayRows = dayKeysDesc
    .map((dateKey) => {
      const row = dayMap[dateKey];
      if (row) {
        return row;
      }
      return {
        id: `empty-${dateKey}`,
        date: dateKey,
        empty: true
      };
    })
    .reverse();
  const metricFieldMap = {
    weight: 'weight',
    bloodSugar: 'bloodSugar',
    heartRate: 'heartRate'
  };
  const unitMap = {
    weight: 'kg',
    bloodSugar: 'mmol/L',
    heartRate: '次/分'
  };
  const field = metricFieldMap[metric] || 'weight';
  const unit = unitMap[metric] || 'kg';
  const dayRowsWithValue = dayRows.map((row) => ({
    id: row.id,
    date: row.date,
    rawValue: safeNumber(row[field])
  }));
  const values = dayRowsWithValue.map((row) => ({
    value: row.rawValue,
    carried: false
  }));
  const validValues = values.map((x) => x.value).filter((n) => n != null);
  const max = validValues.length ? Math.max.apply(null, validValues) : 0;
  const min = validValues.length ? Math.min.apply(null, validValues) : 0;
  const range = Math.max(max - min, 1);
  const chartHeightRpx = 130;
  const slotWidthRpx = 72;
  const pointCount = Math.max(dayRows.length, 1);
  const chartWidthRpxNum = pointCount * slotWidthRpx;
  const xPaddingRpx = slotWidthRpx / 2;
  const yPaddingRpx = 10;
  const xUsable = Math.max((pointCount - 1) * slotWidthRpx, 1);
  const yUsable = Math.max(chartHeightRpx - yPaddingRpx * 2, 1);
  const points = dayRows.map((row, idx) => {
    const val = values[idx].value;
    const ratio = val == null ? null : ((val - min) / range);
    const total = Math.max(dayRows.length - 1, 1);
    const xRatio = idx / total;
    const xRpxNum = xPaddingRpx + xRatio * xUsable;
    const yRpxNum = val == null ? null : (yPaddingRpx + (1 - ratio) * yUsable);
    return {
      id: row.id,
      day: row.date ? row.date.slice(5) : '--',
      valueText: val == null ? '--' : `${Number(val).toFixed(1)}`,
      xPos: `${Math.round(xRpxNum * 10) / 10}rpx`,
      yPos: yRpxNum == null ? null : `${Math.round(yRpxNum * 10) / 10}rpx`,
      xNum: xRpxNum,
      yNum: yRpxNum,
      isEmpty: val == null,
      carried: values[idx].carried
    };
  });
  const segments = [];
  const validPoints = points.filter((p) => !p.isEmpty);
  for (let i = 1; i < validPoints.length; i += 1) {
    const p1 = validPoints[i - 1];
    const p2 = validPoints[i];
    const x1 = p1.xNum;
    const y1 = p1.yNum;
    const x2 = p2.xNum;
    const y2 = p2.yNum;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    segments.push({
      id: `${p1.id}-${p2.id}`,
      left: `${Math.round(x1 * 10) / 10}rpx`,
      top: `${Math.round(y1 * 10) / 10}rpx`,
      width: `${Math.round(length * 10) / 10}rpx`,
      angle: `rotate(${angle}deg)`,
      carried: p1.carried || p2.carried
    });
  }
  const latest = validValues.length ? validValues[validValues.length - 1] : null;
  const earliest = validValues.length > 1 ? validValues[0] : latest;
  const delta = latest != null && earliest != null ? latest - earliest : null;
  const realDayCount = validValues.length;
  const carriedDayCount = 0;
  const lineWidthRpx = `${chartWidthRpxNum}rpx`;
  const hasLeadingBlank = dayRows.length > 0 && points.length > 0 && points[0].isEmpty;
  const tickCount = 5;
  const axisTicks = [];
  const axisMin = validValues.length ? min : 0;
  const axisMax = validValues.length ? max : 1;
  const axisRange = Math.max(axisMax - axisMin, 1);
  for (let i = 0; i < tickCount; i += 1) {
    const ratio = i / (tickCount - 1);
    const value = axisMax - axisRange * ratio;
    axisTicks.push({
      id: `tick-${i}`,
      text: Number(value).toFixed(1),
      yPos: `${Math.round((yPaddingRpx + ratio * yUsable) * 10) / 10}rpx`
    });
  }

  return {
    points,
    segments,
    lineWidthRpx,
    hasLeadingBlank,
    chartHeightRpx: `${chartHeightRpx}rpx`,
    axisTicks,
    unitText: unit,
    latestText: latest == null ? '--' : `${Number(latest).toFixed(1)}`,
    deltaText: formatDelta(delta, unit),
    hasTrendData: validValues.length >= 2,
    validDayCount: validValues.length,
    realDayCount,
    carriedDayCount
  };
}

function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function buildYearlyVisualModel(historyRows, metric) {
  const metricFieldMap = {
    weight: 'weight',
    bloodSugar: 'bloodSugar',
    heartRate: 'heartRate'
  };
  const unitMap = {
    weight: 'kg',
    bloodSugar: 'mmol/L',
    heartRate: '次/分'
  };
  const field = metricFieldMap[metric] || 'weight';
  const unit = unitMap[metric] || 'kg';

  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  const monthBuckets = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setMonth(now.getMonth() - i);
    monthBuckets.push({
      key: monthKey(d),
      label: `${d.getMonth() + 1}月`,
      values: []
    });
  }
  const idxMap = {};
  monthBuckets.forEach((b, idx) => {
    idxMap[b.key] = idx;
  });
  (Array.isArray(historyRows) ? historyRows : []).forEach((row) => {
    if (!row || !row.date) return;
    const d = new Date(row.date);
    if (isNaN(d.getTime())) return;
    const key = monthKey(d);
    const idx = idxMap[key];
    if (idx == null) return;
    const v = safeNumber(row[field]);
    if (v != null) monthBuckets[idx].values.push(v);
  });

  const monthly = monthBuckets.map((b) => {
    if (!b.values.length) {
      return { key: b.key, label: b.label, value: null };
    }
    const sum = b.values.reduce((acc, n) => acc + n, 0);
    return {
      key: b.key,
      label: b.label,
      value: sum / b.values.length
    };
  });

  const valid = monthly.filter((m) => m.value != null).map((m) => m.value);
  const min = valid.length ? Math.min.apply(null, valid) : 0;
  const max = valid.length ? Math.max.apply(null, valid) : 1;
  const range = Math.max(max - min, 1);
  const chartHeightRpx = 150;
  const slotWidthRpx = 72;
  const chartWidthRpxNum = 12 * slotWidthRpx;
  const xPaddingRpx = slotWidthRpx / 2;
  const yPaddingRpx = 12;
  const xUsable = 11 * slotWidthRpx;
  const yUsable = chartHeightRpx - yPaddingRpx * 2;

  const bars = monthly.map((m, idx) => {
    const x = xPaddingRpx + (idx / 11) * xUsable;
    const ratio = m.value == null ? 0 : (m.value - min) / range;
    const h = m.value == null ? 0 : Math.max(6, ratio * yUsable);
    return {
      id: m.key,
      label: m.label,
      valueText: m.value == null ? '--' : `${m.value.toFixed(1)}`,
      left: `${Math.round((x - 18) * 10) / 10}rpx`,
      height: `${Math.round(h * 10) / 10}rpx`,
      isEmpty: m.value == null
    };
  });

  const points = monthly.map((m, idx) => {
    const x = xPaddingRpx + (idx / 11) * xUsable;
    const ratio = m.value == null ? null : (m.value - min) / range;
    const y = m.value == null ? null : (yPaddingRpx + (1 - ratio) * yUsable);
    return {
      id: m.key,
      label: m.label,
      valueText: m.value == null ? '--' : `${m.value.toFixed(1)}`,
      xPos: `${Math.round(x * 10) / 10}rpx`,
      yPos: y == null ? null : `${Math.round(y * 10) / 10}rpx`,
      xNum: x,
      yNum: y,
      isEmpty: m.value == null
    };
  });

  const validPoints = points.filter((p) => !p.isEmpty);
  const segments = [];
  for (let i = 1; i < validPoints.length; i += 1) {
    const p1 = validPoints[i - 1];
    const p2 = validPoints[i];
    const dx = p2.xNum - p1.xNum;
    const dy = p2.yNum - p1.yNum;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    segments.push({
      id: `${p1.id}-${p2.id}`,
      left: `${Math.round(p1.xNum * 10) / 10}rpx`,
      top: `${Math.round(p1.yNum * 10) / 10}rpx`,
      width: `${Math.round(length * 10) / 10}rpx`,
      angle: `rotate(${angle}deg)`
    });
  }

  const latest = valid.length ? valid[valid.length - 1] : null;
  const earliest = valid.length > 1 ? valid[0] : latest;
  const delta = latest != null && earliest != null ? latest - earliest : null;
  const axisTicks = [];
  for (let i = 0; i < 5; i += 1) {
    const ratio = i / 4;
    const value = max - (max - min) * ratio;
    axisTicks.push({
      id: `yt-${i}`,
      text: Number(value).toFixed(1),
      yPos: `${Math.round((yPaddingRpx + ratio * yUsable) * 10) / 10}rpx`
    });
  }

  return {
    renderMode: 'yearly',
    points,
    bars,
    segments,
    lineWidthRpx: `${chartWidthRpxNum}rpx`,
    chartHeightRpx: `${chartHeightRpx}rpx`,
    axisTicks,
    unitText: unit,
    latestText: latest == null ? '--' : `${Number(latest).toFixed(1)}`,
    deltaText: formatDelta(delta, unit),
    hasTrendData: validPoints.length >= 2,
    realDayCount: valid.length,
    carriedDayCount: 0,
    hasLeadingBlank: false
  };
}

Page({
  data: {
    hasHealthData: false,
    isLoggedIn: false,
    showBasicInfoModal: false,
    showHealthMetricsModal: false,
    isEditing: false,
    healthData: {
      gender: '',
      age: '',
      height: '',
      weight: '',
      heartRate: '',
      bloodPressure: '',
      bloodSugar: '',
      allergyHistory: '',
      activityLevel: '',
      nutritionGoal: ''
    },
    formData: {
      gender: '',
      age: '',
      height: '',
      weight: '',
      heartRate: '',
      bloodPressure: '',
      bloodSugar: '',
      allergyHistory: '',
      activityLevel: '',
      nutritionGoal: ''
    },
    activityLevelRange: ['久坐', '轻度', '中度', '高强度'],
    nutritionGoalRange: ['减重', '维持', '健康增重'],
    /** 未选择为 -1，与膳食/注册页 picker 一致 */
    activityLevelIndex: -1,
    nutritionGoalIndex: -1,
    evaluation: null,
    evaluationId: '',
    historyList: [],
    historyRawList: [],
    historyStats: {
      weightDeltaText: '--',
      bloodSugarDeltaText: '--',
      heartRateDeltaText: '--',
      recordCountText: '0条记录'
    },
    historyMetricTabs: [
      { key: 'weight', label: '体重趋势' },
      { key: 'bloodSugar', label: '血糖趋势' },
      { key: 'heartRate', label: '心率趋势' }
    ],
    historyDayRanges: [7, 30, 365],
    selectedHistoryDays: 7,
    selectedHistoryMetric: 'weight',
    historyChartPoints: [],
    historyChartSegments: [],
    historyLineWidth: '520rpx',
    historyChartHeight: '130rpx',
    historyAxisTicks: [],
    historyMetricUnit: '',
    historyLeadingHint: '',
    historyRenderMode: 'daily',
    historyYearlyBars: [],
    historyMetricLatestText: '--',
    historyMetricDeltaText: '--',
    historyTrendHint: '样本不足（至少2次记录）',
    showHistoryDetail: false,
    healthMainTab: 'data',
    heUserFilter: 'all',
    heUserListDisplay: [],
    heEduLoading: false,
    heEduHint: ''
  },

  onLoad() {
    this.loadHealthData();
  },

  onShow() {
    const scrollEval = wx.getStorageSync('healthScrollToEvaluation');
    if (scrollEval) {
      wx.removeStorageSync('healthScrollToEvaluation');
    }
    const ui = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    this.loadHealthData();
    if (ui && token && this.data.healthMainTab === 'education') {
      this.loadEducationReaderList();
    }
    // 从膳食页跳转并滚动到营养评估：若当前停在「健康教育」tab，#eval-section 未渲染，pageScrollTo 会失败（控制台常见 Error: timeout）
    if (scrollEval && ui && token) {
      const doScroll = () => {
        setTimeout(() => {
          wx.pageScrollTo({
            selector: '#eval-section',
            duration: 300,
            fail: function() {}
          });
        }, 400);
      };
      if (this.data.healthMainTab !== 'data') {
        this.setData({ healthMainTab: 'data' }, doScroll);
      } else {
        doScroll();
      }
    }
  },

  onPullDownRefresh() {
    const ui = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    if (ui && token && this.data.healthMainTab === 'education') {
      this.loadEducationReaderList().finally(() => wx.stopPullDownRefresh());
    } else {
      this.loadHealthData();
      wx.stopPullDownRefresh();
    }
  },

  switchHealthMainTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.healthMainTab) {
      return;
    }
    this.setData({ healthMainTab: tab });
    if (tab === 'education') {
      this.loadEducationReaderList();
    }
  },

  setHeUserFilter(e) {
    const v = e.currentTarget.dataset.v;
    if (!v || v === this.data.heUserFilter) {
      return;
    }
    this.setData({ heUserFilter: v });
    this.loadEducationReaderList();
  },

  formatHeReaderRow(item) {
    const s = item.updated_at ? String(item.updated_at) : '';
    const updatedAtText = s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
    const vis = item.visibility === 'assigned' ? 'assigned' : 'public';
    return Object.assign({}, item, {
      updated_at_text: updatedAtText,
      visibility: vis,
      visibilityLabel: vis === 'assigned' ? '指派' : '公开',
      dietitian_name: item.dietitian_name || ''
    });
  },

  loadEducationReaderList() {
    const ui = wx.getStorageSync('userInfo');
    if (!ui || ui.role_type !== 'user') {
      this.setData({
        heUserListDisplay: [],
        heEduLoading: false,
        heEduHint: '当前登录身份无法浏览健康教育，请使用普通用户账号。'
      });
      return Promise.resolve();
    }
    this.setData({ heEduLoading: true, heEduHint: '' });
    return api.healthEducation
      .readerList({ visibility: this.data.heUserFilter })
      .then((res) => {
        if (res.code === 200) {
          const raw = res.data || [];
          const heUserListDisplay = raw.map((x) => this.formatHeReaderRow(x));
          this.setData({ heUserListDisplay });
        } else {
          this.setData({
            heUserListDisplay: [],
            heEduHint: res.message || '加载失败'
          });
        }
      })
      .catch(() => {
        this.setData({
          heUserListDisplay: [],
          heEduHint: '网络错误，请稍后重试'
        });
      })
      .finally(() => {
        this.setData({ heEduLoading: false });
      });
  },

  openHeDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({
      url: '/pages/user/health/education-detail/index?id=' + encodeURIComponent(id)
    });
  },

  loadHealthData() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    
    console.log('loadHealthData - userInfo:', userInfo);
    console.log('loadHealthData - token:', token);
    console.log('loadHealthData - hasHealthData:', this.data.hasHealthData);
    
    if (!userInfo || !token) {
      console.log('loadHealthData - 未登录');
      this.setData({
        hasHealthData: false,
        isLoggedIn: false,
        evaluation: null,
        evaluationId: '',
        healthMainTab: 'data',
        heUserListDisplay: [],
        heEduHint: '',
        'healthData.activityLevel': '',
        'healthData.nutritionGoal': '',
        activityLevelIndex: -1,
        nutritionGoalIndex: -1
      });
      return;
    }
    
    console.log('loadHealthData - 已登录');
    this.setData({
      isLoggedIn: true
    });
    
    if (userInfo) {
      this.setData({
        'healthData.gender': userInfo.gender || '',
        'healthData.age': userInfo.age || ''
      });
    }

    this.loadLatestHealthData();
    this.loadHistory();
    this.loadEvaluation();
  },

  loadLatestHealthData() {
    wx.showLoading({ title: '加载中...' });
    api.healthData.getLatest().then(res => {
      wx.hideLoading();
      if (res.code === 200 && res.data) {
        const data = res.data;
        const activityLevel = (data.activity_level && String(data.activity_level).trim()) || '';
        const nutritionGoal = (data.nutrition_goal && String(data.nutrition_goal).trim()) || '';
        const activityLevelIndex = mapActivityToIndex(activityLevel);
        const nutritionGoalIndex = mapNutritionToIndex(nutritionGoal);
        
        this.setData({
          healthData: {
            data_id: data.data_id || '',
            gender: displayGender(data.gender) || '',
            age: data.age != null && data.age !== '' ? data.age : '',
            height: data.height || '',
            weight: data.weight || '',
            heartRate: data.heart_rate || '',
            bloodPressure: data.blood_pressure || '',
            bloodSugar: data.blood_sugar || '',
            allergyHistory: data.allergy_history || '',
            activityLevel: activityLevel,
            nutritionGoal: nutritionGoal
          },
          activityLevelIndex: activityLevelIndex,
          nutritionGoalIndex: nutritionGoalIndex,
          hasHealthData: true
        });
        wx.setStorageSync('cachedHealthData', this.data.healthData);
      } else {
        console.log('暂无健康数据，设置hasHealthData为false');
        this.setData({
          hasHealthData: false,
          'healthData.activityLevel': '',
          'healthData.nutritionGoal': '',
          activityLevelIndex: -1,
          nutritionGoalIndex: -1
        });
        const cachedHealthData = wx.getStorageSync('cachedHealthData');
        if (cachedHealthData) {
          const merged = { ...this.data.healthData, ...cachedHealthData };
          this.setData({
            healthData: merged,
            hasHealthData: true,
            activityLevelIndex: mapActivityToIndex(merged.activityLevel),
            nutritionGoalIndex: mapNutritionToIndex(merged.nutritionGoal)
          });
        }
      }
    }).catch(err => {
      wx.hideLoading();
      console.log('获取健康数据失败', err);
      console.log('错误状态码:', err.statusCode);
      console.log('错误数据:', err.data);
      
      // 如果是400错误（暂无健康数据），这是正常的
      if (err.statusCode === 400 && err.data && err.data.message === '暂无健康数据') {
        console.log('暂无健康数据，设置hasHealthData为false');
        this.setData({
          hasHealthData: false,
          'healthData.activityLevel': '',
          'healthData.nutritionGoal': '',
          activityLevelIndex: -1,
          nutritionGoalIndex: -1
        });
      } else {
        // 其他错误，尝试使用缓存数据
        const cachedHealthData = wx.getStorageSync('cachedHealthData');
        if (cachedHealthData) {
          const merged = { ...this.data.healthData, ...cachedHealthData };
          this.setData({
            healthData: merged,
            hasHealthData: true,
            activityLevelIndex: mapActivityToIndex(merged.activityLevel),
            nutritionGoalIndex: mapNutritionToIndex(merged.nutritionGoal)
          });
        } else {
          this.setData({
            hasHealthData: false,
            'healthData.activityLevel': '',
            'healthData.nutritionGoal': '',
            activityLevelIndex: -1,
            nutritionGoalIndex: -1
          });
        }
      }
    });
  },

  loadHistory() {
    api.healthData.getHistory().then(res => {
      if (res.code === 200 && Array.isArray(res.data)) {
        const historyRawList = res.data.slice(0, 180).map(item => ({
          id: item.history_id || item.data_id,
          date: item.snapshot_at ? String(item.snapshot_at).slice(0, 10) : (item.created_at ? String(item.created_at).slice(0, 10) : ''),
          snapshotAt: item.snapshot_at || item.created_at || '',
          height: item.height || 0,
          weight: item.weight || 0,
          bloodSugar: item.blood_sugar || 0,
          heartRate: item.heart_rate || 0,
          activityLevelText: activityLevelText(item.activity_level)
        }));
        const historyDailyList = aggregateLatestByDay(historyRawList);
        const recentRows = filterRowsByRecentDays(historyDailyList, this.data.selectedHistoryDays);
        const historyList = recentRows.slice(0, 8);
        const stats = this.buildHistoryStats(recentRows);
        const visual = this.data.selectedHistoryDays === 365
          ? buildYearlyVisualModel(historyDailyList, this.data.selectedHistoryMetric)
          : buildHistoryVisualModel(historyDailyList, this.data.selectedHistoryMetric, this.data.selectedHistoryDays);
        this.setData({
          historyRawList,
          historyList,
          historyStats: stats,
          historyChartPoints: visual.points,
          historyChartSegments: visual.segments,
          historyLineWidth: visual.lineWidthRpx,
          historyChartHeight: visual.chartHeightRpx,
          historyAxisTicks: visual.axisTicks,
          historyMetricUnit: visual.unitText || '',
          historyLeadingHint: visual.hasLeadingBlank ? '在此之前尚无记录' : '',
          historyRenderMode: visual.renderMode || 'daily',
          historyYearlyBars: visual.bars || [],
          historyMetricLatestText: visual.latestText,
          historyMetricDeltaText: visual.deltaText,
          historyTrendHint: visual.hasTrendData
            ? `最近${this.data.selectedHistoryDays}天（实测${visual.realDayCount}天，补值${visual.carriedDayCount}天）`
            : `样本不足（最近${this.data.selectedHistoryDays}天至少2天有记录）`
        });
        wx.setStorageSync('healthHistory', historyRawList);
      } else {
        this.setData({
          historyRawList: [],
          historyList: [],
          historyChartPoints: [],
          historyChartSegments: [],
          historyLineWidth: '520rpx',
          historyChartHeight: '130rpx',
          historyAxisTicks: [],
          historyMetricUnit: '',
          historyLeadingHint: '',
          historyRenderMode: 'daily',
          historyYearlyBars: [],
          historyMetricLatestText: '--',
          historyMetricDeltaText: '--',
          historyTrendHint: '暂无历史记录',
          historyStats: {
            weightDeltaText: '--',
            bloodSugarDeltaText: '--',
            heartRateDeltaText: '--',
            recordCountText: '0条记录'
          }
        });
      }
    }).catch(err => {
      console.log('获取历史记录失败', err);
      const historyRawList = wx.getStorageSync('healthHistory') || [];
      const historyDailyList = aggregateLatestByDay(historyRawList);
      const recentRows = filterRowsByRecentDays(historyDailyList, this.data.selectedHistoryDays);
      const historyList = recentRows.slice(0, 8);
      const stats = this.buildHistoryStats(recentRows);
      const visual = this.data.selectedHistoryDays === 365
        ? buildYearlyVisualModel(historyDailyList, this.data.selectedHistoryMetric)
        : buildHistoryVisualModel(historyDailyList, this.data.selectedHistoryMetric, this.data.selectedHistoryDays);
      this.setData({
        historyRawList,
        historyList,
        historyStats: stats,
        historyChartPoints: visual.points,
        historyChartSegments: visual.segments,
        historyLineWidth: visual.lineWidthRpx,
        historyChartHeight: visual.chartHeightRpx,
        historyAxisTicks: visual.axisTicks,
        historyMetricUnit: visual.unitText || '',
        historyLeadingHint: visual.hasLeadingBlank ? '在此之前尚无记录' : '',
        historyRenderMode: visual.renderMode || 'daily',
        historyYearlyBars: visual.bars || [],
        historyMetricLatestText: visual.latestText,
        historyMetricDeltaText: visual.deltaText,
        historyTrendHint: visual.hasTrendData
          ? `最近${this.data.selectedHistoryDays}天（实测${visual.realDayCount}天，补值${visual.carriedDayCount}天）`
          : `样本不足（最近${this.data.selectedHistoryDays}天至少2天有记录）`
      });
    });
  },

  buildHistoryStats(historyRawList) {
    const items = Array.isArray(historyRawList) ? historyRawList : [];
    const count = items.length;
    const latest = count ? items[0] : null;
    const baseline = count > 1 ? items[count - 1] : latest;
    const weightDelta = latest && baseline ? calcDelta(latest.weight, baseline.weight) : null;
    const bloodSugarDelta = latest && baseline ? calcDelta(latest.bloodSugar, baseline.bloodSugar) : null;
    const heartRateDelta = latest && baseline ? calcDelta(latest.heartRate, baseline.heartRate) : null;
    return {
      weightDeltaText: formatDelta(weightDelta, 'kg'),
      bloodSugarDeltaText: formatDelta(bloodSugarDelta, 'mmol/L'),
      heartRateDeltaText: formatDelta(heartRateDelta, '次/分'),
      recordCountText: `${count}条记录`
    };
  },

  switchHistoryMetric(e) {
    const metric = e.currentTarget.dataset.metric;
    if (!metric || metric === this.data.selectedHistoryMetric) {
      return;
    }
    const historyDailyList = aggregateLatestByDay(this.data.historyRawList);
    const visual = this.data.selectedHistoryDays === 365
      ? buildYearlyVisualModel(historyDailyList, metric)
      : buildHistoryVisualModel(historyDailyList, metric, this.data.selectedHistoryDays);
    this.setData({
      selectedHistoryMetric: metric,
      historyChartPoints: visual.points,
      historyChartSegments: visual.segments,
      historyLineWidth: visual.lineWidthRpx,
      historyChartHeight: visual.chartHeightRpx,
      historyAxisTicks: visual.axisTicks,
      historyMetricUnit: visual.unitText || '',
      historyLeadingHint: visual.hasLeadingBlank ? '在此之前尚无记录' : '',
      historyRenderMode: visual.renderMode || 'daily',
      historyYearlyBars: visual.bars || [],
      historyMetricLatestText: visual.latestText,
      historyMetricDeltaText: visual.deltaText,
      historyTrendHint: visual.hasTrendData
        ? `最近${this.data.selectedHistoryDays}天（实测${visual.realDayCount}天，补值${visual.carriedDayCount}天）`
        : `样本不足（最近${this.data.selectedHistoryDays}天至少2天有记录）`
    });
  },

  switchHistoryDayRange(e) {
    const days = Number(e.currentTarget.dataset.days);
    if (!days || days === this.data.selectedHistoryDays) {
      return;
    }
    const historyDailyList = aggregateLatestByDay(this.data.historyRawList);
    const recentRows = filterRowsByRecentDays(historyDailyList, days);
    const historyList = recentRows.slice(0, 8);
    const stats = this.buildHistoryStats(recentRows);
    const visual = days === 365
      ? buildYearlyVisualModel(historyDailyList, this.data.selectedHistoryMetric)
      : buildHistoryVisualModel(historyDailyList, this.data.selectedHistoryMetric, days);
    this.setData({
      selectedHistoryDays: days,
      historyList,
      historyStats: stats,
      historyChartPoints: visual.points,
      historyChartSegments: visual.segments,
      historyLineWidth: visual.lineWidthRpx,
      historyChartHeight: visual.chartHeightRpx,
      historyAxisTicks: visual.axisTicks,
      historyMetricUnit: visual.unitText || '',
      historyLeadingHint: visual.hasLeadingBlank ? '在此之前尚无记录' : '',
      historyRenderMode: visual.renderMode || 'daily',
      historyYearlyBars: visual.bars || [],
      historyMetricLatestText: visual.latestText,
      historyMetricDeltaText: visual.deltaText,
      historyTrendHint: visual.hasTrendData
        ? `最近${days}天（实测${visual.realDayCount}天，补值${visual.carriedDayCount}天）`
        : `样本不足（最近${days}天至少2天有记录）`
    });
  },

  toggleHistoryDetail() {
    this.setData({ showHistoryDetail: !this.data.showHistoryDetail });
  },

  loadEvaluation() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ evaluation: null, evaluationId: '' });
      return;
    }
    api.evaluation
      .getUserEvaluations(10)
      .then((res) => {
        if (res.code !== 200 && res.code !== '200') {
          this.setData({ evaluation: null, evaluationId: '' });
          return;
        }
        const list = Array.isArray(res.data) ? res.data : [];
        if (!list.length) {
          this.setData({ evaluation: null, evaluationId: '' });
          return;
        }
        const ev = list[0];
        const expired = evaluationExpired(ev);
        const card = {
          status: expired ? 'expired' : 'completed',
          statusText: expired ? '已过期' : '最新',
          evalTime: formatEvalDateTime(ev.created_at),
          bmi: ev.bmi != null && ev.bmi !== '' ? String(ev.bmi) : '—',
          nutritionStatus: nutritionStatusLabel(ev.nutrition_status),
          suggestion: (ev.professional_conclusion || '—').slice(0, 220)
        };
        this.setData({
          evaluation: card,
          evaluationId: ev.evaluation_id || ''
        });
      })
      .catch(() => {
        this.setData({ evaluation: null, evaluationId: '' });
      });
  },

  editBasicInfo() {
    const h = this.data.healthData;
    this.setData({
      showBasicInfoModal: true,
      isEditing: this.data.hasHealthData,
      formData: { ...h },
      activityLevelIndex: mapActivityToIndex(h.activityLevel),
      nutritionGoalIndex: mapNutritionToIndex(h.nutritionGoal)
    });
  },

  hideBasicInfoModal() {
    this.setData({ showBasicInfoModal: false });
  },

  editHealthMetrics() {
    this.setData({
      showHealthMetricsModal: true,
      isEditing: this.data.hasHealthData,
      formData: { ...this.data.healthData }
    });
  },

  hideHealthMetricsModal() {
    this.setData({ showHealthMetricsModal: false });
  },

  bindHeightInput(e) {
    this.setData({ 'formData.height': e.detail.value });
  },

  bindWeightInput(e) {
    this.setData({ 'formData.weight': e.detail.value });
  },

  bindHeartRateInput(e) {
    this.setData({ 'formData.heartRate': e.detail.value });
  },

  bindBloodPressureInput(e) {
    this.setData({ 'formData.bloodPressure': e.detail.value });
  },

  bindBloodSugarInput(e) {
    this.setData({ 'formData.bloodSugar': e.detail.value });
  },

  bindAllergyInput(e) {
    this.setData({ 'formData.allergyHistory': e.detail.value });
  },

  bindGenderChange(e) {
    this.setData({ 'formData.gender': e.detail.value });
  },

  bindAgeInput(e) {
    this.setData({ 'formData.age': e.detail.value });
  },

  toggleGender() {
    const newGender = this.data.formData.gender === '男' ? '女' : '男';
    this.setData({ 'formData.gender': newGender });
  },

  changeActivityLevel(e) {
    const index = parseInt(e.detail.value, 10);
    const activityLevels = ['sedentary', 'lightly_active', 'moderately_active', 'very_active'];
    const activityLevel = activityLevels[index];
    this.setData({ 
      activityLevelIndex: index,
      'formData.activityLevel': activityLevel
    });
  },

  changeNutritionGoal(e) {
    const index = parseInt(e.detail.value, 10);
    const nutritionGoals = ['lose_weight', 'maintain', 'healthy_gain'];
    const nutritionGoal = nutritionGoals[index];
    this.setData({ 
      nutritionGoalIndex: index,
      'formData.nutritionGoal': nutritionGoal
    });
  },

  saveBasicInfo() {
    const { gender, age, activityLevel, nutritionGoal } = this.data.formData;
    const ageNum = parseInteger(age);
    const genderText = cleanText(gender);

    if (!genderText) {
      wx.showToast({ title: '请选择性别', icon: 'none' });
      return;
    }
    if (genderText !== '男' && genderText !== '女') {
      wx.showToast({ title: '性别仅支持男/女', icon: 'none' });
      return;
    }
    if (ageNum == null) {
      wx.showToast({ title: '年龄需为整数', icon: 'none' });
      return;
    }
    if (ageNum < 1 || ageNum > 120) {
      wx.showToast({ title: '年龄需在1-120岁', icon: 'none' });
      return;
    }
    if (!activityLevel) {
      wx.showToast({ title: '请选择活动水平', icon: 'none' });
      return;
    }
    if (!nutritionGoal) {
      wx.showToast({ title: '请选择营养目标', icon: 'none' });
      return;
    }

    const requestPayload = {
      gender: backendGender(genderText),
      age: ageNum,
      activity_level: activityLevel,
      nutrition_goal: nutritionGoal
    };

    wx.showLoading({ title: '保存中...' });

    api.healthData.saveBasicInfo(requestPayload).then(res => {
      wx.hideLoading();
      if (res.code === 200) {
        this.handleBasicInfoSaveSuccess(res.data);
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.log('保存失败', err);
      const msg = err.data && err.data.message ? err.data.message : '保存失败';
      wx.showToast({ title: msg, icon: 'none' });
    });
  },

  saveHealthMetrics() {
    const { height, weight, heartRate, bloodPressure, bloodSugar, allergyHistory } = this.data.formData;
    const heightNum = parseDecimal(height);
    const weightNum = parseDecimal(weight);
    const heartRateText = cleanText(heartRate);
    const bloodSugarText = cleanText(bloodSugar);
    const allergyText = cleanText(allergyHistory);
    const heartRateNum = heartRateText ? parseInteger(heartRateText) : null;
    const bloodSugarNum = bloodSugarText ? parseDecimal(bloodSugarText) : null;
    const bp = parseBloodPressure(bloodPressure);
    const baseGender = backendGender(this.data.healthData.gender);
    const baseAge = parseInteger(this.data.healthData.age);

    if (heightNum == null) {
      wx.showToast({ title: '请输入有效身高', icon: 'none' });
      return;
    }
    if (heightNum < 50 || heightNum > 250) {
      wx.showToast({ title: '身高需在50-250cm', icon: 'none' });
      return;
    }
    if (weightNum == null) {
      wx.showToast({ title: '请输入有效体重', icon: 'none' });
      return;
    }
    if (weightNum < 20 || weightNum > 300) {
      wx.showToast({ title: '体重需在20-300kg', icon: 'none' });
      return;
    }
    if (heartRateText && heartRateNum == null) {
      wx.showToast({ title: '心率需为整数', icon: 'none' });
      return;
    }
    if (heartRateNum != null && (heartRateNum < 30 || heartRateNum > 220)) {
      wx.showToast({ title: '心率需在30-220次/分', icon: 'none' });
      return;
    }
    if (!bp.ok) {
      wx.showToast({ title: bp.message, icon: 'none' });
      return;
    }
    if (bloodSugarText && bloodSugarNum == null) {
      wx.showToast({ title: '血糖需为数字', icon: 'none' });
      return;
    }
    if (bloodSugarNum != null && (bloodSugarNum < 2 || bloodSugarNum > 33.3)) {
      wx.showToast({ title: '血糖值请填写在2-33.3', icon: 'none' });
      return;
    }
    if (allergyText.length > 200) {
      wx.showToast({ title: '过敏病史最多200字', icon: 'none' });
      return;
    }

    if (!baseGender || baseAge == null || baseAge < 1) {
      wx.showToast({ title: '请先完善基本信息', icon: 'none' });
      return;
    }

    // 构建完整的请求数据，包含所有字段
    const requestData = {
      ...this.data.healthData,
      gender: baseGender,
      age: baseAge,
      height: heightNum,
      weight: weightNum,
      heart_rate: heartRateNum || 0,
      blood_pressure: bp.text,
      blood_sugar: bloodSugarNum || 0,
      allergy_history: allergyText
    };

    // 移除不需要的字段
    delete requestData.data_id;

    wx.showLoading({ title: '保存中...' });

    if (this.data.isEditing) {
      api.healthData.update(this.data.healthData.data_id || '', requestData).then(res => {
        wx.hideLoading();
        if (res.code === 200) {
          this.handleHealthMetricsSaveSuccess();
        } else {
          wx.showToast({ title: res.message || '更新失败', icon: 'none' });
        }
      }).catch(err => {
        wx.hideLoading();
        console.log('更新失败', err);
        wx.showToast({ title: '更新失败', icon: 'none' });
      });
    } else {
      api.healthData.submit(requestData).then(res => {
        wx.hideLoading();
        if (res.code === 200) {
          this.handleHealthMetricsSaveSuccess();
        } else {
          wx.showToast({ title: res.message || '保存失败', icon: 'none' });
        }
      }).catch(err => {
        wx.hideLoading();
        console.log('保存失败', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
    }
  },

  handleBasicInfoSaveSuccess(serverRow) {
    const d = serverRow && typeof serverRow === 'object' ? serverRow : {};
    const activityLevel = (d.activity_level && String(d.activity_level).trim()) || this.data.formData.activityLevel || '';
    const nutritionGoal = (d.nutrition_goal && String(d.nutrition_goal).trim()) || this.data.formData.nutritionGoal || '';

    const healthData = {
      ...this.data.healthData,
      ...this.data.formData,
      data_id: d.data_id || this.data.healthData.data_id || '',
      gender: displayGender(d.gender) || this.data.formData.gender || '',
      age: d.age != null && d.age !== '' ? d.age : this.data.formData.age,
      height: d.height != null && d.height !== '' ? d.height : this.data.healthData.height,
      weight: d.weight != null && d.weight !== '' ? d.weight : this.data.healthData.weight,
      heartRate: d.heart_rate != null && d.heart_rate !== '' ? d.heart_rate : this.data.healthData.heartRate,
      bloodPressure: d.blood_pressure != null && d.blood_pressure !== '' ? d.blood_pressure : this.data.healthData.bloodPressure,
      bloodSugar: d.blood_sugar != null && d.blood_sugar !== '' ? d.blood_sugar : this.data.healthData.bloodSugar,
      allergyHistory: d.allergy_history != null && d.allergy_history !== '' ? d.allergy_history : this.data.healthData.allergyHistory,
      activityLevel,
      nutritionGoal
    };

    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && typeof userInfo === 'object') {
      userInfo.gender = d.gender || backendGender(healthData.gender) || userInfo.gender;
      userInfo.age = d.age != null && d.age !== '' ? d.age : userInfo.age;
      wx.setStorageSync('userInfo', userInfo);
    }

    wx.setStorageSync('cachedHealthData', healthData);

    this.setData({
      healthData,
      hasHealthData: true,
      showBasicInfoModal: false,
      activityLevelIndex: mapActivityToIndex(healthData.activityLevel),
      nutritionGoalIndex: mapNutritionToIndex(healthData.nutritionGoal)
    });

    wx.showToast({ title: '保存成功', icon: 'success' });

    setTimeout(() => {
      this.loadHealthData();
    }, 1000);
  },

  handleHealthMetricsSaveSuccess() {
    const healthData = {
      ...this.data.healthData,
      ...this.data.formData
    };

    wx.setStorageSync('cachedHealthData', healthData);

    const history = wx.getStorageSync('healthHistory') || [];
    history.unshift({
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      height: this.data.formData.height,
      weight: this.data.formData.weight
    });
    wx.setStorageSync('healthHistory', history.slice(0, 30));

    this.setData({
      healthData,
      hasHealthData: true,
      showHealthMetricsModal: false
    });

    wx.showToast({ title: '保存成功', icon: 'success' });

    setTimeout(() => {
      this.loadHealthData();
    }, 1000);
  },

  viewEvaluation() {
    const id = this.data.evaluationId;
    if (!id) {
      wx.showToast({ title: '暂无专业营养评估', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/user/health/evaluation-detail/index?id=' + encodeURIComponent(id)
    });
  },

  gotoLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/login'
    });
  }
});