// dietitian/dashboard/index.js
const api = require('../../../utils/api');

const MAX_SPECIALTY_COUNT = 5;
const MAX_SPECIALTY_LENGTH = 20;

function normalizeSpecialtyInput(raw) {
  const text = String(raw || '').replace(/[，、；;\n]/g, ',');
  const parts = text.split(',');
  const out = [];
  const seen = {};
  for (let i = 0; i < parts.length; i += 1) {
    const item = parts[i].trim();
    if (!item) continue;
    if (item.length > MAX_SPECIALTY_LENGTH) {
      return { ok: false, message: `单个擅长方向最多${MAX_SPECIALTY_LENGTH}个字` };
    }
    const key = item.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(item);
    if (out.length > MAX_SPECIALTY_COUNT) {
      return { ok: false, message: `擅长方向最多填写${MAX_SPECIALTY_COUNT}项` };
    }
  }
  if (!out.length) {
    return { ok: false, message: '请至少填写1个擅长方向' };
  }
  return { ok: true, text: out.join(',') };
}

function parseSpecialtyTags(raw) {
  return String(raw || '')
    .replace(/[，、；;\n]/g, ',')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildSpecialtyRaw(tags, inputValue) {
  const merged = (Array.isArray(tags) ? tags.slice() : []).concat(String(inputValue || '').trim());
  return merged.filter(Boolean).join(',');
}

Page({
  data: {
    activeTab: 'home',
    serviceSubTab: 'requests',
    filterType: 'pending',
    feedbackSubTab: 'pending',
    searchKeyword: '',
    showPersonalCenterModal: false,
    showProfileEditor: false,
    profileLoading: false,
    profileSaving: false,
    profileSpecialtyTags: [],
    profileSpecialtyInput: '',
    dietitianName: '营养师',
    profileData: {
      account_id: '',
      username: '',
      name: '',
      title: '',
      specialty: '',
      introduction: '',
      contact: '',
      status: '',
      role_type: '',
      created_at: '',
      updated_at: ''
    },
    profileForm: {
      name: '',
      title: '',
      specialty: '',
      introduction: '',
      contact: ''
    },
    stats: {
      pendingPlans: 0,
      pendingArticles: 1,
      pendingFeedbacks: 0,
      serviceUsers: 0,
      totalPlans: 18,
      totalArticles: 5,
      totalReplies: 42,
      avgRating: 4.8,
      pendingRequests: 0
    },
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
    heStatusLabels: ['全部', '草稿', '待审核', '已驳回', '已发布'],
    heStatusIndex: 0,
    heVisLabels: ['全部', '公开', '指派'],
    heVisIndex: 0,
    // 首页「服务动态」由 loadServiceRequests 实时生成
    homeServiceFeed: []
  },

  onLoad() {
    this.loadData();
    this.loadServiceRequests();
    this.loadPendingFeedbackCount();
    this.loadDietitianProfile();
  },

  onShow() {
    this.loadServiceUsers();
    this.loadServiceRequests();
    this.loadHealthEducationList();
    this.loadPendingFeedbackCount();
    this.loadDietitianProfile();
    if (this.data.activeTab === 'feedback') {
      this.loadFeedbacks();
    }
  },

  formatProfileDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  syncUserInfoToStorage(profileData) {
    if (!profileData) return;
    const old = wx.getStorageSync('userInfo') || {};
    const next = Object.assign({}, old, {
      user_id: profileData.account_id,
      username: profileData.username,
      name: profileData.name,
      title: profileData.title,
      specialty: profileData.specialty,
      introduction: profileData.introduction,
      contact: profileData.contact,
      status: profileData.status,
      role_type: profileData.role_type
    });
    wx.setStorageSync('userInfo', next);
  },

  loadDietitianProfile() {
    this.setData({ profileLoading: true });
    api.dietitian.getProfile()
      .then((res) => {
        if ((res.code !== 200 && res.code !== '200') || !res.data) {
          wx.showToast({
            title: res.message || '资料加载失败',
            icon: 'none'
          });
          return;
        }
        const row = res.data;
        const profileData = {
          account_id: row.account_id || '',
          username: row.username || '',
          name: row.name || '',
          title: row.title || '',
          specialty: row.specialty || '',
          introduction: row.introduction || '',
          contact: row.contact || '',
          status: row.status || '',
          role_type: row.role_type || '',
          created_at: this.formatProfileDate(row.created_at),
          updated_at: this.formatProfileDate(row.updated_at)
        };
        const displayName = profileData.name || profileData.username || '营养师';
        this.setData({
          profileData,
          dietitianName: displayName,
          profileSpecialtyTags: parseSpecialtyTags(profileData.specialty),
          profileSpecialtyInput: '',
          'stats.totalPlans': Number(row.total_plans || 0),
          'stats.avgRating': Number(row.avg_rating || 0),
          profileForm: {
            name: profileData.name,
            title: profileData.title,
            specialty: profileData.specialty,
            introduction: profileData.introduction,
            contact: profileData.contact
          }
        });
        this.syncUserInfoToStorage(row);
      })
      .catch((err) => {
        console.error('加载规划师资料失败:', err);
        wx.showToast({
          title: '资料加载失败',
          icon: 'none'
        });
      })
      .finally(() => {
        this.setData({ profileLoading: false });
      });
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
            planAuditStatus: user.plan_audit_status || '',
            planStatusText: this.getPlanStatusText(user.has_plan, user.plan_audit_status),
            planStatusClass: this.getPlanStatusClass(user.has_plan, user.plan_audit_status),
            lastServiceTime: user.last_service_time
          }));
          // 待制定计划 = 已建立服务关系但本规划师尚未创建膳食计划的用户数（与「计划 待生成」列一致）
          const pendingPlans = processedUsers.filter((u) => !u.hasPlan || u.planAuditStatus === 'rejected').length;
          this.setData({
            users: processedUsers,
            'stats.serviceUsers': users.length,
            'stats.pendingPlans': pendingPlans
          });
        } else {
          this.setData({ users: [], 'stats.serviceUsers': 0, 'stats.pendingPlans': 0 });
        }
      })
      .catch((err) => {
        console.error('加载服务用户失败:', err);
        this.setData({
          'stats.serviceUsers': 0,
          'stats.pendingPlans': 0
        });
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
          const processedRequests = requests.map((req) => {
            const uid = (req.user_id && String(req.user_id)) || '';
            return {
              ...req,
              statusText: this.getStatusText(req.status),
              serviceTypeText: this.getServiceTypeText(req.service_type),
              dietGoalText: this.getDietGoalText(req.diet_goal, req.other_goal),
              createTimeText: this.formatDate(req.create_time),
              updateTimeText: this.formatDate(req.update_time || req.create_time),
              user_initial: uid ? uid.trim().charAt(0) : '?'
            };
          });
          console.log('处理后数据:', JSON.stringify(processedRequests, null, 2));
          // 按状态分组
          const pendingRequests = processedRequests.filter((r) => r.status === 'pending');
          const homeServiceFeed = this.buildHomeServiceFeed(processedRequests);
          this.setData({
            serviceRequests: processedRequests,
            filteredRequests: processedRequests,
            'stats.pendingRequests': pendingRequests.length,
            homeServiceFeed
          });
          this.filterRequests();
        } else {
          this.setData({ serviceRequests: [], filteredRequests: [], homeServiceFeed: [] });
        }
      })
      .catch((err) => {
        console.error('加载服务请求失败:', err);
        this.setData({ homeServiceFeed: [] });
      });
  },

  /** 首页服务动态：按最近更新时间取最多 5 条 */
  buildHomeServiceFeed(processedRequests) {
    const list = (processedRequests || [])
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.update_time || a.create_time).getTime();
        const tb = new Date(b.update_time || b.create_time).getTime();
        return tb - ta;
      })
      .slice(0, 5);
    return list.map((r) => ({
      requestId: r.request_id,
      status: r.status,
      statusText: r.statusText,
      userId: r.user_id,
      serviceTypeText: r.serviceTypeText,
      timeText: r.updateTimeText || r.createTimeText
    }));
  },

  /** 详情弹窗展示用：补全 user_initial 等 */
  ensureRequestDetailShape(req) {
    if (!req) return null;
    const uid = req.user_id != null ? String(req.user_id) : '';
    const initial = req.user_initial || (uid.trim() ? uid.trim().charAt(0) : '?');
    return { ...req, user_initial: initial };
  },

  onHomeFeedTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    const { serviceRequests } = this.data;
    const found = (serviceRequests || []).find((r) => r.request_id === id);
    if (!found) {
      return;
    }
    this.setData({
      activeTab: 'service',
      serviceSubTab: 'requests',
      filterType: 'all',
      searchKeyword: '',
      selectedRequest: this.ensureRequestDetailShape(found),
      showRequestDetail: true
    });
    this.filterRequests();
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
      selectedRequest: this.ensureRequestDetailShape(request),
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

  getPlanStatusText(hasPlan, auditStatus) {
    const s = String(auditStatus || '').trim().toLowerCase();
    if (!hasPlan) return '计划 待生成';
    if (s === 'rejected' || s === '已驳回') return '计划 已驳回';
    if (s === 'pending_review' || s === '待审核') return '计划 待审核';
    if (s === 'approved' || s === '已通过' || s === '已发布') return '计划 已发布';
    return '计划 已生成';
  },

  getPlanStatusClass(hasPlan, auditStatus) {
    const s = String(auditStatus || '').trim().toLowerCase();
    if (!hasPlan) return 'status-warning';
    if (s === 'approved' || s === '已通过' || s === '已发布') return 'status-ok';
    return 'status-warning';
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
    const displayStatus = this.resolveHeDisplayStatus(raw);
    return Object.assign({}, raw, {
      targetNamesText: names.length ? names.join('、') : '',
      updated_at: timeText,
      display_status_key: displayStatus.key,
      display_status_text: displayStatus.text,
      reject_reason: (raw.review_note || '').trim()
    });
  },

  ensureHeDisplayStatusFields(item) {
    const row = item || {};
    const status = this.resolveHeDisplayStatus(row);
    return Object.assign({}, row, {
      display_status_key: row.display_status_key || status.key,
      display_status_text: row.display_status_text || status.text
    });
  },

  resolveHeDisplayStatus(raw) {
    const cs = (raw && raw.content_status) || '';
    const as = (raw && raw.audit_status) || '';
    if (cs === 'draft') {
      return { key: 'draft', text: '草稿' };
    }
    if (cs === 'published' && as === 'pending_review') {
      return { key: 'pending_review', text: '待审核' };
    }
    if (cs === 'published' && as === 'rejected') {
      return { key: 'rejected', text: '已驳回' };
    }
    if (cs === 'published' && as === 'approved') {
      return { key: 'published', text: '已发布' };
    }
    return { key: 'draft', text: '草稿' };
  },

  loadHealthEducationList() {
    api.healthEducation
      .list({})
      .then((res) => {
        if (res.code !== 200 && res.code !== '200') {
          return;
        }
        const raw = res.data || [];
        const list = raw.map((x) => this.formatHeItem(x));
        const draftCount = list.filter((x) => x.display_status_key === 'draft').length;
        this.setData({ heList: list, heDraftCount: draftCount });
        this.applyHeFilters();
      })
      .catch(() => {});
  },

  applyHeFilters() {
    const { heList, heStatusIndex, heVisIndex } = this.data;
    let rows = heList.map((x) => this.ensureHeDisplayStatusFields(x));
    if (heStatusIndex === 1) {
      rows = rows.filter((x) => x.display_status_key === 'draft');
    } else if (heStatusIndex === 2) {
      rows = rows.filter((x) => x.display_status_key === 'pending_review');
    } else if (heStatusIndex === 3) {
      rows = rows.filter((x) => x.display_status_key === 'rejected');
    } else if (heStatusIndex === 4) {
      rows = rows.filter((x) => x.display_status_key === 'published');
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
    const p = this.data.profileData || {};
    this.hidePersonalCenter();
    this.setData({
      showProfileEditor: true,
      profileForm: {
        name: p.name || '',
        title: p.title || '',
        specialty: p.specialty || '',
        introduction: p.introduction || '',
        contact: p.contact || ''
      },
      profileSpecialtyTags: parseSpecialtyTags(p.specialty),
      profileSpecialtyInput: ''
    });
  },

  closeProfileEditor() {
    this.setData({ showProfileEditor: false });
  },

  onProfileInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    if (field === 'specialty') {
      this.setData({
        profileSpecialtyInput: e.detail.value
      });
      return;
    }
    this.setData({
      [`profileForm.${field}`]: e.detail.value
    });
  },

  addProfileSpecialtyTag() {
    const raw = buildSpecialtyRaw(this.data.profileSpecialtyTags, this.data.profileSpecialtyInput);
    if (!raw) return;
    const result = normalizeSpecialtyInput(raw);
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' });
      return;
    }
    const tags = parseSpecialtyTags(result.text);
    this.setData({
      profileSpecialtyTags: tags,
      profileSpecialtyInput: '',
      'profileForm.specialty': result.text
    });
  },

  removeProfileSpecialtyTag(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const tags = this.data.profileSpecialtyTags.slice();
    if (Number.isNaN(idx) || idx < 0 || idx >= tags.length) return;
    tags.splice(idx, 1);
    this.setData({
      profileSpecialtyTags: tags,
      'profileForm.specialty': tags.join(',')
    });
  },

  submitProfileEdit() {
    const form = this.data.profileForm || {};
    const specialtyResult = normalizeSpecialtyInput(
      buildSpecialtyRaw(this.data.profileSpecialtyTags, this.data.profileSpecialtyInput)
    );
    const payload = {
      name: String(form.name || '').trim(),
      title: String(form.title || '').trim(),
      specialty: specialtyResult.ok ? specialtyResult.text : '',
      introduction: String(form.introduction || '').trim(),
      contact: String(form.contact || '').trim()
    };
    if (!payload.name || !payload.title || !payload.contact) {
      wx.showToast({
        title: '请完整填写必填项',
        icon: 'none'
      });
      return;
    }
    if (!specialtyResult.ok) {
      wx.showToast({
        title: specialtyResult.message,
        icon: 'none'
      });
      return;
    }
    this.setData({ profileSaving: true });
    api.dietitian.updateProfile(payload)
      .then((res) => {
        if (res.code !== 200 || !res.data) {
          wx.showToast({
            title: res.message || '保存失败',
            icon: 'none'
          });
          return;
        }
        wx.showToast({
          title: '资料已更新',
          icon: 'success'
        });
        this.closeProfileEditor();
        this.loadDietitianProfile();
      })
      .catch((err) => {
        console.error('更新规划师资料失败:', err);
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      })
      .finally(() => {
        this.setData({ profileSaving: false });
      });
  },

  changePassword() {
    wx.navigateTo({
      url: '/pages/user/settings/index'
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