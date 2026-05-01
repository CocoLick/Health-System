const api = require('../../../../utils/api');

function toSpecialtyArray(raw) {
  return String(raw || '')
    .replace(/，/g, ',')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

Page({
  data: {
    searchKeyword: '',
    selectedSpecialties: [],
    customSpecialtyInput: '',
    specialtyOptions: ['减脂', '控糖', '营养', '临床营养', '运动营养', '孕期营养'],
    specialtyOptionItems: [],
    maxCurrentService: 0,
    minHistoryService: 0,
    minRating: 0,
    currentServiceOptions: [0, 5, 10, 20],
    historyServiceOptions: [0, 20, 50, 100],
    ratingOptions: [0, 3.5, 4.0, 4.5],
    allDietitians: [],
    dietitians: [],
    isLoading: false
  },



  onLoad() {
    this.refreshSpecialtyOptionItems();
    this.loadDietitians();
  },

  onPullDownRefresh() {
    this.loadDietitians();
    wx.stopPullDownRefresh();
  },

  loadDietitians() {
    this.setData({ isLoading: true });
    const params = {
      max_current_service_user_count: this.data.maxCurrentService,
      min_historical_service_user_count: this.data.minHistoryService,
      min_historical_avg_rating: this.data.minRating
    };

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
            specialtyArr: toSpecialtyArray(item.specialty),
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

          this.setData({ allDietitians: dietitians });
          this.applyClientFilters();
        } else {
          // 后端返回错误，显示空状态
          this.setData({ allDietitians: [], dietitians: [] });
          wx.showToast({ title: '搜索不到规划师', icon: 'none' });
        }
      })
      .catch(err => {
        this.setData({ isLoading: false, allDietitians: [], dietitians: [] });
        console.error('加载规划师列表失败:', err);
        wx.showToast({ title: '搜索不到规划师', icon: 'none' });
      });
  },

  applyClientFilters() {
    const keyword = String(this.data.searchKeyword || '').toLowerCase();
    const selected = this.data.selectedSpecialties || [];
    let list = this.data.allDietitians || [];
    if (keyword) {
      list = list.filter((item) =>
        String(item.name || '').toLowerCase().includes(keyword) ||
        String(item.specialty || '').toLowerCase().includes(keyword)
      );
    }
    if (selected.length > 0) {
      list = list.filter((item) => {
        const tags = Array.isArray(item.specialtyArr) ? item.specialtyArr : [];
        const specialtyText = String(item.specialty || '').toLowerCase();
        return selected.some((s) => {
          const q = String(s || '').trim().toLowerCase();
          if (!q) return false;
          if (specialtyText.includes(q)) return true;
          return tags.some((tag) => {
            const t = String(tag || '').trim().toLowerCase();
            return t.includes(q) || q.includes(t);
          });
        });
      });
    }
    this.setData({ dietitians: list });
  },

  onSearch(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
    this.applyClientFilters();
  },

  toggleSpecialtyFilter(e) {
    const tag = String(e.currentTarget.dataset.tag || '').trim();
    if (!tag) return;
    const current = (this.data.selectedSpecialties || []).slice();
    const idx = current.indexOf(tag);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(tag);
    }
    this.setData({ selectedSpecialties: current });
    this.refreshSpecialtyOptionItems();
    this.applyClientFilters();
  },

  onCustomSpecialtyInput(e) {
    this.setData({ customSpecialtyInput: e.detail.value });
  },

  addCustomSpecialty() {
    const input = String(this.data.customSpecialtyInput || '');
    const tags = toSpecialtyArray(input);
    if (!tags.length) return;
    const options = (this.data.specialtyOptions || []).slice();
    const selected = (this.data.selectedSpecialties || []).slice();
    tags.forEach((tag) => {
      if (!options.includes(tag)) options.push(tag);
      if (!selected.includes(tag)) selected.push(tag);
    });
    this.setData({
      specialtyOptions: options,
      selectedSpecialties: selected,
      customSpecialtyInput: ''
    });
    this.refreshSpecialtyOptionItems();
    this.applyClientFilters();
  },

  refreshSpecialtyOptionItems() {
    const selectedSet = {};
    (this.data.selectedSpecialties || []).forEach((x) => {
      selectedSet[x] = true;
    });
    const items = (this.data.specialtyOptions || []).map((name) => ({
      name,
      selected: !!selectedSet[name]
    }));
    this.setData({ specialtyOptionItems: items });
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