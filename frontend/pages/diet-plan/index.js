// diet-plan/index.js
Page({
  data: {
    isLoggedIn: false,
    activeNav: 'week',
    weekDays: [
      { day: '周一', date: '2026-03-23' },
      { day: '周二', date: '2026-03-24' },
      { day: '周三', date: '2026-03-25' },
      { day: '周四', date: '2026-03-26' },
      { day: '周五', date: '2026-03-27' },
      { day: '周六', date: '2026-03-28' },
      { day: '周日', date: '2026-03-29' }
    ],
    historyPlans: [
      {
        title: '减脂膳食计划',
        date: '2026-03-18至2026-03-24',
        calories: 1500,
        protein: 80,
        carbohydrate: 150,
        fat: 40
      },
      {
        title: '增肌膳食计划',
        date: '2026-03-11至2026-03-17',
        calories: 2500,
        protein: 150,
        carbohydrate: 250,
        fat: 60
      },
      {
        title: '健康膳食计划',
        date: '2026-03-04至2026-03-10',
        calories: 2000,
        protein: 100,
        carbohydrate: 200,
        fat: 50
      }
    ]
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
      this.loadWeekPlan();
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

  // 加载周计划数据
  loadWeekPlan() {
    // 这里可以从后端获取周计划数据
    console.log('加载周计划数据');
  },

  // 上一周
  prevWeek() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.showToast({
      title: '上一周功能暂未实现',
      icon: 'none'
    });
  },

  // 下一周
  nextWeek() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.showToast({
      title: '下一周功能暂未实现',
      icon: 'none'
    });
  },

  // 上月
  prevMonth() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.showToast({
      title: '上月功能暂未实现',
      icon: 'none'
    });
  },

  // 下月
  nextMonth() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.showToast({
      title: '下月功能暂未实现',
      icon: 'none'
    });
  },

  // 创建计划
  createPlan() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.showToast({
      title: '创建计划功能暂未实现',
      icon: 'none'
    });
  },

  // 导出历史记录
  exportHistory() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.showToast({
      title: '导出记录功能暂未实现',
      icon: 'none'
    });
  },

  // 查看计划详情
  viewPlanDetail() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.showToast({
      title: '查看详情功能暂未实现',
      icon: 'none'
    });
  },

  // 复制计划
  copyPlan() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.showToast({
      title: '复制计划功能暂未实现',
      icon: 'none'
    });
  }
})