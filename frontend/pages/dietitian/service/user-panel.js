// dietitian/service/user-panel.js
Page({
  data: {
    userId: '',
    userInfo: {
      userId: 'U001',
      username: '张三',
      usernameInitial: '张',
      gender: '男',
      age: 35,
      phone: '138****8888',
      hasProfile: true,
      hasEvaluation: true,
      hasPlan: true,
      evaluationTime: '2026-03-15',
      evaluationExpired: true,
      planTitle: '减脂计划',
      planStatus: '进行中',
      healthData: {
        height: 175,
        weight: 70,
        bloodPressure: '正常',
        bloodSugar: '正常'
      }
    },
    serviceHistory: [
      {
        icon: '📋',
        title: '制定了减脂膳食计划',
        time: '2026-04-10 14:30'
      },
      {
        icon: '🔍',
        title: '完成了营养评估',
        time: '2026-03-15 10:00'
      },
      {
        icon: '👤',
        title: '查看了健康档案',
        time: '2026-03-15 09:30'
      }
    ]
  },

  onLoad(options) {
    const userId = options.userId || 'U001';
    this.setData({
      userId: userId
    });
    this.loadUserInfo(userId);
  },

  loadUserInfo(userId) {
    console.log('加载用户信息', userId);
  },

  goBack() {
    wx.navigateBack();
  },

  viewProfile() {
    wx.showToast({
      title: '查看/编辑健康档案',
      icon: 'none'
    });
  },

  doEvaluation() {
    wx.showToast({
      title: '进行营养评估',
      icon: 'none'
    });
  },

  managePlan() {
    wx.showToast({
      title: '管理膳食计划',
      icon: 'none'
    });
  },

  startServiceWizard() {
    wx.showToast({
      title: '开始服务向导',
      icon: 'none'
    });
  }
})