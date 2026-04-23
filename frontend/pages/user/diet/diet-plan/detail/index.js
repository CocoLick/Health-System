const api = require('../../../../../utils/api');

// diet-plan/detail/index.js
Page({
  data: {
    plan: null,
    proteinPercentage: 0,
    carbohydratePercentage: 0,
    fatPercentage: 0,
    selectedDate: '',
    selectedDateText: ''
  },

  onLoad(options) {
    console.log('膳食计划详情页面加载');
    // 显示tabBar
    wx.showTabBar();
    this.loadPlanData();
    this.initDate();
  },

  onShow() {
    console.log('膳食计划详情页面显示');
    // 显示tabBar
    wx.showTabBar();
    // 兜底刷新：避免从其他页面返回时仍显示旧缓存
    this.loadPlanData();
  },

  initDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const selectedDate = `${year}-${month}-${day}`;
    const selectedDateText = `${year}年${month}月${day}日`;
    this.setData({
      selectedDate,
      selectedDateText
    });
  },

  buildDietitianDisplay(plan) {
    if (!plan || plan.source === 'ai') {
      return '';
    }
    const name = (
      (plan.dietitianName != null && String(plan.dietitianName).trim()) ||
      (plan.dietitian_name != null && String(plan.dietitian_name).trim()) ||
      ''
    );
    const id = (plan.dietitian_id != null && String(plan.dietitian_id).trim()) || '';
    if (name && id) {
      return `${name}（${id}）`;
    }
    if (name) {
      return name;
    }
    if (id) {
      return id;
    }
    return '';
  },

  withPlanDietitianDisplay(plan) {
    if (!plan) {
      return plan;
    }
    return {
      ...plan,
      dietitianDisplay: this.buildDietitianDisplay(plan)
    };
  },

  changeDate(e) {
    const selectedDate = e.detail.value;
    const date = new Date(selectedDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const selectedDateText = `${year}年${month}月${day}日`;
    this.setData({
      selectedDate,
      selectedDateText
    });
    // 根据选择的日期加载对应的膳食计划数据
    this.loadDayData(selectedDate);
  },

  // 加载指定日期的数据
  loadDayData(selectedDate) {
    const plan = this.data.plan;
    if (!plan || !plan.plan_days) return;
    
    const normalizeDate = (d) => {
      if (!d) return '';
      const s = String(d).trim();
      // 兼容 "2026-04-22" / "2026/04/22" / "2026-04-22T00:00:00Z" 等格式
      const first10 = s.slice(0, 10).replace(/\//g, '-');
      const parsed = new Date(first10);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return first10;
    };
    const targetDate = normalizeDate(selectedDate);

    // 找到对应日期的天计划，支持 date 或 plan_date 字段
    let dayPlan = plan.plan_days.find(day => {
      const dayDate = normalizeDate(day.date || day.plan_date);
      return dayDate === targetDate;
    });
    
    // 如果没有找到对应日期的计划，尝试根据开始时间计算第几天
    if (!dayPlan) {
      const start = normalizeDate(plan.startDate) || normalizeDate(plan.plan_days[0] && (plan.plan_days[0].date || plan.plan_days[0].plan_date));
      if (start) {
        const startDate = new Date(start);
        const target = new Date(targetDate);
        const dayDiff = Math.floor((target - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
        if (dayDiff > 0 && dayDiff <= plan.plan_days.length) {
          dayPlan = plan.plan_days[dayDiff - 1];
        }
      }
    }
    
    if (dayPlan) {
      // 更新页面显示的数据
      this.setData({
        plan: {
          ...plan,
          calories: dayPlan.calories,
          protein: dayPlan.protein,
          carbohydrate: dayPlan.carbohydrate,
          fat: dayPlan.fat,
          meals: dayPlan.meals.map(meal => ({
            type: meal.type,
            time: meal.time,
            calories: meal.calories,
            foods: meal.foods.map(food => ({
              name: food.name,
              amount: food.amount,
              calories: food.calories
            }))
          })),
          hasPlanForDate: true
        }
      });
      // 重新计算营养比例
      this.calculateNutritionPercentage();
    } else {
      // 没有对应日期的计划，显示提示
      this.setData({
        plan: {
          ...plan,
          calories: 0,
          protein: 0,
          carbohydrate: 0,
          fat: 0,
          meals: [],
          hasPlanForDate: false
        }
      });
      // 重新计算营养比例
      this.calculateNutritionPercentage();
      // 显示提示
      wx.showToast({
        title: '当日无饮食计划',
        icon: 'none',
        duration: 1500
      });
    }
  },

  loadPlanData() {
    let plan = wx.getStorageSync('currentDietPlan');
    if (!plan) {
      wx.showToast({ title: '暂无膳食计划', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
      return;
    }
    plan = this.withPlanDietitianDisplay(plan);
    this.setData({ plan });
    this.calculateNutritionPercentage();

    if (!plan.id) {
      return;
    }
    api.dietPlan.getDetail(plan.id)
      .then((res) => {
        if (res.code !== 200 || !res.data) {
          return;
        }
        const d = res.data;
        const merged = this.withPlanDietitianDisplay({
          ...this.data.plan,
          dietitian_id: d.dietitian_id || this.data.plan.dietitian_id,
          dietitian_name: d.dietitian_name,
          dietitianName: (d.dietitian_name && String(d.dietitian_name).trim()) ||
            this.data.plan.dietitianName ||
            (d.dietitian_id || '')
        });
        this.setData({ plan: merged });
        try {
          wx.setStorageSync('currentDietPlan', merged);
        } catch (e) {
          console.warn('sync currentDietPlan', e);
        }
      })
      .catch((err) => {
        console.warn('拉取计划详情（规划师信息）失败', err);
      });
  },

  calculateNutritionPercentage() {
    const { plan } = this.data;
    if (!plan) return;

    const totalCalories = plan.calories;
    const proteinCalories = plan.protein * 4;
    const carbohydrateCalories = plan.carbohydrate * 4;
    const fatCalories = plan.fat * 9;

    const proteinPercentage = Math.round((proteinCalories / totalCalories) * 100);
    const carbohydratePercentage = Math.round((carbohydrateCalories / totalCalories) * 100);
    const fatPercentage = Math.round((fatCalories / totalCalories) * 100);

    this.setData({
      proteinPercentage,
      carbohydratePercentage,
      fatPercentage
    });
  },



  executeMeal(e) {
    const mealIndex = e.currentTarget.dataset.mealIndex;
    const plan = this.data.plan;
    if (plan && plan.meals[mealIndex]) {
      plan.meals[mealIndex].executed = !plan.meals[mealIndex].executed;
      wx.setStorageSync('currentDietPlan', plan);
      this.setData({ plan });
      wx.showToast({
        title: plan.meals[mealIndex].executed ? '已标记完成' : '已取消完成',
        icon: 'success'
      });
    }
  },

  recordDiet() {
    // 跳转到饮食页面的首页
    wx.switchTab({
      url: '/pages/user/diet/nutrition/index'
    });
  },

  applyOptimization() {
    wx.showModal({
      title: '申请优化',
      content: '确定要申请优化当前膳食计划吗？',
      success: (res) => {
        if (res.confirm) {
          const plan = this.data.plan;
          if (plan) {
            plan.optimizationRequested = true;
            wx.setStorageSync('currentDietPlan', plan);
            this.setData({ plan });
            wx.showToast({ title: '已提交优化申请', icon: 'success' });
          }
        }
      }
    });
  },

  terminateService() {
    const plan = this.data.plan;
    if (!plan || !plan.id) {
      wx.showToast({ title: '暂无膳食计划', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '解除服务',
      content: '将删除当前膳食计划，并结束与当前规划师的服务关系（服务申请标记为已完成）。此操作不可撤销。',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        api.dietPlan.remove(plan.id)
          .then((apiRes) => {
            wx.hideLoading();
            if (apiRes.code === 200) {
              wx.removeStorageSync('currentDietPlan');
              this.setData({ plan: null });
              wx.showToast({ title: '已解除服务', icon: 'success', duration: 1000 });
              setTimeout(() => {
                wx.switchTab({
                  url: '/pages/user/diet/diet-plan/index',
                  fail: () => {
                    wx.reLaunch({ url: '/pages/user/diet/diet-plan/index' });
                  }
                });
              }, 600);
            } else {
              wx.showToast({ title: apiRes.message || '解除失败', icon: 'none' });
            }
          })
          .catch((err) => {
            wx.hideLoading();
            console.error('解除服务失败:', err);
            const msg = (err && err.data && err.data.message) || (err && err.message) || '网络异常，请重试';
            wx.showToast({ title: msg, icon: 'none', duration: 3000 });
          });
      }
    });
  },

  viewDetailedComparison() {
    // 使用本地存储传递参数
    wx.setStorageSync('nutritionTab', 'analysis');
    // 跳转到营养分析界面，查看详细对比
    wx.switchTab({
      url: '/pages/user/diet/nutrition/index'
    });
  },

  goToNutritionEvaluation() {
    wx.setStorageSync('healthScrollToEvaluation', true);
    wx.switchTab({
      url: '/pages/user/health/index'
    });
  },

  goFeedbackPlan() {
    const plan = this.data.plan;
    const planId = plan && (plan.id || plan.plan_id);
    if (!planId) {
      wx.showToast({ title: '暂无计划信息', icon: 'none' });
      return;
    }
    const rawTitle = (plan && (plan.title || plan.plan_title)) || '';
    wx.navigateTo({
      url: `/pages/user/feedback/index?category=diet_plan&plan_id=${encodeURIComponent(planId)}&plan_title=${encodeURIComponent(rawTitle)}`
    });
  }
});