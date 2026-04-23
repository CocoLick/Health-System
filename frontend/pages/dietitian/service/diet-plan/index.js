// dietitian/service/diet-plan/index.js
const api = require('../../../../utils/api');

function activityTextHint(level) {
  const m = {
    sedentary: '久坐少动',
    lightly_active: '轻度活动',
    moderately_active: '中度活动',
    very_active: '高强度活动'
  };
  return m[level] || level || '—';
}

/** 将 /change-summary 转为弹窗内简短说明（此前仅拼体重，易误以为只有体重会参与优化） */
function formatOptimizeChangeHint(resData) {
  if (!resData) {
    return '';
  }
  const d = resData.delta || {};
  const insuff = resData.insufficient_sample;
  const parts = [];
  if (insuff) {
    parts.push('历史记录较少，差值仅作参考');
  }
  if (typeof d.weight === 'number') {
    const sign = d.weight > 0 ? '+' : '';
    parts.push(`体重较基线${sign}${d.weight}kg`);
  }
  if (typeof d.blood_sugar === 'number') {
    const sign = d.blood_sugar > 0 ? '+' : '';
    parts.push(`血糖较基线约${sign}${d.blood_sugar}`);
  }
  if (typeof d.bmi === 'number') {
    const sign = d.bmi > 0 ? '+' : '';
    parts.push(`BMI 较基线约${sign}${d.bmi}`);
  }
  if (d.activity_changed) {
    const a = activityTextHint(d.activity_from);
    const b = activityTextHint(d.activity_to);
    parts.push(`活动水平：${a} → ${b}`);
  }
  if (parts.length === 0) {
    return '已拉取身体变化（与基线比较）';
  }
  return `${parts.join('；')}。大模型端使用接口返回的完整 JSON，不限于上列简短提示。`;
}

/** 将优化概要拆成多段+多条，供自定义弹层分点展示 */
function parseOptimizationSummaryForView(raw) {
  const full = raw && String(raw).trim();
  const usedFallback = !full;
  const t = usedFallback
    ? '已根据身体数据与反馈生成一版配餐草案，请审阅各日配餐后保存。'
    : full.length > 3200
      ? `${full.slice(0, 3200)}…`
      : full;
  const chunks = t.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (chunks.length === 0) {
    return { sections: [{ key: 'a0', title: '说明', items: [t] }], usedFallback };
  }
  const sections = [];
  chunks.forEach((chunk, i) => {
    const lines = chunk.split('\n').map((s) => s.trim()).filter(Boolean);
    let title = chunks.length > 1 ? `要点 ${i + 1}` : '优化说明';
    let items = lines.length ? lines.slice() : [chunk];
    if (lines.length > 0) {
      const h = lines[0];
      if (/^【/.test(h) && /】$/.test(h)) {
        title = h;
        items = lines.slice(1);
        if (items.length === 0) {
          items = [h];
        }
      } else if (h.length <= 40 && /[：:]\s*$/.test(h)) {
        title = h.replace(/\s*[:：]\s*$/, '');
        items = lines.slice(1);
        if (items.length === 0) {
          items = [h];
        }
      } else if (lines.length === 1 && /[。；]/.test(lines[0]) && lines[0].length > 50) {
        const segs = lines[0]
          .split('。')
          .map((s) => s.trim())
          .filter((s) => s)
          .map((s) => (/[。！？;；]$/.test(s) ? s : `${s}。`));
        if (segs.length > 1) {
          title = '优化说明';
          items = segs;
        }
      }
    }
    sections.push({ key: `s${i}`, title, items });
  });
  return { sections, usedFallback };
}

Page({
  data: {
    userId: '',
    planId: '', // 膳食计划ID，用于更新和发布
    userInfo: {
      username: '用户',
      usernameInitial: '用',
      healthData: {
        height: 170,
        weight: 60
      }
    },
    planInfo: {
      title: '',
      duration: 7,
      startDate: ''
    },
    today: '',
    currentDay: 1,
    currentDayMeals: [],
    planDays: [],
    ingredients: [], // 从后端获取的食材列表
    searchResults: [], // 搜索结果
    showSearchResults: false, // 是否显示搜索结果
    searchKeyword: '',
    showFoodModal: false,
    showAmountModal: false,
    selectedFood: {},
    foodAmount: 100,
    foodUnit: 'g',
    gramPerUnit: 1,
    unitOptions: ['g', '个', '碗', '杯', '勺'], // 单位选项
    unitIndex: 0,
    currentIngredient: null,
    selectedMealIndex: 0,
    showAIDraftModal: false,
    aiGeneratingDraft: false,
    aiForm: {
      serviceType: 'diet_plan',
      dietGoal: 'weight_loss',
      otherGoal: '',
      disease: '',
      allergy: '',
      demand: '',
      activityLevel: 'moderately_active'
    },
    showAIOptimizeModal: false,
    aiOptimizing: false,
    optimizePlannerNote: '',
    optimizeChangeHint: '',
    optimizeFeedbackList: [],
    showOptimizeResultModal: false,
    optimizeResultSource: '',
    optimizeResultSourceLabel: '',
    optimizeResultSections: []
  },

  onLoad(options) {
    const userId = options.userId || 'U001';
    console.log('=== onLoad 开始 === userId:', userId);
    
    // 初始化今天的日期
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    this.setData({
      userId: userId,
      today: todayStr,
      'planInfo.startDate': todayStr
    });
    
    this.initPlanDays();
    this.loadIngredients();
    this.loadUserInfo(userId);
    this.loadUserDietPlan(userId);
    this.loadServiceRequestPrefill(userId);
  },

  loadServiceRequestPrefill(userId) {
    api.serviceRequest.getDietitianList()
      .then((res) => {
        if (res.code !== 200 || !Array.isArray(res.data)) {
          return;
        }
        const req = this.pickLatestRequestForUser(res.data, userId);
        if (!req) {
          return;
        }
        const health = req.health_data && typeof req.health_data === 'object' ? req.health_data : {};
        this.setData({
          aiForm: {
            ...this.data.aiForm,
            serviceType: req.service_type || 'diet_plan',
            dietGoal: req.diet_goal || 'weight_loss',
            otherGoal: req.other_goal || '',
            disease: health.disease || '',
            allergy: health.allergy || '',
            demand: health.demand || ''
          }
        });
      })
      .catch(() => {});
  },

  pickLatestRequestForUser(rows, userId) {
    const uid = String(userId || '').trim();
    if (!uid) return null;
    const mine = (rows || []).filter((x) => String(x.user_id || '').trim() === uid && ['pending', 'approved'].includes(x.status));
    if (!mine.length) return null;
    mine.sort((a, b) => {
      const ta = new Date(a.update_time || a.create_time || 0).getTime();
      const tb = new Date(b.update_time || b.create_time || 0).getTime();
      return tb - ta;
    });
    return mine[0];
  },

  openAIDraftModal() {
    this.setData({
      showAIDraftModal: true,
      aiForm: {
        ...this.data.aiForm
      }
    });
  },

  closeAIDraftModal() {
    if (this.data.aiGeneratingDraft) return;
    this.setData({ showAIDraftModal: false });
  },

  openAIOptimizeModal() {
    const { userId, planId } = this.data;
    if (!planId) {
      wx.showToast({ title: '请先加载用户膳食计划', icon: 'none' });
      return;
    }
    this.setData({ showAIOptimizeModal: true, optimizePlannerNote: '' });
    if (userId) {
      api.healthData.getUserChangeSummary(userId)
        .then((res) => {
          if (res.code !== 200 || !res.data) {
            this.setData({ optimizeChangeHint: '' });
            return;
          }
          this.setData({ optimizeChangeHint: formatOptimizeChangeHint(res.data) });
        })
        .catch(() => this.setData({ optimizeChangeHint: '' }));
    }
    api.feedback
      .listDietitian({ status: 'all' })
      .then((res) => {
        if (res.code !== 200 || !Array.isArray(res.data)) {
          this.setData({ optimizeFeedbackList: [] });
          return;
        }
        const uid = String(userId || '').trim();
        const list = (res.data || [])
          .filter((x) => String(x.user_id || '').trim() === uid)
          .slice(0, 12)
          .map((x) => ({
            feedback_id: x.feedback_id,
            title: x.title || '反馈',
            content_preview: x.content_preview || '',
            checked: false
          }));
        this.setData({ optimizeFeedbackList: list });
      })
      .catch(() => this.setData({ optimizeFeedbackList: [] }));
  },

  closeAIOptimizeModal() {
    if (this.data.aiOptimizing) return;
    this.setData({ showAIOptimizeModal: false });
  },

  /** 关闭「优化结果」层（遮罩 / × / 我知道了），与阅读时间无关，关闭后给轻提示 */
  dismissOptimizeResult() {
    if (!this.data.showOptimizeResultModal) {
      return;
    }
    this.setData({
      showOptimizeResultModal: false,
      optimizeResultSections: [],
      optimizeResultSource: '',
      optimizeResultSourceLabel: ''
    });
    setTimeout(() => {
      wx.showToast({ title: '已填入草案', icon: 'success', duration: 2000 });
    }, 50);
  },

  bindOptimizePlannerNote(e) {
    this.setData({ optimizePlannerNote: e.detail.value || '' });
  },

  toggleOptimizeFeedback(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const list = (this.data.optimizeFeedbackList || []).map((x) => ({
      ...x,
      checked: x.feedback_id === id ? !x.checked : x.checked
    }));
    this.setData({ optimizeFeedbackList: list });
  },

  generateAIOptimizeDraft() {
    const { userId, planId, planInfo, optimizePlannerNote, optimizeFeedbackList } = this.data;
    if (!userId || !planId) {
      wx.showToast({ title: '缺少用户或计划', icon: 'none' });
      return;
    }
    const feedbackIds = (optimizeFeedbackList || [])
      .filter((x) => x.checked)
      .map((x) => x.feedback_id);
    this.setData({ aiOptimizing: true });
    wx.showLoading({ title: '智能优化中...', mask: true });
    api.dietPlan
      .optimizeAIDraft(planId, {
        user_id: userId,
        feedback_ids: feedbackIds,
        planner_note: optimizePlannerNote || ''
      })
      .then((res) => {
        wx.hideLoading();
        this.setData({ aiOptimizing: false });
        const code = res && res.code;
        const ok = code === 200 || code === '200';
        // 接口正常体或个别环境下 data 在外层
        const draft =
          res &&
          (res.data != null
            ? res.data
            : res.plan_days != null || res.plan_id != null
              ? res
              : null);
        if (!ok || !draft) {
          wx.showToast({ title: (res && res.message) || '生成失败', icon: 'none' });
          return;
        }
        const duration = draft.cycle_days || (parseInt(planInfo.duration, 10) || 7);
        let nextDays;
        try {
          const draftDays = (draft.plan_days || []).map((day, idx) => {
            if (!day || typeof day !== 'object') {
              return {
                dayIndex: idx + 1,
                date: this.getDateByDayIndex(idx + 1),
                meals: []
              };
            }
            return {
              dayIndex: day.day_index || idx + 1,
              date: day.plan_date || this.getDateByDayIndex(idx + 1),
              meals: (day.meals || []).map((meal) => ({
                type: meal.type,
                time: meal.time,
                calories: meal.calories || 0,
                protein: meal.protein || 0,
                carbohydrate: meal.carbohydrate || 0,
                fat: meal.fat || 0,
                foods: (meal.foods || []).map((food) => ({
                  name: food.name,
                  amount: food.amount,
                  calories: food.calories || 0,
                  protein: food.protein || 0,
                  carbohydrate: food.carbohydrate || 0,
                  fat: food.fat || 0
                }))
              }))
            };
          });
          const filled = () => {
            const arr = draftDays.slice();
            while (arr.length < duration) {
              const dayIndex = arr.length + 1;
              arr.push({
                dayIndex,
                date: this.getDateByDayIndex(dayIndex),
                meals: [
                  { type: '早餐', time: '08:00', calories: 0, foods: [] },
                  { type: '午餐', time: '12:00', calories: 0, foods: [] },
                  { type: '晚餐', time: '18:00', calories: 0, foods: [] },
                  { type: '加餐', time: '15:00', calories: 0, foods: [] }
                ]
              });
            }
            return arr;
          };
          nextDays = filled();
        } catch (e) {
          console.error('generateAIOptimizeDraft map', e);
          wx.showToast({ title: '配餐数据解析失败', icon: 'none' });
          return;
        }
        const src = (draft.generation_source || 'llm').toLowerCase();
        const srcLabel = src === 'fallback' ? '本地营养兜底' : '大模型生成';
        const parsed = parseOptimizationSummaryForView(draft.optimization_summary);
        this.setData({
          showAIOptimizeModal: false,
          showOptimizeResultModal: true,
          optimizeResultSource: src,
          optimizeResultSourceLabel: srcLabel,
          optimizeResultSections: parsed.sections,
          planDays: nextDays,
          currentDay: 1,
          currentDayMeals: nextDays[0] ? nextDays[0].meals : [],
          planInfo: {
            ...this.data.planInfo,
            title: draft.plan_title || this.data.planInfo.title,
            duration
          }
        });
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ aiOptimizing: false });
        const msg = (err && err.data && err.data.message) || err.errMsg || '网络错误';
        wx.showToast({ title: msg, icon: 'none' });
      });
  },

  selectAIDietGoal(e) {
    const goal = e.currentTarget.dataset.goal;
    this.setData({ 'aiForm.dietGoal': goal });
  },

  bindAIField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`aiForm.${field}`]: e.detail.value });
  },

  bindAIActivityChange(e) {
    const index = Number(e.detail.value);
    const levels = ['sedentary', 'lightly_active', 'moderately_active', 'very_active'];
    this.setData({ 'aiForm.activityLevel': levels[index] || 'moderately_active' });
  },

  buildHealthProfileForAI() {
    const parts = [];
    if (this.data.aiForm.disease) parts.push(`疾病情况：${this.data.aiForm.disease}`);
    if (this.data.aiForm.allergy) parts.push(`过敏食物：${this.data.aiForm.allergy}`);
    return parts.join('；');
  },

  generateAIDraft() {
    const { userId, planInfo, aiForm } = this.data;
    if (!userId) {
      wx.showToast({ title: '缺少目标用户', icon: 'none' });
      return;
    }
    if (aiForm.dietGoal === 'other' && !aiForm.otherGoal) {
      wx.showToast({ title: '请填写其他目标', icon: 'none' });
      return;
    }
    const healthProfile = this.buildHealthProfileForAI();
    const title = planInfo.title || '智能推荐膳食计划初稿';
    this.setData({ aiGeneratingDraft: true });
    wx.showLoading({ title: '生成初稿中...', mask: true });
    api.dietPlan.generateAIDraft({
      user_id: userId,
      plan_title: title,
      cycle_days: parseInt(planInfo.duration, 10) || 7,
      activity_level: aiForm.activityLevel || 'moderately_active',
      diet_goal: aiForm.dietGoal || 'weight_loss',
      other_goal: aiForm.otherGoal || '',
      health_profile: healthProfile,
      additional_requirements: aiForm.demand || ''
    })
      .then((res) => {
        wx.hideLoading();
        this.setData({ aiGeneratingDraft: false });
        if (res.code !== 200 || !res.data) {
          wx.showToast({ title: (res && res.message) || '生成失败', icon: 'none' });
          return;
        }
        const draft = res.data;
        const duration = draft.cycle_days || (parseInt(planInfo.duration, 10) || 7);
        const draftDays = (draft.plan_days || []).map((day, idx) => ({
          dayIndex: day.day_index || idx + 1,
          date: day.plan_date || this.getDateByDayIndex(idx + 1),
          meals: (day.meals || []).map((meal) => ({
            type: meal.type,
            time: meal.time,
            calories: meal.calories || 0,
            protein: meal.protein || 0,
            carbohydrate: meal.carbohydrate || 0,
            fat: meal.fat || 0,
            foods: (meal.foods || []).map((food) => ({
              name: food.name,
              amount: food.amount,
              calories: food.calories || 0,
              protein: food.protein || 0,
              carbohydrate: food.carbohydrate || 0,
              fat: food.fat || 0
            }))
          }))
        }));
        while (draftDays.length < duration) {
          const dayIndex = draftDays.length + 1;
          draftDays.push({
            dayIndex,
            date: this.getDateByDayIndex(dayIndex),
            meals: [
              { type: '早餐', time: '08:00', calories: 0, foods: [] },
              { type: '午餐', time: '12:00', calories: 0, foods: [] },
              { type: '晚餐', time: '18:00', calories: 0, foods: [] },
              { type: '加餐', time: '15:00', calories: 0, foods: [] }
            ]
          });
        }
        this.setData({
          showAIDraftModal: false,
          planDays: draftDays,
          currentDay: 1,
          currentDayMeals: draftDays[0] ? draftDays[0].meals : [],
          planInfo: {
            ...this.data.planInfo,
            title: draft.plan_title || title,
            duration
          }
        });
        wx.showToast({ title: `初稿已生成（${draft.generation_source || 'ai'}）`, icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ aiGeneratingDraft: false });
        const msg = (err && err.data && err.data.message) || err.errMsg || '网络错误';
        wx.showToast({ title: msg, icon: 'none' });
      });
  },

  loadUserDietPlan(userId) {
    console.log('=== 1. loadUserDietPlan 开始 === userId:', userId);

    // 统一用 query 参数形式，保证能查到目标用户计划（草稿/已发布）
    api.dietPlan.getUserPlans({ user_id: userId })
      .then(res => {
        console.log('=== 2. getUserPlans 响应 === code:', res && res.code);
        console.log('=== 2. getUserPlans 数据 === data:', res && res.data);

        const rawData = res ? res.data : null;
        const plans = Array.isArray(rawData)
          ? rawData.slice()
          : (rawData && Array.isArray(rawData.plans)) ? rawData.plans.slice()
            : (rawData && Array.isArray(rawData.items)) ? rawData.items.slice()
              : (rawData && Array.isArray(rawData.list)) ? rawData.list.slice()
                : [];

        if (res && res.code === 200 && plans.length > 0) {
          const getStatus = (p) => (p && (p.status || p.audit_status || p.auditStatus)) || '';
          const getUpdateTime = (p) => (p && (p.update_time || p.updated_at || p.updateTime)) || '';
          const getId = (p) => (p && (p.id || p.plan_id || p.planId)) || '';
          const getTitle = (p) => (p && (p.title || p.plan_title || p.planTitle)) || '';
          // 不再需要获取 goal，因为我们已经删除了 dietGoal 字段
          const getGoal = (p) => (p && (p.goal || p.diet_goal || p.dietGoal)) || '';
          const getCycleDays = (p) => (p && (p.cycle_days || p.cycleDays)) || 7;

          // 按更新时间排序，选择最新的计划（与服务面板逻辑一致）
          plans.sort((a, b) => {
            const tA = getUpdateTime(a);
            const tB = getUpdateTime(b);
            const dA = tA ? new Date(tA) : new Date(0);
            const dB = tB ? new Date(tB) : new Date(0);
            return dB - dA;
          });
          const latestPlan = plans[0];

          const planId = getId(latestPlan);
          const title = getTitle(latestPlan);
          const duration = getCycleDays(latestPlan);

          console.log('=== 3. 选中的计划 ===', latestPlan);
          console.log('=== 4. 计划ID ===', planId);
          console.log('=== 5. 计划标题 ===', title);
          console.log('=== 6. 计划天数 ===', duration);

          this.setData({
            planId,
            planInfo: {
              ...this.data.planInfo,
              title,
              duration
            }
          });

          console.log('=== 8. setData 完成 === 当前 planInfo.title ===', this.data.planInfo.title);

          if (planId) {
            console.log('=== 9. 准备调用 loadPlanDays ===');
            this.loadPlanDays(planId, userId);
          } else {
            wx.showToast({ title: '草稿计划ID缺失', icon: 'none' });
          }
        } else {
          console.log('=== 2a. 没有找到计划 ===', res);
        }
      })
      .catch(err => {
        console.error('=== loadUserDietPlan 错误 ===', err);
      });
  },

  loadPlanDays(planId, userId) {
    console.log('=== 10. loadPlanDays 开始 === planId:', planId, 'userId:', userId);
    
    // 统一用 query 参数形式传 user_id，否则后端会按“当前登录用户”查，规划师场景会查不到
    api.dietPlan.getDetail(planId, { user_id: userId })
      .then(res => {
        console.log('=== 11. getDetail 响应 ===', res);
        
        if (res.code === 200 && res.data) {
          const planDetail = res.data;
          console.log('=== 12. planDetail ===', planDetail);
          console.log('=== 13. planDetail.plan_days ===', planDetail.plan_days);
          
          if (planDetail.plan_days && planDetail.plan_days.length > 0) {
            const duration = parseInt(this.data.planInfo.duration) || 7;
            const planDays = planDetail.plan_days.map((day, index) => ({
              dayIndex: day.day_index || (index + 1),
              date: day.date || day.plan_date,
              meals: day.meals || [
                { type: '早餐', time: '08:00', calories: 0, foods: [] },
                { type: '午餐', time: '12:00', calories: 0, foods: [] },
                { type: '晚餐', time: '18:00', calories: 0, foods: [] },
                { type: '加餐', time: '15:00', calories: 0, foods: [] }
              ]
            }));
            
            while (planDays.length < duration) {
              const dayIndex = planDays.length + 1;
              planDays.push({
                dayIndex: dayIndex,
                date: this.getDateByDayIndex(dayIndex),
                meals: [
                  { type: '早餐', time: '08:00', calories: 0, foods: [] },
                  { type: '午餐', time: '12:00', calories: 0, foods: [] },
                  { type: '晚餐', time: '18:00', calories: 0, foods: [] },
                  { type: '加餐', time: '15:00', calories: 0, foods: [] }
                ]
              });
            }
            
            console.log('=== 14. 准备 setData planDays ===', planDays);
            
            this.setData({
              planDays: planDays,
              'planInfo.startDate': (planDays[0] && planDays[0].date) || this.data.planInfo.startDate,
              currentDayMeals: planDays[0].meals
            });
            
            console.log('=== 15. setData 完成 ===');
            console.log('=== 15. planDays.length ===', this.data.planDays.length);
            
            wx.showToast({ title: '加载膳食计划成功', icon: 'success' });
          } else {
            console.log('=== 12a. 没有 plan_days 数据 ===');
          }
        }
      })
      .catch(err => {
        console.error('=== loadPlanDays 错误 ===', err);
      });
  },

  loadIngredients() {
    const cachedIngredients = wx.getStorageSync('cachedIngredients');
    if (cachedIngredients && cachedIngredients.length > 0) {
      this.setData({ ingredients: cachedIngredients });
    }
    
    api.ingredient.getList()
      .then(res => {
        if (res.code === 200 && res.data.ingredients) {
          const ingredients = res.data.ingredients;
          this.setData({ ingredients: ingredients });
          wx.setStorageSync('cachedIngredients', ingredients);
        }
      })
      .catch(() => {});
  },

  loadUserInfo(userId) {
    console.log('=== loadUserInfo 开始 === userId:', userId);
    
    // 先获取用户基本信息
    api.auth.getUserByID(userId)
      .then(userRes => {
        console.log('=== 1. 获取用户基本信息成功 ===', userRes);
        if (userRes.code === 200) {
          const userData = userRes.data;
          
          // 然后获取用户健康数据
          return api.healthData.getUserHealthData(userId)
            .then(healthRes => {
              console.log('=== 2. 获取健康数据成功 ===', healthRes);
              const healthData = healthRes.code === 200 ? healthRes.data : {};
              
              // 合并数据
              const userInfo = {
                ...userData,
                usernameInitial: userData.username ? userData.username.charAt(0) : '?',
                healthData: {
                  height: healthData.height || 0,
                  weight: healthData.weight || 0,
                  bloodPressure: healthData.blood_pressure || '',
                  bloodSugar: healthData.blood_sugar || '',
                  heartRate: healthData.heart_rate || 0,
                  allergyHistory: healthData.allergy_history || ''
                }
              };
              
              console.log('=== 3. 合并后用户信息 ===', userInfo);
              console.log('=== 3.1 身高 ===', userInfo.healthData.height);
              console.log('=== 3.2 体重 ===', userInfo.healthData.weight);
              console.log('=== 3.3 测试BMI ===', this.calculateBMI(userInfo.healthData.height, userInfo.healthData.weight));
              this.setData({ userInfo });
            });
        }
      })
      .catch(err => {
        console.error('=== loadUserInfo 错误 ===', err);
      });
  },

  initPlanDays() {
    const duration = parseInt(this.data.planInfo.duration) || 7;
    const planDays = [];
    for (let i = 1; i <= duration; i++) {
      planDays.push({
        dayIndex: i,
        date: this.getDateByDayIndex(i),
        meals: [
          { type: '早餐', time: '08:00', calories: 0, foods: [] },
          { type: '午餐', time: '12:00', calories: 0, foods: [] },
          { type: '晚餐', time: '18:00', calories: 0, foods: [] },
          { type: '加餐', time: '15:00', calories: 0, foods: [] }
        ]
      });
    }
    console.log('=== initPlanDays 生成的 planDays ===', planDays);
    this.setData({
      planDays: planDays,
      currentDayMeals: planDays[0].meals
    });
  },

  getDateByDayIndex(dayIndex) {
    const startDate = this.data.planInfo.startDate || new Date().toISOString().split('T')[0];
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayIndex - 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  calculateBMI(height, weight) {
    console.log('=== calculateBMI 调用 === height:', height, 'weight:', weight);
    if (!height || !weight || height <= 0 || weight <= 0) {
      console.log('=== 身高或体重无效 ===');
      return 0;
    }
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    console.log('=== BMI 计算结果 ===', bmi);
    return bmi;
  },

  bindPlanInfo(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    // 只更新输入框的值，不触发天数调整
    this.setData({
      [`planInfo.${field}`]: value
    });
  },

  bindPlanBlur(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    // 当计划周期输入框失去焦点时，处理天数变化
    if (field === 'duration') {
      const oldDuration = this.data.planInfo.duration;
      const newDuration = value === '' ? '' : (parseInt(value) || 7);
      
      // 更新最终值
      this.setData({
        [`planInfo.${field}`]: newDuration
      });
      
      // 处理天数变化
      if (newDuration !== '' && !isNaN(newDuration)) {
        if (newDuration < oldDuration) {
          // 天数减少，显示确认对话框
          wx.showModal({
            title: '确认修改',
            content: `将计划天数从 ${oldDuration} 天减少到 ${newDuration} 天，会丢失最后 ${oldDuration - newDuration} 天的编辑内容，确定要继续吗？`,
            success: (res) => {
              if (res.confirm) {
                this.adjustPlanDays(newDuration);
              } else {
                // 取消修改，恢复原天数
                this.setData({
                  [`planInfo.${field}`]: oldDuration
                });
              }
            }
          });
        } else {
          // 天数增加，直接调整
          this.adjustPlanDays(newDuration);
        }
      }
    }
  },

  bindStartDateChange(e) {
    const startDate = e.detail.value;
    const planDays = (this.data.planDays || []).map((day, index) => ({
      ...day,
      // 仅重算日期，保留原有餐次与食物编辑内容
      date: this.getDateByStartDate(startDate, index + 1)
    }));
    const currentDayIndex = (this.data.currentDay || 1) - 1;
    this.setData({
      'planInfo.startDate': startDate,
      planDays,
      currentDayMeals: planDays[currentDayIndex] ? planDays[currentDayIndex].meals : []
    });
  },



  getDateByStartDate(startDate, dayIndex) {
    const base = startDate || new Date().toISOString().split('T')[0];
    const date = new Date(base);
    date.setDate(date.getDate() + dayIndex - 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  adjustPlanDays(newDuration) {
    const oldPlanDays = this.data.planDays;
    const validDuration = Math.max(1, parseInt(newDuration) || 7);
    const newPlanDays = [...oldPlanDays];
    
    if (validDuration > oldPlanDays.length) {
      // 天数增加，在末尾追加新的天
      for (let i = oldPlanDays.length + 1; i <= validDuration; i++) {
        newPlanDays.push({
          dayIndex: i,
          date: this.getDateByDayIndex(i),
          meals: [
            { type: '早餐', time: '08:00', calories: 0, foods: [] },
            { type: '午餐', time: '12:00', calories: 0, foods: [] },
            { type: '晚餐', time: '18:00', calories: 0, foods: [] },
            { type: '加餐', time: '15:00', calories: 0, foods: [] }
          ]
        });
      }
    } else if (validDuration < oldPlanDays.length) {
      // 天数减少，从末尾删除多出来的天
      newPlanDays.splice(validDuration);
    }
    
    console.log('=== adjustPlanDays 调整后 ===', newPlanDays);
    
    // 更新数据
    this.setData({
      planDays: newPlanDays,
      currentDayMeals: newPlanDays[0].meals
    });
  },

  switchDay(e) {
    const day = parseInt(e.currentTarget.dataset.day);
    const dayIndex = day - 1;
    if (dayIndex >= 0 && dayIndex < this.data.planDays.length) {
      const currentDayMeals = this.data.planDays[dayIndex].meals;
      this.setData({
        currentDay: day,
        currentDayMeals
      });
    }
  },

  addFood(e) {
    const mealIndex = e.currentTarget.dataset.mealIndex;
    this.setData({
      showFoodModal: true,
      selectedMealIndex: mealIndex
    });
  },

  deleteFood(e) {
    const mealIndex = e.currentTarget.dataset.mealIndex;
    const foodIndex = e.currentTarget.dataset.foodIndex;
    const planDays = this.data.planDays;
    const dayIndex = this.data.currentDay - 1;
    planDays[dayIndex].meals[mealIndex].foods.splice(foodIndex, 1);
    this.calculateMealCalories(dayIndex, mealIndex);
    const currentDayMeals = planDays[dayIndex].meals;
    this.setData({
      planDays,
      currentDayMeals
    });
  },

  bindSearchKeyword(e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });
    
    if (keyword) {
      const results = this.data.ingredients.filter(ingredient =>
        ingredient.name.toLowerCase().includes(keyword.toLowerCase())
      );
      this.setData({
        searchResults: results,
        showSearchResults: true
      });
    } else {
      this.setData({
        showSearchResults: false
      });
    }
  },

  selectIngredient(e) {
    const ingredient = e.currentTarget.dataset.ingredient;
    const nutrition = ingredient.nutrition_100g || {};
    const selectedFood = {
      name: ingredient.name,
      calories: ingredient.calorie_100g || 0,
      protein: nutrition.protein || 0,
      carbohydrate: nutrition.carbohydrate || 0,
      fat: nutrition.fat || 0
    };
    this.setData({
      selectedFood: selectedFood,
      currentIngredient: ingredient,
      foodAmount: 100,
      foodUnit: 'g',
      gramPerUnit: 1,
      unitIndex: 0,
      showFoodModal: false,
      showAmountModal: true
    });
  },

  bindFoodAmount(e) {
    this.setData({ foodAmount: e.detail.value });
  },

  changeUnit(e) {
    const index = e.detail.value;
    const unit = this.data.unitOptions[index];
    let gramPerUnit = 100;
    switch(unit) {
      case 'g':
        gramPerUnit = 1;
        break;
      case '个':
        gramPerUnit = 100;
        break;
      case '碗':
        gramPerUnit = 200;
        break;
      case '杯':
        gramPerUnit = 250;
        break;
      case '勺':
        gramPerUnit = 15;
        break;
    }
    
    this.setData({
      unitIndex: index,
      foodUnit: unit,
      gramPerUnit: gramPerUnit
    });
  },

  confirmFoodAmount() {
    const { selectedFood, foodAmount, foodUnit, gramPerUnit, selectedMealIndex } = this.data;
    const planDays = this.data.planDays;
    const dayIndex = this.data.currentDay - 1;
    
    const actualGrams = foodAmount * gramPerUnit;
    const calories = (selectedFood.calories * actualGrams) / 100;
    const protein = ((selectedFood.protein || 0) * actualGrams) / 100;
    const carbohydrate = ((selectedFood.carbohydrate || 0) * actualGrams) / 100;
    const fat = ((selectedFood.fat || 0) * actualGrams) / 100;
    
    planDays[dayIndex].meals[selectedMealIndex].foods.push({
      name: selectedFood.name,
      amount: `${foodAmount}${foodUnit}`,
      calories: Math.round(calories),
      protein: parseFloat(protein.toFixed(1)),
      carbohydrate: parseFloat(carbohydrate.toFixed(1)),
      fat: parseFloat(fat.toFixed(1))
    });
    
    this.calculateMealCalories(dayIndex, selectedMealIndex);
    const currentDayMeals = planDays[dayIndex].meals;
    
    this.setData({
      planDays,
      currentDayMeals,
      showAmountModal: false,
      foodAmount: 100,
      foodUnit: 'g',
      gramPerUnit: 1,
      unitIndex: 0
    });
  },

  calculateMealCalories(dayIndex, mealIndex) {
    const planDays = this.data.planDays;
    const meal = planDays[dayIndex].meals[mealIndex];
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbohydrate = 0;
    let totalFat = 0;
    meal.foods.forEach(food => {
      totalCalories += food.calories;
      totalProtein += food.protein || 0;
      totalCarbohydrate += food.carbohydrate || 0;
      totalFat += food.fat || 0;
    });
    meal.calories = totalCalories;
    meal.protein = parseFloat(totalProtein.toFixed(1));
    meal.carbohydrate = parseFloat(totalCarbohydrate.toFixed(1));
    meal.fat = parseFloat(totalFat.toFixed(1));
    this.setData({ planDays });
  },

  closeFoodModal() {
    this.setData({ showFoodModal: false });
  },

  closeAmountModal() {
    this.setData({ showAmountModal: false });
  },

  stopPropagation() {},

  /** 当前登录规划师在 user 表中的 user_id（与 service_request.dietitian_id 一致） */
  getDietitianId() {
    const info = wx.getStorageSync('userInfo') || {};
    return info.user_id || info.userId || '';
  },

  savePlan() {
    const { planInfo, planDays, userId, planId } = this.data;
    
    if (!planInfo.title) {
      wx.showToast({ title: '请输入计划标题', icon: 'none' });
      return;
    }
    const dietitianId = this.getDietitianId();
    if (!dietitianId) {
      wx.showToast({ title: '请先登录规划师账号', icon: 'none' });
      return;
    }

    const requestData = {
      plan_title: planInfo.title,
      cycle_days: planInfo.duration,
      plan_days: planDays.map(day => ({
        day_index: day.dayIndex,
        plan_date: day.date,
        calories: day.meals.reduce((total, meal) => total + meal.calories, 0),
        protein: parseFloat(day.meals.reduce((t, m) => t + (m.protein || 0), 0).toFixed(1)),
        carbohydrate: parseFloat(day.meals.reduce((t, m) => t + (m.carbohydrate || 0), 0).toFixed(1)),
        fat: parseFloat(day.meals.reduce((t, m) => t + (m.fat || 0), 0).toFixed(1)),
        meals: day.meals.map(meal => ({
          type: meal.type,
          time: meal.time,
          calories: meal.calories,
          protein: meal.protein || 0,
          carbohydrate: meal.carbohydrate || 0,
          fat: meal.fat || 0,
          foods: meal.foods
        }))
      }))
    };
    
    console.log('=== 保存计划数据 ===', requestData);
    console.log('=== 第一天数据 ===', requestData.plan_days[0]);
    
    wx.showLoading({ title: '保存中...' });
    
    if (planId) {
      api.dietPlan.update(planId, requestData, userId)
        .then(res => {
          wx.hideLoading();
          if (res.code === 200) {
            wx.showToast({ title: '计划保存成功', icon: 'success' });
          }
        })
        .catch(err => {
          wx.hideLoading();
          console.error('savePlan error:', err);
        });
    } else {
      const createData = {
        user_id: userId,
        service_request_id: '',
        dietitian_id: dietitianId,
        plan_title: planInfo.title,
        source: 'dietitian',
        cycle_days: planInfo.duration,
        plan_days: requestData.plan_days
      };
      
      api.dietPlan.create(createData)
        .then(res => {
          wx.hideLoading();
          if (res.code === 200) {
            wx.showToast({ title: '计划保存成功', icon: 'success' });
            this.setData({ planId: (res.data && (res.data.id || res.data.plan_id || res.data.planId)) || '' });
          }
        })
        .catch(err => {
          wx.hideLoading();
          console.error('savePlan error:', err);
        });
    }
  },

  publishPlan() {
    const { planInfo, planDays, userId, planId } = this.data;
    
    if (!planInfo.title) {
      wx.showToast({ title: '请输入计划标题', icon: 'none' });
      return;
    }
    const dietitianId = this.getDietitianId();
    if (!dietitianId) {
      wx.showToast({ title: '请先登录规划师账号', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '发布计划',
      content: '确定要发布此膳食计划吗？发布后用户将可以看到。',
      success: (res) => {
        if (res.confirm) {
          if (planId) {
            // 更新并发布现有计划
            const updateData = {
              plan_title: planInfo.title,
              cycle_days: planInfo.duration,
              plan_days: planDays.map(day => ({
                day_index: day.dayIndex,
                plan_date: day.date,
                calories: day.meals.reduce((total, meal) => total + meal.calories, 0),
                protein: parseFloat(day.meals.reduce((t, m) => t + (m.protein || 0), 0).toFixed(1)),
                carbohydrate: parseFloat(day.meals.reduce((t, m) => t + (m.carbohydrate || 0), 0).toFixed(1)),
                fat: parseFloat(day.meals.reduce((t, m) => t + (m.fat || 0), 0).toFixed(1)),
                meals: day.meals.map(meal => ({
                  type: meal.type,
                  time: meal.time,
                  calories: meal.calories,
                  protein: meal.protein || 0,
                  carbohydrate: meal.carbohydrate || 0,
                  fat: meal.fat || 0,
                  foods: meal.foods
                }))
              }))
            };
            
            wx.showLoading({ title: '发布中...' });
            
            // 先更新计划内容
            api.dietPlan.update(planId, updateData, userId)
              .then(updateRes => {
                if (updateRes.code === 200) {
                  // 然后发布计划
                  return api.dietPlan.publish(planId, userId);
                }
                throw new Error('更新计划失败');
              })
              .then(publishRes => {
                wx.hideLoading();
                if (publishRes.code === 200) {
                  wx.showToast({
                    title: '计划发布成功',
                    icon: 'success',
                    duration: 1500,
                    success: function() {
                      setTimeout(function() {
                        this.goBack();
                      }.bind(this), 1500);
                    }.bind(this)
                  });
                }
              })
              .catch(err => {
                wx.hideLoading();
                console.error('publishPlan error:', err);
                wx.showToast({ title: '发布失败', icon: 'none' });
              });
          } else {
            // 创建并发布新计划
            const requestData = {
              user_id: userId,
              service_request_id: '',
              dietitian_id: dietitianId,
              plan_title: planInfo.title,
              source: 'dietitian',
              cycle_days: planInfo.duration,
              plan_days: planDays.map(day => ({
                day_index: day.dayIndex,
                plan_date: day.date,
                calories: day.meals.reduce((total, meal) => total + meal.calories, 0),
                protein: parseFloat(day.meals.reduce((t, m) => t + (m.protein || 0), 0).toFixed(1)),
                carbohydrate: parseFloat(day.meals.reduce((t, m) => t + (m.carbohydrate || 0), 0).toFixed(1)),
                fat: parseFloat(day.meals.reduce((t, m) => t + (m.fat || 0), 0).toFixed(1)),
                meals: day.meals.map(meal => ({
                  type: meal.type,
                  time: meal.time,
                  calories: meal.calories,
                  protein: meal.protein || 0,
                  carbohydrate: meal.carbohydrate || 0,
                  fat: meal.fat || 0,
                  foods: meal.foods
                }))
              }))
            };
            
            wx.showLoading({ title: '发布中...' });
            
            api.dietPlan.create(requestData)
              .then(res => {
                wx.hideLoading();
                if (res.code === 200) {
                  wx.showToast({
                    title: '计划发布成功',
                    icon: 'success',
                    duration: 1500,
                    success: function() {
                      setTimeout(function() {
                        this.goBack();
                      }.bind(this), 1500);
                    }.bind(this)
                  });
                }
              })
              .catch(err => {
                wx.hideLoading();
                console.error('publishPlan error:', err);
                wx.showToast({ title: '发布失败', icon: 'none' });
              });
          }
        }
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
