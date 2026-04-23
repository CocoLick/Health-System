// dietitian/dashboard/index.js
const api = require('../../../utils/api');

Page({
  data: {
    activeTab: 'home',
    serviceSubTab: 'requests',
    filterType: 'pending',
    feedbackSubTab: 'pending',
    searchKeyword: '',
    showPersonalCenterModal: false,
    dietitianName: '营养师',
    stats: {
      pendingPlans: 3,
      pendingArticles: 1,
      pendingFeedbacks: 0,
      serviceUsers: 0,
      totalPlans: 18,
      totalArticles: 5,
      totalReplies: 42,
      avgRating: 4.8,
      pendingRequests: 0
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
    users: [],
    pendingFeedbackCount: 0,
    feedbacks: [],
    // 服务请求相关数据
    serviceRequests: [],
    filteredRequests: [],
    selectedRequest: null,
    showRequestDetail: false,
    heList: [],
    heFilteredList: [],
    heDraftCount: 0,
    heStatusLabels: ['全部', '草稿', '已发布'],
    heStatusIndex: 0,
    heVisLabels: ['全部', '公开', '指派'],
    heVisIndex: 0
  },

  onLoad() {
    this.loadData();
    this.loadServiceRequests();
    this.loadPendingFeedbackCount();
  },

  onShow() {
    this.loadServiceUsers();
    this.loadServiceRequests();
    this.loadHealthEducationList();
    this.loadPendingFeedbackCount();
    if (this.data.activeTab === 'feedback') {
      this.loadFeedbacks();
    }
  },

  loadData() {
    console.log('加载营养师工作台数据');
    // 加载服务用户列表
    this.loadServiceUsers();
  },

  // 加载服务用户列表
  loadServiceUsers() {
    console.log('加载服务用户列表');
    api.serviceRequest.getDietitianUsers()
      .then(res => {
        console.log('服务用户列表API响应:', res);
        if (res.code === 200) {
          const users = res.data || [];
          console.log('用户列表长度:', users.length);
          // 转换数据格式，确保与前端期望的格式一致
          const processedUsers = users.map(user => ({
            userId: user.user_id,
            username: user.username,
            usernameInitial: user.username_initial,
            hasProfile: user.has_profile,
            hasEvaluation: user.has_evaluation,
            hasPlan: user.has_plan,
            lastServiceTime: user.last_service_time
          }));
          this.setData({
            users: processedUsers,
            'stats.serviceUsers': users.length
          });
        }
      })
      .catch(err => {
        console.error('加载服务用户失败:', err);
      });
  },

  // 加载服务请求列表
  loadServiceRequests() {
    console.log('加载服务请求列表');
    api.serviceRequest.getDietitianList()
      .then(res => {
        console.log('服务请求列表API响应:', res);
        console.log('响应数据:', JSON.stringify(res.data, null, 2));
        if (res.code === 200) {
          const requests = res.data || [];
          console.log('请求列表长度:', requests.length);
          // 预处理所有请求，添加中文翻译字段
          const processedRequests = requests.map(req => ({
            ...req,
            statusText: this.getStatusText(req.status),
            serviceTypeText: this.getServiceTypeText(req.service_type),
            dietGoalText: this.getDietGoalText(req.diet_goal, req.other_goal),
            createTimeText: this.formatDate(req.create_time)
          }));
          console.log('处理后数据:', JSON.stringify(processedRequests, null, 2));
          // 按状态分组
          const pendingRequests = processedRequests.filter(r => r.status === 'pending');
          this.setData({
            serviceRequests: processedRequests,
            filteredRequests: processedRequests,
            'stats.pendingRequests': pendingRequests.length
          });
          this.filterRequests();
        }
      })
      .catch(err => {
        console.error('加载服务请求失败:', err);
      });
  },

  // 筛选服务请求
  filterRequests() {
    const { serviceRequests, filterType, searchKeyword } = this.data;
    let filtered = serviceRequests;

    // 按状态筛选
    if (filterType === 'pending') {
      filtered = filtered.filter(r => r.status === 'pending');
    } else if (filterType === 'approved') {
      filtered = filtered.filter(r => r.status === 'approved');
    }
    // 'all' 包含所有状态的申请（pending, approved, rejected, cancelled, completed）

    // 按关键词搜索
    if (searchKeyword) {
      filtered = filtered.filter(r =>
        r.user_id && r.user_id.includes(searchKeyword)
      );
    }

    this.setData({ filteredRequests: filtered });
  },

  // 查看服务请求详情
  viewRequestDetail(e) {
    const index = e.currentTarget.dataset.index;
    const request = this.data.filteredRequests[index];
    this.setData({
      selectedRequest: request,
      showRequestDetail: true
    });
  },

  // 关闭服务请求详情
  closeRequestDetail() {
    this.setData({
      selectedRequest: null,
      showRequestDetail: false
    });
  },

  // 批准服务请求
  approveRequest(e) {
    const requestId = e.currentTarget.dataset.requestid;
    wx.showModal({
      title: '批准申请',
      content: '确定要批准此服务申请吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          api.serviceRequest.approve(requestId)
            .then(res => {
              wx.hideLoading();
              if (res.code === 200) {
                wx.showToast({ title: '已批准申请', icon: 'success' });
                this.closeRequestDetail();
                this.loadServiceRequests();
                this.loadServiceUsers();
              } else {
                wx.showToast({ title: '操作失败', icon: 'none' });
              }
            })
            .catch(err => {
              wx.hideLoading();
              console.error('批准申请失败:', err);
              wx.showToast({ title: '网络错误', icon: 'none' });
            });
        }
      }
    });
  },

  // 拒绝服务请求
  rejectRequest(e) {
    const requestId = e.currentTarget.dataset.requestid;
    wx.showModal({
      title: '拒绝申请',
      content: '确定要拒绝此服务申请吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          api.serviceRequest.reject(requestId)
            .then(res => {
              wx.hideLoading();
              if (res.code === 200) {
                wx.showToast({ title: '已拒绝申请', icon: 'success' });
                this.closeRequestDetail();
                this.loadServiceRequests();
                this.loadServiceUsers();
              } else {
                wx.showToast({ title: '操作失败', icon: 'none' });
              }
            })
            .catch(err => {
              wx.hideLoading();
              console.error('拒绝申请失败:', err);
              wx.showToast({ title: '网络错误', icon: 'none' });
            });
        }
      }
    });
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待处理',
      'approved': '已通过',
      'rejected': '已拒绝',
      'cancelled': '已取消',
      'completed': '已完成'
    };
    return statusMap[status] || status;
  },

  // 获取服务类型文本
  getServiceTypeText(type) {
    const typeMap = {
      'diet_plan': '膳食计划定制',
      'nutrition_consult': '营养咨询服务',
      'health_management': '健康管理服务'
    };
    return typeMap[type] || type;
  },

  // 获取饮食目标文本
  getDietGoalText(goal, otherGoal) {
    if (goal === 'other' && otherGoal) {
      return otherGoal;
    }
    const goalMap = {
      'weight_loss': '减脂',
      'weight_gain': '增重',
      'diabetes_control': '控糖',
      'health_maintain': '养生',
      'sports_nutrition': '运动营养',
      'pregnancy': '孕期营养'
    };
    return goalMap[goal] || goal;
  },

  // 格式化日期
  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
    if (tab === 'feedback') {
      this.loadFeedbacks();
    }
    if (tab === 'home') {
      this.loadPendingFeedbackCount();
    }
  },

  loadPendingFeedbackCount() {
    const ui = wx.getStorageSync('userInfo');
    if (!ui || ui.role_type !== 'dietitian') {
      return;
    }
    api.feedback
      .pendingCount()
      .then((res) => {
        if (res.code === 200 && res.data) {
          const c = res.data.count != null ? Number(res.data.count) : 0;
          this.setData({
            pendingFeedbackCount: c,
            'stats.pendingFeedbacks': c
          });
        }
      })
      .catch(() => {});
  },

  formatFeedbackListTime(iso) {
    if (!iso) {
      return '';
    }
    const s = String(iso);
    return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
  },

  loadFeedbacks() {
    const ui = wx.getStorageSync('userInfo');
    if (!ui || ui.role_type !== 'dietitian') {
      return;
    }
    const status = this.data.feedbackSubTab === 'pending' ? 'pending' : 'replied';
    api.feedback
      .listDietitian({ status })
      .then((res) => {
        if (res.code === 200) {
          const rows = (res.data || []).map((r) =>
            Object.assign({}, r, {
              display_time: this.formatFeedbackListTime(r.created_at)
            })
          );
          this.setData({ feedbacks: rows });
        }
      })
      .catch(() => {
        this.setData({ feedbacks: [] });
      });
  },

  switchServiceSubTab(e) {
    const subtab = e.currentTarget.dataset.subtab;
    this.setData({
      serviceSubTab: subtab
    });
    if (subtab === 'education') {
      this.loadHealthEducationList();
    }
  },

  formatHeItem(raw) {
    const users = raw.target_users || [];
    const names = users.map((u) => u.username || u.user_id).filter(Boolean);
    let timeText = '';
    if (raw.updated_at) {
      const s = String(raw.updated_at);
      timeText = s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
    }
    return Object.assign({}, raw, {
      targetNamesText: names.length ? names.join('、') : '',
      updated_at: timeText
    });
  },

  loadHealthEducationList() {
    api.healthEducation
      .list({})
      .then((res) => {
        if (res.code !== 200) {
          return;
        }
        const raw = res.data || [];
        const list = raw.map((x) => this.formatHeItem(x));
        const draftCount = list.filter((x) => x.content_status === 'draft').length;
        this.setData({ heList: list, heDraftCount: draftCount });
        this.applyHeFilters();
      })
      .catch(() => {});
  },

  applyHeFilters() {
    const { heList, heStatusIndex, heVisIndex } = this.data;
    let rows = heList.slice();
    if (heStatusIndex === 1) {
      rows = rows.filter((x) => x.content_status === 'draft');
    } else if (heStatusIndex === 2) {
      rows = rows.filter((x) => x.content_status === 'published');
    }
    if (heVisIndex === 1) {
      rows = rows.filter((x) => x.visibility === 'public');
    } else if (heVisIndex === 2) {
      rows = rows.filter((x) => x.visibility === 'assigned');
    }
    this.setData({ heFilteredList: rows });
  },

  onHeStatusPick(e) {
    const idx = Number(e.detail.value) || 0;
    this.setData({ heStatusIndex: idx });
    this.applyHeFilters();
  },

  onHeVisPick(e) {
    const idx = Number(e.detail.value) || 0;
    this.setData({ heVisIndex: idx });
    this.applyHeFilters();
  },

  navigateToHealthEducationTab() {
    this.setData({
      activeTab: 'service',
      serviceSubTab: 'education'
    });
    this.loadHealthEducationList();
  },

  navigateToHealthEducationNew() {
    wx.navigateTo({
      url: '/pages/dietitian/health-education/edit'
    });
  },

  openHealthEducationEdit(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({
      url: '/pages/dietitian/health-education/edit?id=' + encodeURIComponent(id)
    });
  },

  switchFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({
      filterType: filter
    });
    this.filterRequests();
  },

  switchFeedbackSubTab(e) {
    const subtab = e.currentTarget.dataset.subtab;
    this.setData({
      feedbackSubTab: subtab
    });
    this.loadFeedbacks();
    this.loadPendingFeedbackCount();
  },

  onSearchUser(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
    this.filterRequests();
  },

  filterUsers() {
    console.log('筛选用户', this.data.filterType);
    const { searchKeyword, users } = this.data;
    if (!searchKeyword) {
      // 如果没有搜索关键词，显示所有用户
      this.setData({ users: users });
      return;
    }
    // 根据搜索关键词筛选用户
    const filteredUsers = users.filter(user =>
      user.username.includes(searchKeyword) || user.userId.includes(searchKeyword)
    );
    this.setData({ users: filteredUsers });
  },

  navigateToService() {
    this.setData({
      activeTab: 'service'
    });
  },

  navigateToArticle() {
    this.navigateToHealthEducationTab();
  },

  navigateToFeedback() {
    this.setData({
      activeTab: 'feedback',
      feedbackSubTab: 'pending'
    });
    this.loadFeedbacks();
    this.loadPendingFeedbackCount();
  },

  enterUserPanel(e) {
    const userId = e.currentTarget.dataset.userid;
    wx.navigateTo({
      url: '/pages/dietitian/service/user-panel?userId=' + userId
    });
  },

  viewFeedbackDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({
      url: '/pages/dietitian/feedback/detail/index?id=' + encodeURIComponent(id)
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