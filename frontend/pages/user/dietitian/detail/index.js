const api = require('../../../../utils/api');

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
      introduction: '',
      reviews: []
    }
  },

  onLoad(options) {
    if (options.data) {
      const dietitian = JSON.parse(decodeURIComponent(options.data));
      this.setData({ dietitian });
      wx.setStorageSync('selectedDietitian', dietitian);
      this.loadDietitianReviews(dietitian.id);
    } else if (options.id) {
      this.setData({
        'dietitian.id': options.id
      });
      this.loadDietitianDetail(options.id);
      this.loadDietitianReviews(options.id);
    }
  },

  loadDietitianDetail(id) {
    console.log('加载规划师详情', id);
  },

  loadDietitianReviews(dietitianId) {
    const did = String(dietitianId || '').trim();
    if (!did) return;
    api.feedback.listDietitianReviewsForUser(did)
      .then((res) => {
        if (res.code !== 200) return;
        const reviews = (res.data || []).map((item) => ({
          user: item.username || item.user_id || '用户',
          rating: Number(item.rating || 0),
          content: item.content || '未填写评价内容'
        }));
        this.setData({
          'dietitian.reviews': reviews
        });
      })
      .catch(() => {});
  },

  requestService() {
    const dietitian = this.data.dietitian;
    wx.navigateTo({
      url: '/pages/user/dietitian/request/index?dietitianId=' + dietitian.id + '&dietitianName=' + dietitian.name
    });
  }
});