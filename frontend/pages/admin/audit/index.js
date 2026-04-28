const api = require('../../../utils/api');

// admin/audit/index.js
Page({
  data: {
    activeTab: 'plans',
    filterOptions: ['全部', '膳食计划', '健康文章', '通过', '驳回'],
    filterIndex: 0,
    pendingPlans: [
      {
        id: 1,
        title: '减脂膳食计划',
        user: '张三',
        dietitian: '张医生',
        goal: '减脂',
        submitTime: '2026-04-18 09:30'
      },
      {
        id: 2,
        title: '控糖膳食计划',
        user: '李四',
        dietitian: '王医生',
        goal: '控糖',
        submitTime: '2026-04-18 10:15'
      },
      {
        id: 3,
        title: '增肌膳食计划',
        user: '王五',
        dietitian: '李医生',
        goal: '增肌',
        submitTime: '2026-04-18 11:00'
      }
    ],
    pendingArticles: [
      {
        id: 1,
        title: '科学饮食与健康生活',
        dietitian: '张医生',
        category: '饮食健康',
        submitTime: '2026-04-18 08:45',
        preview: '本文将介绍科学饮食的重要性，以及如何通过合理的饮食搭配来维持身体健康...'
      },
      {
        id: 2,
        title: '营养素的重要作用',
        dietitian: '王医生',
        category: '营养知识',
        submitTime: '2026-04-18 09:20',
        preview: '营养素是人体必需的物质，本文将详细介绍各种营养素的功能和食物来源...'
      }
    ],
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
    this.loadIngredientSubmissions();
  },

  onShow() {
    if (this.data.activeTab === 'ingredients') {
      this.loadIngredientSubmissions();
    }
  },

  loadPendingData() {
    // 模拟API请求获取待审核数据
    console.log('加载待审核数据');
    // 实际项目中应该调用后端API
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
    if (tab === 'ingredients') {
      this.loadIngredientSubmissions();
    }
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
    const index = e.currentTarget.dataset.index;
    const plans = [...this.data.pendingPlans];
    const plan = plans[index];
    
    // 模拟审核通过
    console.log('通过膳食计划:', plan.title);
    
    // 从待审核列表中移除
    plans.splice(index, 1);
    this.setData({
      pendingPlans: plans
    });
    
    // 显示成功提示
    wx.showToast({
      title: '审核通过',
      icon: 'success'
    });
  },

  rejectPlan(e) {
    const index = e.currentTarget.dataset.index;
    const plans = [...this.data.pendingPlans];
    const plan = plans[index];
    
    // 模拟审核驳回
    console.log('驳回膳食计划:', plan.title);
    
    // 从待审核列表中移除
    plans.splice(index, 1);
    this.setData({
      pendingPlans: plans
    });
    
    // 显示成功提示
    wx.showToast({
      title: '审核驳回',
      icon: 'success'
    });
  },

  approveArticle(e) {
    const index = e.currentTarget.dataset.index;
    const articles = [...this.data.pendingArticles];
    const article = articles[index];
    
    // 模拟审核通过
    console.log('通过健康文章:', article.title);
    
    // 从待审核列表中移除
    articles.splice(index, 1);
    this.setData({
      pendingArticles: articles
    });
    
    // 显示成功提示
    wx.showToast({
      title: '审核通过',
      icon: 'success'
    });
  },

  rejectArticle(e) {
    const index = e.currentTarget.dataset.index;
    const articles = [...this.data.pendingArticles];
    const article = articles[index];
    
    // 模拟审核驳回
    console.log('驳回健康文章:', article.title);
    
    // 从待审核列表中移除
    articles.splice(index, 1);
    this.setData({
      pendingArticles: articles
    });
    
    // 显示成功提示
    wx.showToast({
      title: '审核驳回',
      icon: 'success'
    });
  },

  viewPlanDetail(e) {
    const index = e.currentTarget.dataset.index;
    const plan = this.data.pendingPlans[index];
    console.log('查看膳食计划详情:', plan);
    // 跳转到详情页面
  },

  viewArticleDetail(e) {
    const index = e.currentTarget.dataset.index;
    const article = this.data.pendingArticles[index];
    console.log('查看健康文章详情:', article);
    // 跳转到详情页面
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