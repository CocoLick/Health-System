Page({
  data: {
    dietitian: {
      id: '',
      name: '',
      nameInitial: '',
      title: '',
      specialty: '',
      specialtyArr: [],
      rating: 0,
      serviceCount: 0,
      experience: '',
      introduction: '',
      cases: [],
      reviews: []
    }
  },

  onLoad(options) {
    if (options.data) {
      const dietitian = JSON.parse(decodeURIComponent(options.data));
      this.setData({ dietitian });
      wx.setStorageSync('selectedDietitian', dietitian);
    } else if (options.id) {
      this.setData({
        'dietitian.id': options.id
      });
      this.loadDietitianDetail(options.id);
    }
  },

  loadDietitianDetail(id) {
    console.log('加载规划师详情', id);
  },

  requestService() {
    const dietitian = this.data.dietitian;
    wx.navigateTo({
      url: '/pages/user/service-request/index?dietitianId=' + dietitian.id + '&dietitianName=' + dietitian.name
    });
  }
});