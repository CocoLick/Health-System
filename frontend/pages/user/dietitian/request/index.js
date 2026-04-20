Page({
  data: {
    dietitianId: '',
    dietitianName: '',
    serviceType: 'diet_plan',
    dietGoal: 'weight_loss',
    formData: {
      disease: '',
      allergy: '',
      demand: '',
      otherGoal: ''
    }
  },

  onLoad(options) {
    if (options.dietitianId) {
      this.setData({
        dietitianId: options.dietitianId,
        dietitianName: options.dietitianName || '规划师'
      });
    }
  },

  selectServiceType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ serviceType: type });
  },

  selectGoal(e) {
    const goal = e.currentTarget.dataset.goal;
    this.setData({ dietGoal: goal });
  },

  bindDiseaseInput(e) {
    this.setData({ 'formData.disease': e.detail.value });
  },

  bindAllergyInput(e) {
    this.setData({ 'formData.allergy': e.detail.value });
  },

  bindDemandInput(e) {
    this.setData({ 'formData.demand': e.detail.value });
  },

  bindOtherGoalInput(e) {
    this.setData({ 'formData.otherGoal': e.detail.value });
  },

  submitRequest() {
    // 验证其他目标是否填写
    if (this.data.dietGoal === 'other' && !this.data.formData.otherGoal) {
      wx.showToast({ title: '请输入您的饮食目标', icon: 'none' });
      return;
    }

    const requestData = {
      dietitian_id: this.data.dietitianId,
      service_type: this.data.serviceType,
      diet_goal: this.data.dietGoal,
      other_goal: this.data.formData.otherGoal,
      health_data: this.data.formData
    };

    console.log('提交服务请求:', requestData);

    // 显示加载动画
    wx.showLoading({ title: '提交中...' });

    // 调用API提交服务请求
    wx.request({
      url: 'http://localhost:8000/api/service-request/',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      data: requestData,
      success: (res) => {
        console.log('API响应:', res);
        wx.hideLoading();
        if (res.statusCode === 200 && res.data.code === 200) {
          console.log('提交成功，准备跳转');
          console.log('API响应数据:', res.data.data);
          // 尝试多种字段名获取服务请求ID
          const requestId = res.data.data.request_id || res.data.data.RequestID || res.data.data.requestId;
          console.log('服务请求ID:', requestId);
          if (!requestId) {
            // 如果获取不到请求ID，跳转到膳食计划页面
            wx.showModal({
              title: '提交成功',
              content: '您的服务请求已提交，请等待规划师响应',
              showCancel: false,
              success: (modalRes) => {
                wx.redirectTo({
                  url: '/pages/user/diet/diet-plan/index'
                });
              }
            });
            return;
          }
          wx.showModal({
            title: '提交成功',
            content: '您的服务请求已提交，请等待规划师响应',
            showCancel: false,
            success: (modalRes) => {
              console.log('模态框回调:', modalRes);
              wx.redirectTo({
                url: '/pages/user/dietitian/request-detail/index?id=' + requestId,
                success: (redirectRes) => {
                  console.log('跳转成功:', redirectRes);
                },
                fail: (redirectErr) => {
                  console.log('跳转失败:', redirectErr);
                }
              });
            }
          });
        } else {
          console.log('提交失败:', res);
          wx.showToast({ title: '提交失败: ' + (res.data.message || '未知错误'), icon: 'none' });
        }
      },
      fail: (err) => {
        console.log('网络错误:', err);
        wx.hideLoading();
        wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' });
      }
    });
  }
});