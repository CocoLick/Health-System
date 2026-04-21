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
    // 这里可以根据选择的日期加载对应的膳食计划数据
    // 目前暂时使用默认计划
  },

  loadPlanData() {
    const plan = wx.getStorageSync('currentDietPlan');
    if (plan) {
      this.setData({ plan });
      this.calculateNutritionPercentage();
    } else {
      wx.showToast({ title: '暂无膳食计划', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    }
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

  abandonPlan() {
    wx.showModal({
      title: '放弃计划',
      content: '确定要放弃当前膳食计划吗？此操作不可撤销。',
      success: (res) => {
        if (res.confirm) {
          // 移除当前膳食计划
          wx.removeStorageSync('currentDietPlan');
          // 显示提示
          wx.showToast({ title: '已放弃当前计划', icon: 'success' });
          // 添加短暂延时，确保存储操作完成
          setTimeout(() => {
            // 使用switchTab跳转，因为膳食计划是tabBar页面
            wx.switchTab({
              url: '/pages/user/diet/diet-plan/index'
            });
          }, 500);
        }
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
  }
});