Page({
  data: {
    dietitianId: '',
    dietitianName: '',
    serviceType: 'diet_plan',
    dietGoal: 'weight_loss',
    formData: {
      weight: '',
      targetWeight: '',
      disease: '',
      allergy: '',
      demand: ''
    }
  },

  onLoad(options) {
    if (options.dietitianId) {
      this.setData({
        dietitianId: options.dietitianId,
        dietitianName: options.dietitianName || '规划师'
      });
    }

    const cachedHealthData = wx.getStorageSync('cachedHealthData');
    if (cachedHealthData) {
      this.setData({
        'formData.weight': cachedHealthData.weight || ''
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

  bindWeightInput(e) {
    this.setData({ 'formData.weight': e.detail.value });
  },

  bindTargetWeightInput(e) {
    this.setData({ 'formData.targetWeight': e.detail.value });
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

  submitRequest() {
    if (!this.data.formData.weight) {
      wx.showToast({ title: '请输入当前体重', icon: 'none' });
      return;
    }

    const requestData = {
      dietitian_id: this.data.dietitianId,
      service_type: this.data.serviceType,
      diet_goal: this.data.dietGoal,
      health_data: this.data.formData,
      status: 'pending',
      create_time: new Date().toLocaleString()
    };

    const requests = wx.getStorageSync('serviceRequests') || [];
    requests.unshift(requestData);
    wx.setStorageSync('serviceRequests', requests);

    wx.setStorageSync('pendingServiceRequest', requestData);

    wx.showModal({
      title: '提交成功',
      content: '您的服务请求已提交，请等待规划师响应',
      showCancel: false,
      success: () => {
        wx.navigateBack();
      }
    });
  }
});