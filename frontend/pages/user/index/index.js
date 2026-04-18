// index.js
Page({
  data: {
    userInfo: {
      username: 'admin',
      role_type: 'admin',
      age: 30,
      gender: '男',
      phone: '13800138000',
      email: 'admin@example.com'
    }
  },

  onLoad() {
    // 从本地存储获取用户信息
    this.getUserInfo();
  },

  getUserInfo() {
    // 从本地存储获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');

    if (userInfo && token) {
      this.setData({
        userInfo: userInfo
      });
    } else {
      // 如果没有用户信息，跳转到登录页面
      wx.redirectTo({
        url: '/pages/auth/login/login'
      });
    }
  },

  // 营养状态详情
  viewNutritionDetail() {
    wx.showToast({
      title: '营养详情功能暂未实现',
      icon: 'none'
    });
  },

  // 调整膳食计划
  adjustDietPlan() {
    wx.showToast({
      title: '调整计划功能暂未实现',
      icon: 'none'
    });
  },

  // 快捷功能点击
  handleFunctionClick(e) {
    const index = e.currentTarget.dataset.index;
    const functions = ['营养分析', '膳食计划', '智能推荐', '健康管理', '食材管理'];
    
    wx.showToast({
      title: `${functions[index]}功能暂未实现`,
      icon: 'none'
    });
  },

  // 查看更多推荐
  viewMoreRecommendations() {
    wx.showToast({
      title: '查看更多功能暂未实现',
      icon: 'none'
    });
  },

  // 退出登录
  logout() {
    // 清除本地存储
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    
    // 跳转到登录页面
    wx.redirectTo({
      url: '/pages/auth/login/login'
    });
  }
})