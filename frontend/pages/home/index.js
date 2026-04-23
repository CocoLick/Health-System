// home/index.js
Page({
  data: {
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
    ]
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const todayRecords = wx.getStorageSync('todayNutritionRecords') || [];
    const currentPlan = wx.getStorageSync('currentDietPlan');
    const waterIntake = wx.getStorageSync('homeWaterIntake') || 0;
    const exerciseDone = !!wx.getStorageSync('homeExerciseDone');

    let totals = { calories: 0, protein: 0, fat: 0, carbohydrate: 0 };
    todayRecords.forEach(record => {
      totals.calories += record.calories || 0;
      totals.protein += record.protein || 0;
      totals.fat += record.fat || 0;
      totals.carbohydrate += record.carbohydrate || 0;
    });

    const displayName = userInfo.username || 'cocolike';
    const greetingText = this.getGreetingText();
    const today = this.getTodayText();
    const targets = this.getTargets(currentPlan);
    const metricProgress = this.getMetricProgress(totals, targets);
    const remaining = {
      calories: Math.max((targets.calories || 0) - (totals.calories || 0), 0),
      protein: Math.max((targets.protein || 0) - (totals.protein || 0), 0)
    };
    const waterProgress = targets ? Math.min((waterIntake / 2000) * 100, 100) : 0;

    this.setData({
      userInfo,
      displayName,
      greetingText,
      today,
      todayIntake: totals,
      targets,
      metricProgress,
      remaining,
      waterIntake,
      waterProgress,
      exerciseDone,
      currentPlan
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

  getTargets(currentPlan) {
    return {
      calories: (currentPlan && Number(currentPlan.calories)) || 2000,
      protein: (currentPlan && Number(currentPlan.protein)) || 90,
      fat: (currentPlan && Number(currentPlan.fat)) || 60,
      carbohydrate: (currentPlan && Number(currentPlan.carbohydrate)) || 260
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
  }
});