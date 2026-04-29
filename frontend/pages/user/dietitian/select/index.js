const api = require('../../../../utils/api');

Page({
  data: {
    searchKeyword: '',
    filterType: 'all',
    maxCurrentService: 0,
    minHistoryService: 0,
    minRating: 0,
    currentServiceOptions: [0, 5, 10, 20],
    historyServiceOptions: [0, 20, 50, 100],
    ratingOptions: [0, 3.5, 4.0, 4.5],
    dietitians: [],
    isLoading: false
  },



  onLoad() {
    this.loadDietitians();
  },

  onPullDownRefresh() {
    this.loadDietitians();
    wx.stopPullDownRefresh();
  },

  loadDietitians() {
    this.setData({ isLoading: true });

    const specialtyMap = {
      'weight_loss': '减脂',
      'diabetes': '控糖',
      'nutrition': '营养'
    };
    const params = {
      max_current_service_user_count: this.data.maxCurrentService,
      min_historical_service_user_count: this.data.minHistoryService,
      min_historical_avg_rating: this.data.minRating
    };
    if (this.data.filterType !== 'all') {
      params.specialty = specialtyMap[this.data.filterType];
    }

    api.dietitian.getList(params)
      .then(res => {
        this.setData({ isLoading: false });
        if (res.code === 200) {
          let dietitians = res.data || [];
          
          // 处理数据格式，确保与前端模板兼容
          dietitians = dietitians.map(item => ({
            id: item.user_id,
            name: item.name,
            nameInitial: item.name ? item.name.charAt(0) : '',
            title: item.title || '营养师',
            specialty: item.specialty || '',
            specialtyArr: item.specialty ? item.specialty.split(',') : [],
            introduction: (item.introduction && String(item.introduction).trim()) || '暂未填写简介',
            rating: Number(item.historical_avg_rating || 0),
            ratingText: (item.rating_count || 0) > 0 ? Number(item.historical_avg_rating || 0).toFixed(1) : '暂无评分',
            ratingCount: item.rating_count || 0,
            serviceCount: item.current_service_user_count || 0,
            historyServiceCount: item.historical_service_user_count || 0,
            experience: '5年', // 默认经验
            cases: [
              { title: '营养咨询', description: '为客户提供专业的营养咨询服务' }
            ],
            reviews: [
              { user: '用户', content: '专业服务，值得推荐', rating: 5 }
            ]
          }));

          if (this.data.searchKeyword) {
            const keyword = this.data.searchKeyword.toLowerCase();
            dietitians = dietitians.filter(item =>
              item.name.toLowerCase().includes(keyword) ||
              item.specialty.toLowerCase().includes(keyword)
            );
          }

          this.setData({ dietitians });
        } else {
          // 后端返回错误，显示空状态
          this.setData({ dietitians: [] });
          wx.showToast({ title: '搜索不到规划师', icon: 'none' });
        }
      })
      .catch(err => {
        this.setData({ isLoading: false, dietitians: [] });
        console.error('加载规划师列表失败:', err);
        wx.showToast({ title: '搜索不到规划师', icon: 'none' });
      });
  },

  onSearch(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
    this.loadDietitians();
  },

  switchFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({
      filterType: filter
    });
    this.loadDietitians();
  },

  setCurrentServiceFilter(e) {
    const value = Number(e.currentTarget.dataset.value || 0);
    this.setData({ maxCurrentService: value });
    this.loadDietitians();
  },

  setHistoryServiceFilter(e) {
    const value = Number(e.currentTarget.dataset.value || 0);
    this.setData({ minHistoryService: value });
    this.loadDietitians();
  },

  setRatingFilter(e) {
    const value = Number(e.currentTarget.dataset.value || 0);
    this.setData({ minRating: value });
    this.loadDietitians();
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    const dietitian = this.data.dietitians.find(item => item.id === id);
    if (dietitian) {
      wx.navigateTo({
        url: '/pages/user/dietitian/detail/index?id=' + id + '&data=' + encodeURIComponent(JSON.stringify(dietitian))
      });
    }
  }
});