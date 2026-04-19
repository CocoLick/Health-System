// home/index.js
Page({
  data: {
    userInfo: {},
    todayIntake: {
      calories: 0,
      protein: 0
    },
    currentPlan: null,
    healthTips: [
      { icon: '💧', title: '多喝水', desc: '每天饮用1500-2000ml水' },
      { icon: '🏃', title: '适量运动', desc: '每天30分钟有氧运动' }
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

    let totals = { calories: 0, protein: 0 };
    todayRecords.forEach(record => {
      totals.calories += record.calories || 0;
      totals.protein += record.protein || 0;
    });

    this.setData({
      userInfo,
      todayIntake: totals,
      currentPlan
    });
  },

  goToNutrition() {
    wx.switchTab({ url: '/pages/nutrition/index' });
  },

  goToDietPlan() {
    wx.switchTab({ url: '/pages/diet-plan/index' });
  },

  goToHealth() {
    wx.switchTab({ url: '/pages/user/health/index' });
  },

  goToProfile() {
    wx.switchTab({ url: '/pages/profile/index' });
  },

  viewPlanDetail() {
    wx.switchTab({ url: '/pages/diet-plan/index' });
  },

  requestAiPlan() {
    wx.switchTab({ url: '/pages/diet-plan/index' });
  },

  goToSelectDietitian() {
    wx.navigateTo({ url: '/pages/user/select-dietitian/index' });
  }
});