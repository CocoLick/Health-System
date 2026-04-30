Page({
  data: {
    isLoggedIn: false,
    userRole: 'user',
    userInfo: {},
    showAboutModal: false,
    menuItems: [
      { icon: '◫', text: '食材管理', path: '/pages/user/diet/ingredients/index' },
      { icon: '✉', text: '意见反馈', path: '/pages/user/feedback/index' },
      { icon: '⌁', text: '修改密码', path: '/pages/user/settings/index' },
      { icon: 'i', text: '关于', action: 'showAbout' }
    ],
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

  handleMenuTap(e) {
    const path = e.currentTarget.dataset.path;
    const action = e.currentTarget.dataset.action;
    if (path) {
      wx.navigateTo({ url: path });
      return;
    }
    if (action && typeof this[action] === 'function') {
      this[action]();
    }
  },

  showAbout() {
    this.setData({ showAboutModal: true });
  },

  closeAboutModal() {
    this.setData({ showAboutModal: false });
  },

  stopPropagation() {}
});