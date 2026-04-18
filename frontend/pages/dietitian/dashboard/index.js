// dietitian/dashboard/index.js
Page({
  data: {
    activeTab: 'home',
    filterType: 'all',
    feedbackSubTab: 'pending',
    searchKeyword: '',
    showPersonalCenterModal: false,
    dietitianName: '营养师',
    stats: {
      pendingPlans: 3,
      pendingArticles: 1,
      pendingFeedbacks: 5,
      serviceUsers: 25,
      totalPlans: 18,
      totalArticles: 5,
      totalReplies: 42,
      avgRating: 4.8
    },
    recentActivities: [
      {
        icon: '👤',
        text: '新用户李四申请服务',
        time: '2小时前'
      },
      {
        icon: '✅',
        text: '您的计划已审核通过',
        time: '4小时前'
      },
      {
        icon: '📄',
        text: '您的文章已发布',
        time: '6小时前'
      },
      {
        icon: '💬',
        text: '用户王五提交了新反馈',
        time: '1天前'
      }
    ],
    notices: [
      {
        title: '系统更新通知',
        content: '营养师功能已全面上线，祝您使用愉快！',
        time: '今天 09:30'
      }
    ],
    users: [
      {
        userId: 'U001',
        username: '张三',
        usernameInitial: '张',
        hasProfile: true,
        hasEvaluation: true,
        hasPlan: true,
        lastServiceTime: '2026-04-15'
      },
      {
        userId: 'U002',
        username: '李四',
        usernameInitial: '李',
        hasProfile: true,
        hasEvaluation: true,
        hasPlan: false,
        lastServiceTime: '2026-04-18'
      },
      {
        userId: 'U003',
        username: '王五',
        usernameInitial: '王',
        hasProfile: true,
        hasEvaluation: false,
        hasPlan: false,
        lastServiceTime: '2026-04-10'
      },
      {
        userId: 'U004',
        username: '赵六',
        usernameInitial: '赵',
        hasProfile: true,
        hasEvaluation: true,
        hasPlan: true,
        lastServiceTime: '2026-04-01'
      }
    ],
    pendingFeedbackCount: 3,
    feedbacks: [
      {
        id: 1,
        username: '张三',
        userInitial: '张',
        title: '关于计划执行问题',
        content: '今天的减脂餐感觉份量有点少，下午容易饿，能否调整一下？',
        status: '待回复',
        time: '2026-04-18 10:30',
        type: '计划执行'
      },
      {
        id: 2,
        username: '李四',
        userInitial: '李',
        title: '希望调整饮食口味',
        content: '不太喜欢清淡口味，能否增加一些有味道的菜品？',
        status: '待回复',
        time: '2026-04-17 15:20',
        type: '口味调整'
      },
      {
        id: 3,
        username: '王五',
        userInitial: '王',
        title: '执行效果很好',
        content: '按照计划执行了一周，体重下降了1公斤，感觉很好！',
        status: '待回复',
        time: '2026-04-16 09:00',
        type: '效果反馈'
      }
    ]
  },

  onLoad() {
    this.loadData();
  },

  loadData() {
    console.log('加载营养师工作台数据');
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
  },

  switchFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({
      filterType: filter
    });
    this.filterUsers();
  },

  switchFeedbackSubTab(e) {
    const subtab = e.currentTarget.dataset.subtab;
    this.setData({
      feedbackSubTab: subtab
    });
    this.loadFeedbacks();
  },

  onSearchUser(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
    this.filterUsers();
  },

  filterUsers() {
    console.log('筛选用户', this.data.filterType);
  },

  loadFeedbacks() {
    console.log('加载反馈列表', this.data.feedbackSubTab);
  },

  navigateToService() {
    this.setData({
      activeTab: 'service'
    });
  },

  navigateToArticle() {
    wx.showToast({
      title: '撰写文章功能开发中',
      icon: 'none'
    });
  },

  navigateToFeedback() {
    this.setData({
      activeTab: 'feedback',
      feedbackSubTab: 'pending'
    });
  },

  enterUserPanel(e) {
    const userId = e.currentTarget.dataset.userid;
    wx.navigateTo({
      url: '/pages/dietitian/service/user-panel?userId=' + userId
    });
  },

  viewFeedbackDetail(e) {
    const index = e.currentTarget.dataset.index;
    const feedback = this.data.feedbacks[index];
    wx.showToast({
      title: '查看反馈详情',
      icon: 'none'
    });
    console.log('查看反馈详情', feedback);
  },

  showPersonalCenter() {
    this.setData({
      showPersonalCenterModal: true
    });
  },

  hidePersonalCenter() {
    this.setData({
      showPersonalCenterModal: false
    });
  },

  stopPropagation() {},

  navigateToSettings() {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none'
    });
  },

  navigateToStatistics() {
    this.setData({
      activeTab: 'statistics'
    });
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.redirectTo({
            url: '/pages/auth/login/login'
          });
        }
      }
    });
  },

  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        wx.showToast({
          title: '头像已更新',
          icon: 'success'
        });
      }
    });
  },

  editProfile() {
    wx.showModal({
      title: '个人资料',
      content: '编辑个人资料功能开发中',
      showCancel: false
    });
  },

  changePassword() {
    wx.showModal({
      title: '修改密码',
      content: '修改密码功能开发中',
      showCancel: false
    });
  },

  viewServiceStats() {
    wx.showModal({
      title: '服务统计',
      content: '服务统计功能开发中',
      showCancel: false
    });
  },

  viewPlanStats() {
    wx.showModal({
      title: '计划统计',
      content: '计划统计功能开发中',
      showCancel: false
    });
  },

  viewHelp() {
    wx.showModal({
      title: '帮助中心',
      content: '帮助中心功能开发中',
      showCancel: false
    });
  },

  viewAbout() {
    wx.showModal({
      title: '关于我们',
      content: '膳食营养规划系统 v1.0',
      showCancel: false
    });
  }
})