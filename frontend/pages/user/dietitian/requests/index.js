const api = require('../../../../utils/api');

Page({
  data: {
    requests: [],
    filter: 'all',
    isLoading: false
  },

  onLoad() {
    this.loadRequests();
  },

  onPullDownRefresh() {
    this.loadRequests();
    wx.stopPullDownRefresh();
  },

  loadRequests() {
    this.setData({ isLoading: true });
    
    api.serviceRequest.getList()
      .then(res => {
        this.setData({ isLoading: false });
        if (res.code === 200) {
          let requests = res.data || [];
          
          // 按状态筛选
          if (this.data.filter !== 'all') {
            requests = requests.filter(item => item.status === this.data.filter);
          }
          
          this.setData({ requests });
        } else {
          wx.showToast({ title: '加载服务请求失败', icon: 'none' });
        }
      })
      .catch(err => {
        this.setData({ isLoading: false });
        console.error('加载服务请求失败:', err);
        wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' });
      });
  },

  switchFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ filter });
    this.loadRequests();
  },

  viewRequestDetail(e) {
    const requestId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/user/dietitian/request-detail/index?id=' + requestId
    });
  },

  goToSelectDietitian() {
    wx.navigateTo({
      url: '/pages/user/dietitian/select/index'
    });
  },

  goBack() {
    wx.navigateBack();
  },

  getServiceTypeName(type) {
    const typeMap = {
      'diet_plan': '膳食计划定制',
      'nutrition_consult': '营养咨询服务',
      'health_management': '健康管理服务'
    };
    return typeMap[type] || type;
  },

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
  }
});