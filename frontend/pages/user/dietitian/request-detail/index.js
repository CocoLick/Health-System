const api = require('../../../../utils/api');

Page({
  data: {
    request: {}
  },

  onLoad(options) {
    if (options.id && options.id !== 'undefined') {
      this.loadRequestDetail(options.id);
    } else {
      // 如果没有请求ID，跳转到膳食计划页面
      wx.redirectTo({
        url: '/pages/user/diet/diet-plan/index'
      });
    }
  },

  loadRequestDetail(requestId) {
    wx.showLoading({ title: '加载中...' });
    console.log('加载服务请求详情，请求ID:', requestId);
    
    api.serviceRequest.getDetail(requestId)
      .then(res => {
        wx.hideLoading();
        console.log('API响应:', res);
        if (res.code === 200) {
          console.log('服务请求数据:', res.data);
          // 处理数据，添加格式化后的字段
          const requestData = res.data;
          requestData.serviceTypeName = this.getServiceTypeName(requestData.service_type);
          requestData.dietGoalText = this.getDietGoalText(requestData.diet_goal, requestData.other_goal);
          requestData.statusText = this.getStatusText(requestData.status);
          requestData.createTimeFormatted = this.formatDate(requestData.create_time);
          requestData.updateTimeFormatted = this.formatDate(requestData.update_time);
          
          this.setData({ request: requestData });
          console.log('设置数据后:', this.data.request);
        } else {
          console.log('加载服务请求详情失败:', res);
          wx.showToast({ title: '加载服务请求详情失败', icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('加载服务请求详情失败:', err);
        wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' });
      });
  },

  goBack() {
    console.log('点击返回按钮');
    wx.reLaunch({
      url: '/pages/user/diet/diet-plan/index'
    });
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

  getStatusText(status) {
    const statusMap = {
      'pending': '待处理',
      'approved': '已通过',
      'rejected': '已拒绝'
    };
    return statusMap[status] || status;
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
  },

  cancelRequest() {
    wx.showModal({
      title: '取消申请',
      content: '确定要取消当前服务申请吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '取消中...' });
          
          // 调用后端API取消申请
          api.serviceRequest.cancel(this.data.request.request_id)
            .then(res => {
              wx.hideLoading();
              if (res.code === 200) {
                // 清除本地存储中的selectedDietitian和pendingServiceRequest
                wx.removeStorageSync('selectedDietitian');
                wx.removeStorageSync('pendingServiceRequest');
                
                wx.showToast({ title: '已取消申请', icon: 'success' });
                
                // 跳转到膳食计划页面
                setTimeout(() => {
                  wx.reLaunch({
                    url: '/pages/user/diet/diet-plan/index'
                  });
                }, 1000);
              } else {
                wx.showToast({ title: '取消申请失败: ' + (res.message || '未知错误'), icon: 'none' });
              }
            })
            .catch(err => {
              wx.hideLoading();
              console.error('取消申请失败:', err);
              wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' });
            });
        }
      }
    });
  }
});