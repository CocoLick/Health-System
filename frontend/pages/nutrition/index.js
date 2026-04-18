// nutrition/index.js
Page({
  data: {
    isLoggedIn: false,
    activeNav: 'overview'
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    
    if (userInfo && token) {
      this.setData({
        isLoggedIn: true
      });
      this.loadNutritionData();
    } else {
      this.setData({
        isLoggedIn: false
      });
    }
  },

  // 处理登录
  handleLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/login'
    });
  },

  // 切换导航
  switchNav(e) {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    const nav = e.currentTarget.dataset.nav;
    this.setData({
      activeNav: nav
    });
  },

  // 加载营养数据
  loadNutritionData() {
    // 这里可以从后端获取营养数据
    console.log('加载营养数据');
  },

  // 选择周期
  selectPeriod() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.showToast({
      title: '选择周期功能暂未实现',
      icon: 'none'
    });
  },

  // 导出数据
  exportData() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.showToast({
      title: '导出数据功能暂未实现',
      icon: 'none'
    });
  }
})