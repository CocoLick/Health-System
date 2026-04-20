const api = require('../../../../utils/api');

Page({
  data: {
    searchKeyword: '',
    filterType: 'all',
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
    
    api.dietitian.getList()
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
            rating: 4.5, // 默认评分
            serviceCount: 0, // 默认服务次数
            experience: '5年', // 默认经验
            introduction: '专业营养师，为您提供个性化的营养指导', // 默认介绍
            cases: [
              { title: '营养咨询', description: '为客户提供专业的营养咨询服务' }
            ],
            reviews: [
              { user: '用户', content: '专业服务，值得推荐', rating: 5 }
            ]
          }));

          if (this.data.filterType !== 'all') {
            const filterMap = {
              'weight_loss': '减脂',
              'diabetes': '控糖',
              'nutrition': '营养'
            };
            const filterText = filterMap[this.data.filterType];
            dietitians = dietitians.filter(item =>
              item.specialty.includes(filterText)
            );
          }

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