// home/index.js
Page({
  data: {
    isLoggedIn: false,
    userInfo: {}
  },

  onLoad() {
    // 从本地存储获取用户信息
    this.checkLoginStatus();
  },

  onShow() {
    // 每次页面显示时更新用户信息
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    // 从本地存储获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    
    if (userInfo && token) {
      this.setData({
        isLoggedIn: true,
        userInfo: userInfo
      });
    } else {
      // 如果没有用户信息，显示默认值
      this.setData({
        isLoggedIn: false,
        userInfo: {}
      });
    }
  },

  // 处理登录
  handleLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/login'
    });
  },

  // 营养状态详情
  viewNutritionDetail() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.switchTab({
      url: '/pages/nutrition/index'
    });
  },

  // 调整膳食计划
  adjustDietPlan() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.switchTab({
      url: '/pages/diet-plan/index'
    });
  },

  // 快捷功能点击
  handleFunctionClick(e) {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    const index = e.currentTarget.dataset.index;
    const functions = ['nutrition', 'diet-plan', 'nutrition', 'nutrition', 'ingredients'];
    
    wx.switchTab({
      url: `/pages/${functions[index]}/index`
    });
  }
})