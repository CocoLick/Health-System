const api = require('../../../utils/api');

// admin/audit/index.js
Page({
  data: {
    activeTab: 'plans',
    filterOptions: ['全部', '膳食计划', '健康文章', '通过', '驳回'],
    filterIndex: 0,
    pendingPlans: [],
    planLoading: false,
    planHint: '',
    showPlanDetailModal: false,
    selectedPlanDetail: null,
    planDetailLoading: false,
    pendingArticles: [],
    articleLoading: false,
    articleHint: '',
    showArticleDetailModal: false,
    selectedArticle: null,
    auditHistory: [
      {
        id: 1,
        title: '高血压患者膳食计划',
        type: '膳食计划',
        status: '通过',
        auditor: '管理员',
        auditTime: '2026-04-17 16:30'
      },
      {
        id: 2,
        title: '如何正确补充蛋白质',
        type: '健康文章',
        status: '驳回',
        auditor: '管理员',
        auditTime: '2026-04-17 15:45',
        reason: '内容需要进一步科学验证'
      }
    ],
    ingredientSubmissions: [],
    ingredientLoading: false,
    showIngredientDetailModal: false,
    selectedIngredientSubmission: null
  },

  onLoad() {
    // 加载待审核数据
    this.loadPendingData();
    this.loadPendingArticles();
    this.loadIngredientSubmissions();
  },

  onShow() {
    if (this.data.activeTab === 'plans') {
      this.loadPendingData();
    }
    if (this.data.activeTab === 'articles') {
      this.loadPendingArticles();
    }
    if (this.data.activeTab === 'ingredients') {
      this.loadIngredientSubmissions();
    }
  },

  loadPendingData() {
    this.setData({ planLoading: true, planHint: '' });
    api.dietPlan
      .adminPendingList()
      .then((res) => {
        if (res.code === 200) {
          const list = Array.isArray(res.data) ? res.data.map((x) => this.formatPendingPlan(x)) : [];
          this.setData({ pendingPlans: list });
          return;
        }
        this.setData({
          pendingPlans: [],
          planHint: res.message || '加载待审计划失败'
        });
      })
      .catch(() => {
        this.setData({
          pendingPlans: [],
          planHint: '网络错误，请稍后重试'
        });
      })
      .finally(() => {
        this.setData({ planLoading: false });
      });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
    if (tab === 'ingredients') {
      this.loadIngredientSubmissions();
      return;
    }
    if (tab === 'plans') {
      this.loadPendingData();
      return;
    }
    if (tab === 'articles') {
      this.loadPendingArticles();
    }
  },
  formatPendingPlan(item) {
    return {
      ...item,
      id: item.id,
      user_id: item.user_id,
      title: item.title || '-',
      user: item.user_id || '-',
      dietitian: item.dietitian_name || item.dietitian_id || '-',
      goal: item.goal || '-',
      submitTime: this.formatDateTimeText(item.update_time || item.create_time)
    };
  },

  formatDateTimeText(v) {
    const s = v ? String(v) : '';
    if (!s) return '-';
    return s.length >= 19 ? s.slice(0, 19).replace('T', ' ') : s.replace('T', ' ');
  },

  formatPendingArticle(item) {
    const vis = item.visibility === 'assigned' ? 'assigned' : 'public';
    const status = item.audit_status || 'pending_review';
    return {
      ...item,
      he_id: item.he_id,
      dietitian: item.dietitian_name || item.dietitian_id || '-',
      category: item.category || '未分类',
      submitTime: this.formatDateTimeText(item.updated_at || item.created_at),
      preview: item.summary || (item.body ? String(item.body).slice(0, 120) : '暂无摘要'),
      visibilityLabel: vis === 'assigned' ? '指派' : '公开',
      statusLabel: status === 'pending_review' ? '待审核' : status
    };
  },

  loadPendingArticles() {
    this.setData({ articleLoading: true, articleHint: '' });
    api.healthEducation
      .adminPendingList()
      .then((res) => {
        if (res.code === 200) {
          const list = Array.isArray(res.data) ? res.data.map((x) => this.formatPendingArticle(x)) : [];
          this.setData({ pendingArticles: list });
          return;
        }
        this.setData({
          pendingArticles: [],
          articleHint: res.message || '加载待审文章失败'
        });
      })
      .catch(() => {
        this.setData({
          pendingArticles: [],
          articleHint: '网络错误，请稍后重试'
        });
      })
      .finally(() => {
        this.setData({ articleLoading: false });
      });
  },


  noop() {},

  bindFilterChange(e) {
    this.setData({
      filterIndex: e.detail.value
    });
    // 根据筛选条件过滤审核历史
    this.filterAuditHistory();
  },

  filterAuditHistory() {
    // 实现筛选逻辑
    console.log('筛选审核历史');
  },

  approvePlan(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    api.dietPlan
      .adminReview(id, { action: 'approve' })
      .then((res) => {
        if (res.code === 200) {
          wx.showToast({ title: '审核通过', icon: 'success' });
          this.loadPendingData();
          return;
        }
        wx.showToast({ title: res.message || '操作失败', icon: 'none' });
      })
      .catch(() => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  rejectPlan(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '驳回膳食计划',
      editable: true,
      placeholderText: '请输入驳回原因',
      success: (r) => {
        if (!r.confirm) return;
        const reviewNote = (r.content || '').trim();
        if (!reviewNote) {
          wx.showToast({ title: '请填写驳回原因', icon: 'none' });
          return;
        }
        api.dietPlan
          .adminReview(id, { action: 'reject', review_note: reviewNote })
          .then((res) => {
            if (res.code === 200) {
              wx.showToast({ title: '已驳回', icon: 'success' });
              this.loadPendingData();
              return;
            }
            wx.showToast({ title: res.message || '操作失败', icon: 'none' });
          })
          .catch(() => {
            wx.showToast({ title: '网络错误', icon: 'none' });
          });
      }
    });
  },

  approveArticle(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    api.healthEducation
      .adminReview(id, { action: 'approve' })
      .then((res) => {
        if (res.code === 200) {
          wx.showToast({ title: '审核通过', icon: 'success' });
          this.loadPendingArticles();
          return;
        }
        wx.showToast({ title: res.message || '操作失败', icon: 'none' });
      })
      .catch(() => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  rejectArticle(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.showModal({
      title: '驳回健康文章',
      editable: true,
      placeholderText: '请输入驳回原因（可选）',
      success: (r) => {
        if (!r.confirm) {
          return;
        }
        api.healthEducation
          .adminReview(id, {
            action: 'reject',
            review_note: (r.content || '').trim()
          })
          .then((res) => {
            if (res.code === 200) {
              wx.showToast({ title: '已驳回', icon: 'success' });
              this.loadPendingArticles();
              return;
            }
            wx.showToast({ title: res.message || '操作失败', icon: 'none' });
          })
          .catch(() => {
            wx.showToast({ title: '网络错误', icon: 'none' });
          });
      }
    });
  },


  viewPlanDetail(e) {
    const item = e.currentTarget.dataset.item;
    if (!item || !item.id || !item.user_id) return;
    this.setData({ planDetailLoading: true });
    api.dietPlan
      .getDetail(item.id, { user_id: item.user_id })
      .then((res) => {
        if (res.code === 200 && res.data) {
          this.setData({
            selectedPlanDetail: res.data,
            showPlanDetailModal: true
          });
          return;
        }
        wx.showToast({ title: res.message || '加载详情失败', icon: 'none' });
      })
      .catch(() => {
        wx.showToast({ title: '加载详情失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ planDetailLoading: false });
      });
  },

  hidePlanDetailModal() {
    this.setData({
      showPlanDetailModal: false,
      selectedPlanDetail: null
    });
  },

  viewArticleDetail(e) {
    const item = e.currentTarget.dataset.item;
    if (!item || !item.he_id) {
      return;
    }
    api.healthEducation
      .getDetail(item.he_id)
      .then((res) => {
        if (res.code === 200 && res.data) {
          const article = this.formatPendingArticle(res.data);
          this.setData({
            selectedArticle: article,
            showArticleDetailModal: true
          });
          return;
        }
        wx.showToast({ title: res.message || '加载详情失败', icon: 'none' });
      })
      .catch(() => {
        wx.showToast({ title: '加载详情失败', icon: 'none' });
      });
  },

  hideArticleDetailModal() {
    this.setData({
      showArticleDetailModal: false,
      selectedArticle: null
    });
  },

  viewAuditDetail(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.auditHistory[index];
    console.log('查看审核详情:', record);
    // 跳转到详情页面
  },

  loadIngredientSubmissions() {
    this.setData({ ingredientLoading: true });
    api.ingredient.getSubmissionList({ workflow_status: 'pending', page: 1, page_size: 100 })
      .then((res) => {
        if (res.code === 200 && res.data) {
          const items = (res.data.items || []).map((it) => ({
            ...it,
            riskText: it.auto_check_result === 'abnormal' ? '异常' : '正常',
            deltaPct: `${((it.auto_delta_ratio || 0) * 100).toFixed(1)}%`,
            submitTimeText: it.created_at ? String(it.created_at).replace('T', ' ').slice(0, 19) : '-'
          }));
          this.setData({ ingredientSubmissions: items });
        }
      })
      .catch(() => {
        wx.showToast({ title: '加载食材审核失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ ingredientLoading: false });
      });
  },

  approveIngredient(e) {
    const submissionId = e.currentTarget.dataset.id;
    api.ingredient.approveSubmission(submissionId, { review_note: '管理员审核通过' })
      .then((res) => {
        if (res.code === 200) {
          wx.showToast({ title: '审核通过', icon: 'success' });
          this.loadIngredientSubmissions();
          return;
        }
        wx.showToast({ title: res.message || '操作失败', icon: 'none' });
      })
      .catch(() => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  returnIngredient(e) {
    const submissionId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '退回提交',
      editable: true,
      placeholderText: '请输入退回原因',
      success: (modalRes) => {
        if (!modalRes.confirm) return;
        const reviewNote = (modalRes.content || '').trim();
        if (!reviewNote) {
          wx.showToast({ title: '请填写退回原因', icon: 'none' });
          return;
        }
        api.ingredient.returnSubmission(submissionId, { review_note: reviewNote })
          .then((res) => {
            if (res.code === 200) {
              wx.showToast({ title: '已退回', icon: 'success' });
              this.loadIngredientSubmissions();
              return;
            }
            wx.showToast({ title: res.message || '操作失败', icon: 'none' });
          })
          .catch(() => {
            wx.showToast({ title: '网络错误', icon: 'none' });
          });
      }
    });
  },

  viewIngredientDetail(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    this.setData({
      selectedIngredientSubmission: item,
      showIngredientDetailModal: true
    });
  },

  hideIngredientDetailModal() {
    this.setData({
      showIngredientDetailModal: false,
      selectedIngredientSubmission: null
    });
  }
})