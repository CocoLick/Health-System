Page({
  data: {
    isLoggedIn: false,
    userRole: 'user',
    userInfo: {},
    menuItems: [
      { icon: '🥬', text: '食材管理', path: '/pages/ingredients/index' },
      { icon: '💬', text: '意见反馈', action: 'showFeedback' },
      { icon: '📋', text: '健康记录', action: 'viewHealthHistory' },
      { icon: '⚙️', text: '设置', action: 'showSettings' }
    ],
    feedbackTypes: [
      { id: 'diet_plan', name: '膳食计划' },
      { id: 'system', name: '系统功能' },
      { id: 'service', name: '规划服务' },
      { id: 'other', name: '其他' }
    ]
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    this.checkLoginStatus();
  },

  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');

    if (userInfo && token) {
      this.setData({
        isLoggedIn: true,
        userRole: userInfo.role || 'user',
        userInfo: userInfo
      });
    } else {
      this.setData({
        isLoggedIn: false,
        userRole: 'user',
        userInfo: { username: '用户' }
      });
    }
  },

  handleLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/login'
    });
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('token');
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
          this.checkLoginStatus();
          // 跳转到登录页面
          wx.navigateTo({
            url: '/pages/auth/login/login'
          });
        }
      }
    });
  },

  navigateTo(e) {
    const path = e.currentTarget.dataset.path;
    if (path) {
      wx.navigateTo({ url: path });
    }
  },

  showFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '功能开发中，敬请期待',
      showCancel: false
    });
  },

  viewHealthHistory() {
    wx.navigateTo({
      url: '/pages/history/index'
    });
  },

  showSettings() {
    wx.navigateTo({
      url: '/pages/settings/index'
    });
  },

  showAbout() {
    wx.showModal({
      title: '关于我们',
      content: '个性化营养膳食智能规划系统 v1.0\n\n为您的健康饮食保驾护航',
      showCancel: false
    });
  }
});