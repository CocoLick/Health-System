Page({
  data: {
    isLoggedIn: false,
    userRole: '',
    userInfo: {}
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
        isLoggedIn: true,
        userRole: userInfo.role || 'user',
        userInfo: userInfo
      });
      this.updateTabBar();
    } else {
      this.setData({
        isLoggedIn: false,
        userRole: '',
        userInfo: {}
      });
      this.restoreDefaultTabBar();
    }
  },

  // 处理登录
  handleLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/login'
    });
  },

  // 处理退出登录
  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('token');
          
          // 更新状态
          this.setData({
            isLoggedIn: false,
            userRole: '',
            userInfo: {}
          });
          
          // 恢复默认Tab栏
          this.restoreDefaultTabBar();
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  },

  // 根据角色更新Tab栏
  updateTabBar() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.role === 'admin') {
      // 管理员Tab栏配置
      const adminTabBar = {
        color: '#6c757d',
        selectedColor: '#ff9800',
        backgroundColor: '#ffffff',
        borderStyle: 'black',
        list: [
          {
            pagePath: 'pages/home/index',
            text: '首页',
            iconPath: '',
            selectedIconPath: ''
          },
          {
            pagePath: 'pages/diet-plan/index',
            text: '膳食计划',
            iconPath: '',
            selectedIconPath: ''
          },
          {
            pagePath: 'pages/nutrition/index',
            text: '营养分析',
            iconPath: '',
            selectedIconPath: ''
          },
          {
            pagePath: 'pages/ingredients/index',
            text: '食材管理',
            iconPath: '',
            selectedIconPath: ''
          },
          {
            pagePath: 'pages/profile/index',
            text: '管理中心',
            iconPath: '',
            selectedIconPath: ''
          }
        ]
      };
      
      // 这里需要使用wx.setTabBarItem或自定义组件来动态更新Tab栏
      // 由于微信小程序限制，直接修改app.json是不行的
      // 这里我们通过页面内的逻辑来处理显示内容
      console.log('管理员Tab栏已更新');
    }
  },

  // 恢复默认Tab栏
  restoreDefaultTabBar() {
    console.log('已恢复默认Tab栏');
  },

  // 普通用户导航
  navigateToSettings() {
    wx.navigateTo({
      url: '/pages/settings/index'
    });
  },

  navigateToFavorites() {
    wx.navigateTo({
      url: '/pages/favorites/index'
    });
  },

  navigateToHistory() {
    wx.navigateTo({
      url: '/pages/history/index'
    });
  },

  navigateToHelp() {
    wx.navigateTo({
      url: '/pages/help/index'
    });
  },

  // 管理员导航
  navigateToUserManagement() {
    wx.navigateTo({
      url: '/pages/admin/user-management/index'
    });
  },

  navigateToSystemSettings() {
    wx.navigateTo({
      url: '/pages/admin/system-settings/index'
    });
  },

  navigateToDataStatistics() {
    wx.navigateTo({
      url: '/pages/admin/data-statistics/index'
    });
  },

  navigateToIngredientManagement() {
    wx.navigateTo({
      url: '/pages/admin/ingredient-management/index'
    });
  }
});