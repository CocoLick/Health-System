// home/index.js
const api = require('../../utils/api');

const STORAGE_INBOX_DISMISSED = 'inboxDismissedIds';
const STORAGE_INBOX_PENDING_DISMISS = 'inboxPendingDismissId';

Page({
  data: {
    isLoggedIn: false,
    userInfo: {},
    displayName: 'cocolike',
    greetingText: '你好',
    today: '',
    todayIntake: {
      calories: 0,
      protein: 0,
      fat: 0,
      carbohydrate: 0
    },
    targets: {
      calories: 2000,
      protein: 90,
      fat: 60,
      carbohydrate: 260
    },
    metricProgress: {
      calories: 0,
      protein: 0,
      fat: 0,
      carbohydrate: 0
    },
    remaining: {
      calories: 0,
      protein: 0
    },
    waterIntake: 0,
    waterTarget: 2000,
    waterProgress: 0,
    showWaterDrop: false,
    exerciseDone: false,
    currentPlan: null,
    recommendedRecipes: [
      { id: 'rec-1', title: '低脂鸡胸沙拉', kcal: 420, tag: '高蛋白' },
      { id: 'rec-2', title: '燕麦酸奶碗', kcal: 350, tag: '早餐' },
      { id: 'rec-3', title: '番茄牛肉意面', kcal: 510, tag: '均衡' },
      { id: 'rec-4', title: '三文鱼藜麦饭', kcal: 470, tag: '优质脂肪' }
    ],
    healthTips: [
      { key: 'water', title: '多喝水', desc: '每次点击 +250ml，目标 2000ml' },
      { key: 'exercise', title: '适量运动', desc: '完成今日 30 分钟活动打卡' }
    ],
    ingredientShortcut: null,
    inboxMessages: [],
    inboxLoading: false
  },

  onLoad() {
    if (!this.checkLogin()) {
      return;
    }
    this.loadData();
  },

  onShow() {
    if (!this.checkLogin()) {
      return;
    }
    this.loadData();
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    const isLoggedIn = !!(userInfo && token);
    this.setData({ isLoggedIn });
    return isLoggedIn;
  },

  /**
   * 与营养页一致：接口返回 total_*，本地缓存可能为 calories 等
   */
  sumRecordTotals(records) {
    const t = { calories: 0, protein: 0, fat: 0, carbohydrate: 0 };
    (records || []).forEach((record) => {
      const c = record.total_calories != null ? record.total_calories : record.calories;
      const p = record.total_protein != null ? record.total_protein : record.protein;
      const f = record.total_fat != null ? record.total_fat : record.fat;
      const cb = record.total_carbohydrate != null ? record.total_carbohydrate : record.carbohydrate;
      t.calories += Number(c) || 0;
      t.protein += Number(p) || 0;
      t.fat += Number(f) || 0;
      t.carbohydrate += Number(cb) || 0;
    });
    return {
      calories: Math.round(t.calories * 10) / 10,
      protein: Math.round(t.protein * 10) / 10,
      fat: Math.round(t.fat * 10) / 10,
      carbohydrate: Math.round(t.carbohydrate * 10) / 10
    };
  },

  loadData() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const currentPlan = wx.getStorageSync('currentDietPlan');
    const waterIntake = wx.getStorageSync('homeWaterIntake') || 0;
    const exerciseDone = !!wx.getStorageSync('homeExerciseDone');

    const displayName = userInfo.username || 'cocolike';
    const greetingText = this.getGreetingText();
    const today = this.getTodayText();
    const targets = this.getTargets(currentPlan);
    const waterProgress = targets ? Math.min((waterIntake / 2000) * 100, 100) : 0;

    const applyTotals = (totals) => {
      const r1 = (x) => Math.round((Number(x) || 0) * 10) / 10;
      const metricProgress = this.getMetricProgress(totals, targets);
      const remaining = {
        calories: r1(Math.max((targets.calories || 0) - (totals.calories || 0), 0)),
        protein: r1(Math.max((targets.protein || 0) - (totals.protein || 0), 0))
      };
      const intake = {
        calories: r1(totals.calories),
        protein: r1(totals.protein),
        fat: r1(totals.fat),
        carbohydrate: r1(totals.carbohydrate)
      };
      this.setData({
        userInfo,
        displayName,
        greetingText,
        today,
        todayIntake: intake,
        targets,
        metricProgress,
        remaining,
        waterIntake,
        waterProgress,
        exerciseDone,
        currentPlan
      });
    };

    const fromCache = () => {
      const todayRecords = wx.getStorageSync('todayNutritionRecords') || [];
      return this.sumRecordTotals(todayRecords);
    };

    api.nutrition
      .getTodayRecords()
      .then((res) => {
        if (res && res.code === 200 && res.data != null) {
          const records = res.data || [];
          wx.setStorageSync('todayNutritionRecords', records);
          applyTotals(this.sumRecordTotals(records));
        } else {
          applyTotals(fromCache());
        }
      })
      .catch(() => {
        applyTotals(fromCache());
      });

    this.loadIngredientShortcut();
    this.loadInboxMessages();
  },

  flushInboxPendingDismiss() {
    const pending = wx.getStorageSync(STORAGE_INBOX_PENDING_DISMISS);
    if (!pending) return;
    let dismissed = wx.getStorageSync(STORAGE_INBOX_DISMISSED) || [];
    if (!dismissed.includes(pending)) {
      dismissed.push(pending);
      if (dismissed.length > 200) {
        dismissed = dismissed.slice(-200);
      }
      wx.setStorageSync(STORAGE_INBOX_DISMISSED, dismissed);
    }
    wx.removeStorageSync(STORAGE_INBOX_PENDING_DISMISS);
  },

  filterInboxByDismissed(mapped) {
    const dismissed = wx.getStorageSync(STORAGE_INBOX_DISMISSED) || [];
    if (!dismissed.length) return mapped;
    return mapped.filter((it) => it.id && !dismissed.includes(it.id));
  },

  loadInboxMessages() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ inboxMessages: [], inboxLoading: false });
      return;
    }
    this.flushInboxPendingDismiss();
    this.setData({ inboxLoading: true });
    api.inbox
      .getMessages(30)
      .then((res) => {
        const items =
          res && res.code === 200 && res.data && Array.isArray(res.data.items)
            ? res.data.items
            : [];
        const mapped = items.map((it) =>
          Object.assign({}, it, {
            timeText: this.formatInboxTime(it.time)
          })
        );
        const visible = this.filterInboxByDismissed(mapped);
        this.setData({ inboxMessages: visible, inboxLoading: false });
      })
      .catch(() => {
        this.setData({ inboxMessages: [], inboxLoading: false });
      });
  },

  formatInboxTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace('T', ' ');
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  },

  openInboxMessage(e) {
    const type = e.currentTarget.dataset.type;
    const refRaw = e.currentTarget.dataset.refId || '';
    if (!type) return;
    const msgId = e.currentTarget.dataset.msgId || '';
    if (msgId) {
      wx.setStorageSync(STORAGE_INBOX_PENDING_DISMISS, msgId);
    }
    const ref = refRaw ? encodeURIComponent(refRaw) : '';
    switch (type) {
      case 'nutrition_evaluation':
        wx.navigateTo({
          url: `/pages/user/health/evaluation-detail/index?id=${ref}`
        });
        return;
      case 'health_education_assigned':
        wx.navigateTo({
          url: `/pages/user/health/education-detail/index?id=${ref}`
        });
        return;
      case 'service_request_approved':
      case 'service_request_rejected':
        wx.navigateTo({ url: '/pages/user/dietitian/requests/index' });
        return;
      case 'diet_plan_pending_review':
      case 'diet_plan_approved':
      case 'diet_plan_rejected':
        wx.switchTab({ url: '/pages/user/diet/diet-plan/index' });
        return;
      default:
        break;
    }
  },

  loadIngredientShortcut() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ ingredientShortcut: null });
      return;
    }
    api.ingredient
      .getMySubmissions({ workflow_status: 'approved', page: 1, page_size: 50 })
      .then((res) => {
        if (!res || res.code !== 200 || !res.data || !res.data.items) {
          this.setData({ ingredientShortcut: null });
          return;
        }
        const dismissed = wx.getStorageSync('ingredientShortcutDismissedIds') || [];
        const recorded = wx.getStorageSync('ingredientShortcutRecordedIds') || [];
        const items = res.data.items.filter(
          (it) =>
            it.workflow_status === 'approved' &&
            (it.ingredient_id_private || '').trim() &&
            !dismissed.includes(it.submission_id) &&
            !recorded.includes(it.submission_id)
        );
        items.sort((a, b) => {
          const tb = new Date(b.updated_at || b.created_at).getTime();
          const ta = new Date(a.updated_at || a.created_at).getTime();
          return tb - ta;
        });
        this.setData({ ingredientShortcut: items[0] || null });
      })
      .catch(() => this.setData({ ingredientShortcut: null }));
  },

  dismissIngredientShortcut() {
    const cur = this.data.ingredientShortcut;
    if (!cur || !cur.submission_id) return;
    const dismissed = wx.getStorageSync('ingredientShortcutDismissedIds') || [];
    if (!dismissed.includes(cur.submission_id)) {
      dismissed.push(cur.submission_id);
      wx.setStorageSync('ingredientShortcutDismissedIds', dismissed);
    }
    this.setData({ ingredientShortcut: null });
    this.loadIngredientShortcut();
  },

  goRecordApprovedIngredient() {
    const cur = this.data.ingredientShortcut;
    if (!cur || !(cur.ingredient_id_private || '').trim()) return;
    const ing = encodeURIComponent(cur.ingredient_id_private.trim());
    const sub = encodeURIComponent((cur.submission_id || '').trim());
    const nm = encodeURIComponent((cur.submitted_name || '').trim());
    wx.navigateTo({
      url: `/pages/user/diet/add-record/index?ingredient_id=${ing}&submission_id=${sub}&shortcut_food_name=${nm}`
    });
  },

  getGreetingText() {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 11) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  },

  getTodayText() {
    const date = new Date();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  },

  /** 展示用：保留一位小数 */
  roundDisplay1(v) {
    return Math.round((Number(v) || 0) * 10) / 10;
  },

  getTargets(currentPlan) {
    return {
      calories: this.roundDisplay1((currentPlan && Number(currentPlan.calories)) || 2000),
      protein: this.roundDisplay1((currentPlan && Number(currentPlan.protein)) || 90),
      fat: this.roundDisplay1((currentPlan && Number(currentPlan.fat)) || 60),
      carbohydrate: this.roundDisplay1((currentPlan && Number(currentPlan.carbohydrate)) || 260)
    };
  },

  getMetricProgress(intake, targets) {
    const pct = (value, total) => {
      if (!total) return 0;
      return Math.min(Math.round((value / total) * 100), 100);
    };
    return {
      calories: pct(intake.calories, targets.calories),
      protein: pct(intake.protein, targets.protein),
      fat: pct(intake.fat, targets.fat),
      carbohydrate: pct(intake.carbohydrate, targets.carbohydrate)
    };
  },

  addWaterIntake() {
    const next = Math.min((this.data.waterIntake || 0) + 250, 2000);
    const waterProgress = Math.min((next / 2000) * 100, 100);
    this.setData({
      waterIntake: next,
      waterProgress,
      showWaterDrop: true
    });
    wx.setStorageSync('homeWaterIntake', next);
    setTimeout(() => this.setData({ showWaterDrop: false }), 420);
  },

  toggleExerciseDone() {
    const next = !this.data.exerciseDone;
    this.setData({ exerciseDone: next });
    wx.setStorageSync('homeExerciseDone', next);
  },

  goToNutrition() {
    wx.switchTab({ url: '/pages/user/diet/nutrition/index' });
  },

  goToDietPlan() {
    wx.switchTab({ url: '/pages/user/diet/diet-plan/index' });
  },

  goToHealth() {
    wx.switchTab({ url: '/pages/user/health/index' });
  },

  goToProfile() {
    wx.switchTab({ url: '/pages/user/profile/index' });
  },

  viewPlanDetail() {
    wx.switchTab({ url: '/pages/user/diet/diet-plan/index' });
  },

  requestAiPlan() {
    wx.switchTab({ url: '/pages/user/diet/diet-plan/index' });
  },

  goToSelectDietitian() {
    wx.navigateTo({ url: '/pages/user/dietitian/select/index' });
  },

  gotoLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/login'
    });
  }
});