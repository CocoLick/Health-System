Page({
  data: {
    keyword: '',
    category: '全部',
    categories: ['全部', '主食', '蛋白质', '蔬菜', '水果', '饮品'],
    ingredients: [
      { id: 1, name: '燕麦片', category: '主食', calories: 389, protein: 16.9, fat: 6.9, carbohydrate: 66.3 },
      { id: 2, name: '鸡胸肉', category: '蛋白质', calories: 133, protein: 24.6, fat: 3.2, carbohydrate: 0 },
      { id: 3, name: '西兰花', category: '蔬菜', calories: 34, protein: 2.8, fat: 0.4, carbohydrate: 6.6 },
      { id: 4, name: '苹果', category: '水果', calories: 53, protein: 0.3, fat: 0.2, carbohydrate: 13.7 },
      { id: 5, name: '无糖豆浆', category: '饮品', calories: 31, protein: 2.8, fat: 1.6, carbohydrate: 1.9 }
    ],
    filteredList: []
  },

  onLoad() {
    this.applyFilter();
  },

  onSearchInput(e) {
    this.setData({ keyword: (e.detail.value || '').trim() });
    this.applyFilter();
  },

  switchCategory(e) {
    const category = e.currentTarget.dataset.category;
    if (!category || category === this.data.category) return;
    this.setData({ category });
    this.applyFilter();
  },

  editIngredient(e) {
    const name = e.currentTarget.dataset.name || '该食材';
    wx.showToast({ title: `编辑 ${name}`, icon: 'none' });
  },

  removeIngredient(e) {
    const id = Number(e.currentTarget.dataset.id);
    const ingredients = this.data.ingredients.filter((item) => item.id !== id);
    this.setData({ ingredients });
    this.applyFilter();
    wx.showToast({ title: '已删除', icon: 'success' });
  },

  addIngredient() {
    wx.showToast({ title: '请接入新增弹窗', icon: 'none' });
  },

  applyFilter() {
    const { ingredients, category, keyword } = this.data;
    const key = (keyword || '').toLowerCase();
    const filteredList = ingredients.filter((item) => {
      const hitCategory = category === '全部' || item.category === category;
      const hitKeyword = !key || item.name.toLowerCase().includes(key);
      return hitCategory && hitKeyword;
    });
    this.setData({ filteredList });
  }
});