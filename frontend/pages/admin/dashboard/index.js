// admin/dashboard/index.js
const api = require('../../../utils/api');

Page({
  data: {
    activeTab: 'home',
    auditSubTab: 'plans',
    manageSubTab: 'users',
    showAddDietitianModal: false,
    showPersonalCenterModal: false,
    statusOptions: ['启用', '禁用'],
    statusIndex: 0,
    formError: '',
    newDietitian: {
      name: '',
      title: '',
      specialty: '',
      contact: '',
      password: ''
    },
    dietitians: [],
    stats: {
      userCount: 128,
      dietitianCount: 15,
      pendingPlans: 3,
      pendingArticles: 2,
      todayUsers: 12,
      activeUsers: 86,
      completedPlans: 45,
      likedArticles: 230
    },
    recentActivities: [
      {
        icon: '👤',
        text: '新用户注册：张三',
        time: '2小时前'
      },
      {
        icon: '📋',
        text: '规划师提交新膳食计划',
        time: '4小时前'
      },
      {
        icon: '📄',
        text: '规划师发布健康文章',
        time: '6小时前'
      },
      {
        icon: '💬',
        text: '用户提交反馈：系统功能建议',
        time: '1天前'
      }
    ],
    notices: [
      {
        title: '系统更新通知',
        content: '系统将于明天凌晨2点进行维护更新，预计持续1小时',
        time: '今天 09:30'
      },
      {
        title: '安全提醒',
        content: '请及时更新管理员密码，确保系统安全',
        time: '昨天 15:45'
      }
    ],
    pendingPlans: [
      {
        id: 1,
        title: '减脂膳食计划',
        user: '张三',
        dietitian: '张医生',
        submitTime: '2026-04-18 09:30'
      },
      {
        id: 2,
        title: '控糖膳食计划',
        user: '李四',
        dietitian: '王医生',
        submitTime: '2026-04-18 10:15'
      }
    ],
    pendingArticles: [
      {
        id: 1,
        title: '科学饮食与健康生活',
        dietitian: '张医生',
        category: '饮食健康',
        preview: '本文将介绍科学饮食的重要性...'
      },
      {
        id: 2,
        title: '营养素的重要作用',
        dietitian: '王医生',
        category: '营养知识',
        preview: '营养素是人体必需的物质...'
      }
    ],
    pendingPlansCount: 2,
    pendingArticlesCount: 2,
    auditHistory: [
      {
        id: 1,
        title: '高血压患者膳食计划',
        type: '膳食计划',
        status: '通过',
        auditTime: '2026-04-17 16:30'
      },
      {
        id: 2,
        title: '如何正确补充蛋白质',
        type: '健康文章',
        status: '驳回',
        auditTime: '2026-04-17 15:45'
      }
    ],
    users: [
      {
        username: 'test',
        usernameInitial: 't',
        role: '普通用户',
        status: '正常'
      },
      {
        username: 'admin',
        usernameInitial: 'a',
        role: '管理员',
        status: '正常'
      },
      {
        username: 'D20260325001',
        usernameInitial: 'D',
        role: '营养师',
        status: '正常'
      }
    ],
    feedbacks: [
      {
        id: 1,
        title: '建议增加更多食谱',
        content: '希望能增加更多的健康食谱供用户选择...',
        status: '待处理',
        time: '2026-04-18 10:00'
      }
    ]
  },

  onLoad() {
    this.loadSystemStats();
    this.loadDietitians();
  },

  loadSystemStats() {
    console.log('加载系统统计数据');
  },

  loadDietitians() {
    api.admin.getAllDietitians()
    .then(res => {
      if (res.code === 200) {
        const list = res.data || [];
        const dietitians = list.map(item => ({
          ...item,
          nameInitial: item.name ? item.name.charAt(0) : '?'
        }));
        this.setData({
          dietitians: dietitians,
          'stats.dietitianCount': dietitians.length
        });
      }
    })
    .catch(() => {
      this.setData({
        dietitians: [{
          dietitian_id: 'D20260325001',
          name: '张医生',
          nameInitial: '张',
          title: '营养师',
          specialty: '临床营养',
          contact: '13800138002',
          status: '启用'
        }]
      });
    });
  },

  showAddDietitianForm() {
    this.setData({
      showAddDietitianModal: true,
      formError: '',
      newDietitian: {
        name: '',
        title: '',
        specialty: '',
        contact: '',
        password: ''
      },
      statusIndex: 0
    });
  },

  hideAddDietitianForm() {
    this.setData({
      showAddDietitianModal: false,
      formError: ''
    });
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

  bindDietitianName(e) {
    this.setData({
      'newDietitian.name': e.detail.value
    });
  },

  bindDietitianTitle(e) {
    this.setData({
      'newDietitian.title': e.detail.value
    });
  },

  bindDietitianSpecialty(e) {
    this.setData({
      'newDietitian.specialty': e.detail.value
    });
  },

  bindDietitianContact(e) {
    this.setData({
      'newDietitian.contact': e.detail.value
    });
  },

  bindDietitianPassword(e) {
    this.setData({
      'newDietitian.password': e.detail.value
    });
  },

  bindDietitianStatusChange(e) {
    this.setData({
      statusIndex: e.detail.value
    });
  },

  confirmAddDietitian() {
    const { name, title, specialty, contact, password } = this.data.newDietitian;
    const status = this.data.statusOptions[this.data.statusIndex];

    if (!name) {
      this.setData({ formError: '请输入规划师姓名' });
      return;
    }
    if (!title) {
      this.setData({ formError: '请输入职称' });
      return;
    }
    if (!specialty) {
      this.setData({ formError: '请输入专业领域' });
      return;
    }
    if (!contact) {
      this.setData({ formError: '请输入联系方式' });
      return;
    }
    if (!password || password.length < 6) {
      this.setData({ formError: '密码至少6位' });
      return;
    }

    api.admin.createDietitian({
      name: name,
      title: title,
      specialty: specialty,
      contact: contact,
      password: password,
      status: status
    })
    .then(res => {
      if (res.code === 200) {
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        });
        this.hideAddDietitianForm();
        this.loadDietitians();
      } else {
        this.setData({ formError: res.message || '添加失败' });
      }
    })
    .catch(() => {
      const newDietitian = {
        dietitian_id: 'D' + Date.now(),
        name: name,
        nameInitial: name.charAt(0),
        title: title,
        specialty: specialty,
        contact: contact,
        status: status
      };
      this.setData({
        dietitians: [...this.data.dietitians, newDietitian]
      });
      wx.showToast({
        title: '添加成功（模拟）',
        icon: 'success'
      });
      this.hideAddDietitianForm();
    });
  },

  toggleDietitianStatus(e) {
    const index = e.currentTarget.dataset.index;
    const dietitians = [...this.data.dietitians];
    const dietitian = dietitians[index];
    dietitian.status = dietitian.status === '启用' ? '禁用' : '启用';
    this.setData({
      dietitians: dietitians
    });
    wx.showToast({
      title: dietitian.status === '启用' ? '已启用' : '已禁用',
      icon: 'success'
    });
  },

  deleteDietitian(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该规划师吗？',
      success: (res) => {
        if (res.confirm) {
          const dietitians = [...this.data.dietitians];
          dietitians.splice(index, 1);
          this.setData({
            dietitians: dietitians,
            'stats.dietitianCount': dietitians.length
          });
          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
  },

  switchAuditSubTab(e) {
    const subtab = e.currentTarget.dataset.subtab;
    this.setData({
      auditSubTab: subtab
    });
  },

  switchManageSubTab(e) {
    const subtab = e.currentTarget.dataset.subtab;
    this.setData({
      manageSubTab: subtab
    });
  },

  approvePlan(e) {
    const index = e.currentTarget.dataset.index;
    const plans = [...this.data.pendingPlans];
    plans.splice(index, 1);
    this.setData({
      pendingPlans: plans,
      pendingPlansCount: plans.length
    });
    wx.showToast({
      title: '审核通过',
      icon: 'success'
    });
  },

  rejectPlan(e) {
    const index = e.currentTarget.dataset.index;
    const plans = [...this.data.pendingPlans];
    plans.splice(index, 1);
    this.setData({
      pendingPlans: plans,
      pendingPlansCount: plans.length
    });
    wx.showToast({
      title: '审核驳回',
      icon: 'success'
    });
  },

  approveArticle(e) {
    const index = e.currentTarget.dataset.index;
    const articles = [...this.data.pendingArticles];
    articles.splice(index, 1);
    this.setData({
      pendingArticles: articles,
      pendingArticlesCount: articles.length
    });
    wx.showToast({
      title: '审核通过',
      icon: 'success'
    });
  },

  rejectArticle(e) {
    const index = e.currentTarget.dataset.index;
    const articles = [...this.data.pendingArticles];
    articles.splice(index, 1);
    this.setData({
      pendingArticles: articles,
      pendingArticlesCount: articles.length
    });
    wx.showToast({
      title: '审核驳回',
      icon: 'success'
    });
  },

  editUser(e) {
    const index = e.currentTarget.dataset.index;
    const user = this.data.users[index];
    console.log('编辑用户:', user);
    wx.showToast({
      title: '编辑功能开发中',
      icon: 'none'
    });
  },

  toggleUserStatus(e) {
    const index = e.currentTarget.dataset.index;
    const users = [...this.data.users];
    const user = users[index];
    user.status = user.status === '正常' ? '已禁用' : '正常';
    this.setData({
      users: users
    });
    wx.showToast({
      title: user.status === '正常' ? '已启用' : '已禁用',
      icon: 'success'
    });
  },

  replyFeedback(e) {
    const index = e.currentTarget.dataset.index;
    const feedback = this.data.feedbacks[index];
    console.log('回复反馈:', feedback);
    wx.showToast({
      title: '回复功能开发中',
      icon: 'none'
    });
  },

  markFeedback(e) {
    const index = e.currentTarget.dataset.index;
    const feedbacks = [...this.data.feedbacks];
    feedbacks[index].status = '已处理';
    this.setData({
      feedbacks: feedbacks
    });
    wx.showToast({
      title: '已标记为已处理',
      icon: 'success'
    });
  },

  navigateToSettings() {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none'
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

  changePassword() {
    wx.showModal({
      title: '修改密码',
      content: '修改密码功能开发中',
      showCancel: false
    });
  }
})