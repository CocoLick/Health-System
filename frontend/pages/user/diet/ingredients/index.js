Page({
  data: {
    isLoggedIn: false,
    searchQuery: '',
    currentCategory: 'all',
    categories: [
      { id: 'all', name: '全部' },
      { id: 'vegetables', name: '蔬菜' },
      { id: 'fruits', name: '水果' },
      { id: 'meat', name: '肉类' },
      { id: 'grain', name: '谷物' },
      { id: 'dairy', name: '乳制品' }
    ],
    ingredients: [
      {
        id: 1,
        name: '西红柿',
        category: 'vegetables',
        nutrition: '富含维生素C、番茄红素',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=fresh%20tomato%20vegetable&image_size=square'
      },
      {
        id: 2,
        name: '苹果',
        category: 'fruits',
        nutrition: '富含膳食纤维、维生素C',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=fresh%20apple%20fruit&image_size=square'
      },
      {
        id: 3,
        name: '鸡胸肉',
        category: 'meat',
        nutrition: '富含蛋白质、低脂肪',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=raw%20chicken%20breast%20meat&image_size=square'
      },
      {
        id: 4,
        name: '大米',
        category: 'grain',
        nutrition: '富含碳水化合物、B族维生素',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=rice%20grain&image_size=square'
      },
      {
        id: 5,
        name: '牛奶',
        category: 'dairy',
        nutrition: '富含钙、蛋白质',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=fresh%20milk%20dairy&image_size=square'
      }
    ]
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    
    if (userInfo && token) {
      this.setData({
        isLoggedIn: true
      });
    } else {
      this.setData({
        isLoggedIn: false
      });
    }
  },

  // 处理登录
  handleLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/login'
    });
  },

  // 搜索输入
  handleSearchInput(e) {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    this.setData({
      searchQuery: e.detail.value
    });
  },

  // 搜索提交
  handleSearchSubmit() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    // 实现搜索逻辑
    console.log('搜索:', this.data.searchQuery);
  },

  // 切换分类
  switchCategory(e) {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    this.setData({
      currentCategory: e.currentTarget.dataset.category
    });
  },

  // 查看食材详情
  viewIngredientDetail(e) {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    const ingredientId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/ingredients/detail/index?id=${ingredientId}`
    });
  },

  // 获取过滤后的食材列表
  getFilteredIngredients() {
    const { searchQuery, currentCategory, ingredients } = this.data;
    
    return ingredients.filter(ingredient => {
      const matchesSearch = searchQuery === '' || ingredient.name.includes(searchQuery);
      const matchesCategory = currentCategory === 'all' || ingredient.category === currentCategory;
      return matchesSearch && matchesCategory;
    });
  },

  // 加载更多
  loadMore() {
    if (!this.data.isLoggedIn) {
      this.handleLogin();
      return;
    }
    wx.showToast({
      title: '加载更多功能暂未实现',
      icon: 'none'
    });
  }
});