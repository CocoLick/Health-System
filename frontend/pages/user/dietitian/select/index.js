const api = require('../../../../utils/api');

function toSpecialtyArray(raw) {
  return String(raw || '')
    .replace(/，/g, ',')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function dietitianMatchesSpecialtyQueries(item, queries) {
  const tags = Array.isArray(item.specialtyArr) ? item.specialtyArr : [];
  const specialtyText = String(item.specialty || '').toLowerCase();
  return queries.some((s) => {
    const q = String(s || '').trim().toLowerCase();
    if (!q) return false;
    if (specialtyText.includes(q)) return true;
    return tags.some((tag) => {
      const t = String(tag || '').trim().toLowerCase();
      return t.includes(q) || q.includes(t);
    });
  });
}

function filterPoolBySelectedSpecialties(list, selected) {
  let pool = list.slice();
  const queries = selected || [];
  if (queries.length > 0) {
    pool = pool.filter((item) => dietitianMatchesSpecialtyQueries(item, queries));
  }
  return pool;
}

function pseudoNoise(id, salt) {
  const s = String(id || '') + ':' + String(salt || 0);
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return (h % 1000) / 1000;
}

function specialtyMatchScore(item, selected) {
  const queries = (selected || []).map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
  if (!queries.length) return 0;
  const tags = Array.isArray(item.specialtyArr) ? item.specialtyArr : [];
  const specialtyText = String(item.specialty || '').toLowerCase();
  let hits = 0;
  queries.forEach((q) => {
    if (specialtyText.includes(q)) {
      hits += 1;
      return;
    }
    const tagHit = tags.some((tag) => {
      const t = String(tag || '').trim().toLowerCase();
      return t.includes(q) || q.includes(t);
    });
    if (tagHit) hits += 1;
  });
  return hits / queries.length;
}

function recommendReason(matchRatio, ratingCount, avgRating, serviceCount) {
  const reasons = [];
  if (matchRatio >= 0.99) reasons.push('高度匹配你的专业偏好');
  else if (matchRatio > 0) reasons.push('匹配你的专业偏好');
  if (ratingCount > 0 && avgRating >= 4.5) reasons.push('口碑较好');
  else if (ratingCount > 0 && avgRating >= 4.0) reasons.push('评价不错');
  if (serviceCount <= 5) reasons.push('当前接待人数较少');
  if (!reasons.length) reasons.push('综合推荐');
  return reasons.slice(0, 2).join(' · ');
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
    recommendedDietitians: [],
    recommendCollapsed: false,
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
          this.setData({ allDietitians: [], dietitians: [], recommendedDietitians: [] });
          wx.showToast({ title: '搜索不到规划师', icon: 'none' });
        }
      })
      .catch(err => {
        this.setData({ isLoading: false, allDietitians: [], dietitians: [], recommendedDietitians: [] });
        console.error('加载规划师列表失败:', err);
        wx.showToast({ title: '搜索不到规划师', icon: 'none' });
      });
  },

  computeRecommendedRows(pool) {
    const selected = this.data.selectedSpecialties || [];
    const rows = (pool || []).map((item) => {
      const matchRatio = specialtyMatchScore(item, selected);
      const ratingCount = Number(item.ratingCount || 0);
      const avgRating = Number(item.rating || 0);
      const current = Number(item.serviceCount || 0);
      const reason = recommendReason(matchRatio, ratingCount, avgRating, current);
      const tagPreview = (item.specialtyArr || []).slice(0, 3);
      return {
        ...item,
        recommendReason: reason,
        recommendTagPreview: tagPreview
      };
    });
    rows.sort((a, b) => {
      const prefWeight = selected.length > 0 ? 1 : 0.35;
      const ma = specialtyMatchScore(a, selected);
      const mb = specialtyMatchScore(b, selected);
      const ratingCountA = Number(a.ratingCount || 0);
      const ratingCountB = Number(b.ratingCount || 0);
      const avgA = Number(a.rating || 0);
      const avgB = Number(b.rating || 0);
      const ratingSignalA =
        ratingCountA > 0 ? Math.min(5, Math.max(0, avgA)) / 5 : 2.8 / 5;
      const ratingSignalB =
        ratingCountB > 0 ? Math.min(5, Math.max(0, avgB)) / 5 : 2.8 / 5;
      const trustA = Math.min(1, Math.log10(ratingCountA + 1) / 2);
      const trustB = Math.min(1, Math.log10(ratingCountB + 1) / 2);
      const histA = Math.min(1, Math.log10(Number(a.historyServiceCount || 0) + 1) / 3);
      const histB = Math.min(1, Math.log10(Number(b.historyServiceCount || 0) + 1) / 3);
      const loadA = Math.min(1, Number(a.serviceCount || 0) / 20);
      const loadB = Math.min(1, Number(b.serviceCount || 0) / 20);
      const noiseA = pseudoNoise(a.id, 0) * 0.06;
      const noiseB = pseudoNoise(b.id, 0) * 0.06;
      const scoreA =
        prefWeight * ma * 42 +
        ratingSignalA * 22 * (0.55 + 0.45 * trustA) +
        histA * 14 +
        (1 - loadA) * 12 +
        noiseA;
      const scoreB =
        prefWeight * mb * 42 +
        ratingSignalB * 22 * (0.55 + 0.45 * trustB) +
        histB * 14 +
        (1 - loadB) * 12 +
        noiseB;
      return scoreB - scoreA;
    });
    return rows.slice(0, 2);
  },

  applyClientFilters() {
    const keyword = String(this.data.searchKeyword || '').toLowerCase();
    const selected = this.data.selectedSpecialties || [];
    const all = this.data.allDietitians || [];
    const pool = filterPoolBySelectedSpecialties(all, selected);
    const recommended = this.computeRecommendedRows(pool);
    let list = pool.slice();
    if (keyword) {
      list = list.filter((item) =>
        String(item.name || '').toLowerCase().includes(keyword) ||
        String(item.specialty || '').toLowerCase().includes(keyword)
      );
    }
    this.setData({ dietitians: list, recommendedDietitians: recommended });
  },

  collapseRecommend() {
    this.setData({ recommendCollapsed: true });
  },

  expandRecommend() {
    this.setData({ recommendCollapsed: false });
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
  },

  viewRecommendedDetail(e) {
    const id = e.currentTarget.dataset.id;
    const rec = (this.data.recommendedDietitians || []).find((x) => x.id === id);
    const fallback = (this.data.allDietitians || []).find((x) => x.id === id);
    const dietitian = rec || fallback;
    if (dietitian) {
      const payload = Object.assign({}, dietitian);
      delete payload.recommendReason;
      delete payload.recommendTagPreview;
      wx.navigateTo({
        url: '/pages/user/dietitian/detail/index?id=' + id + '&data=' + encodeURIComponent(JSON.stringify(payload))
      });
    }
  }
});