const api = require('../../../../utils/api');

function statusText(workflowStatus) {
  if (workflowStatus === 'approved') return '已通过';
  if (workflowStatus === 'returned') return '已退回';
  return '待审核';
}

function statusClass(workflowStatus) {
  if (workflowStatus === 'approved') return 'status-approved';
  if (workflowStatus === 'returned') return 'status-returned';
  return 'status-pending';
}

Page({
  data: {
    isLoggedIn: false,
    loading: false,
    statusTab: 'all',
    tabs: [
      { id: 'all', text: '全部' },
      { id: 'pending', text: '待审核' },
      { id: 'returned', text: '已退回' },
      { id: 'approved', text: '已通过' }
    ],
    items: [],
    visibleItems: [],
    showDetailModal: false,
    selectedItem: null
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    if (this.checkLoginStatus()) {
      this.loadMySubmissions();
    }
  },

  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    const isLoggedIn = !!(userInfo && token);
    this.setData({ isLoggedIn });
    return isLoggedIn;
  },

  handleLogin() {
    wx.navigateTo({ url: '/pages/auth/login/login' });
  },

  loadMySubmissions() {
    this.setData({ loading: true });
    api.ingredient.getMySubmissions({ page: 1, page_size: 100 })
      .then((res) => {
        if (res.code === 200 && res.data) {
          const items = (res.data.items || []).map((it) => ({
            ...it,
            statusText: statusText(it.workflow_status),
            statusClass: statusClass(it.workflow_status),
            updatedText: it.created_at ? String(it.created_at).replace('T', ' ').slice(0, 16) : '-',
            nutritionText: `蛋白${it.submitted_nutrition_100g.protein || 0} / 碳水${it.submitted_nutrition_100g.carbohydrate || 0} / 脂肪${it.submitted_nutrition_100g.fat || 0}`
          }));
          this.setData({ items });
          this.applyFilter();
        }
      })
      .catch(() => {
        wx.showToast({ title: '加载失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  switchTab(e) {
    this.setData({ statusTab: e.currentTarget.dataset.tab }, () => {
      this.applyFilter();
    });
  },

  applyFilter() {
    const { statusTab, items } = this.data;
    const visibleItems = statusTab === 'all'
      ? items
      : items.filter((it) => it.workflow_status === statusTab);
    this.setData({ visibleItems });
  },

  goSubmitNew() {
    wx.navigateTo({ url: '/pages/user/diet/ingredient-submit/index' });
  },

  editReturnedItem(e) {
    const item = e.currentTarget.dataset.item;
    if (!item || item.workflow_status !== 'returned') return;
    wx.setStorageSync('ingredientResubmitDraft', item);
    wx.navigateTo({
      url: `/pages/user/diet/ingredient-submit/index?mode=resubmit&submission_id=${encodeURIComponent(item.submission_id)}`
    });
  },

  showDetail(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    this.setData({
      selectedItem: item,
      showDetailModal: true
    });
  },

  hideDetailModal() {
    this.setData({
      showDetailModal: false,
      selectedItem: null
    });
  },

  noop() {}
});