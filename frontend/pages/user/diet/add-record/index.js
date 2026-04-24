const api = require('../../../../utils/api');

Page({
  data: {
    isLoggedIn: false,
    mealType: 'breakfast',
    showAddForm: false,
    editingIndex: -1,
    foods: [],
    newFood: {
      name: '',
      amount: '',
      unit: 'g',
      gramPerUnit: 100,
      nutrition: {
        calories: 0,
        protein: 0,
        carbohydrate: 0,
        fat: 0
      }
    },
    totalNutrition: {
      calories: 0,
      protein: 0,
      carbohydrate: 0,
      fat: 0
    },
    ingredients: [], // 从后端获取的食材列表
    searchResults: [], // 搜索结果
    showSearchResults: false, // 是否显示搜索结果
    searchQuery: '', // 搜索关键词
    currentIngredient: null, // 当前选中的食材
    unitOptions: ['g', '个', '碗', '杯', '勺'], // 单位选项
    unitIndex: 0 // 当前选中的单位索引
  },

  onLoad() {
    if (!this.checkLogin()) {
      return;
    }
    // 页面加载时获取食材列表
    this.loadIngredients();
  },

  onShow() {
    this.checkLogin();
  },

  loadIngredients() {
    console.log('加载食材数据');
    
    // 先尝试从本地存储加载缓存数据
    const cachedIngredients = wx.getStorageSync('cachedIngredients');
    if (cachedIngredients && cachedIngredients.length > 0) {
      this.setData({ ingredients: cachedIngredients });
      console.log('从本地缓存加载食材数据');
    }
    
    // 然后尝试从后端获取最新数据
    api.ingredient.getList()
      .then(res => {
        if (res.code === 200 && res.data.ingredients) {
          const ingredients = res.data.ingredients;
          this.setData({ ingredients: ingredients });
          // 缓存到本地存储
          wx.setStorageSync('cachedIngredients', ingredients);
          console.log('从后端更新食材数据并缓存');
        }
      })
      .catch(() => {
        console.log('从后端加载食材数据失败，使用本地缓存');
      });
  },
  selectMealType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ mealType: type });
  },

  addFood() {
    this.setData({
      showAddForm: true,
      editingIndex: -1,
      newFood: {
        name: '',
        amount: '',
        unit: 'g',
        gramPerUnit: 100,
        nutrition: {
          calories: 0,
          protein: 0,
          carbohydrate: 0,
          fat: 0
        }
      },
      searchResults: [],
      showSearchResults: false,
      searchQuery: '',
      currentIngredient: null,
      unitIndex: 0
    });
  },

  bindFoodNameInput(e) {
    const name = e.detail.value;
    this.setData({ 
      'newFood.name': name,
      searchQuery: name
    });
    
    // 搜索食材
    if (name.length >= 1) {
      this.searchIngredients(name);
    } else {
      this.setData({ showSearchResults: false });
    }
  },

  searchIngredients(query) {
    const ingredients = this.data.ingredients;
    const results = ingredients.filter(ingredient => 
      ingredient.name && (ingredient.name.includes(query) || query.includes(ingredient.name))
    );
    
    this.setData({
      searchResults: results,
      showSearchResults: results.length > 0
    });
  },

  selectIngredient(e) {
    const ingredient = e.currentTarget.dataset.ingredient;
    if (ingredient) {
      // 设置当前食材及其单位信息
      const unit = ingredient.unit || 'g';
      const gramPerUnit = ingredient.gram_per_unit || 100;
      const unitOptions = ['g', '个', '碗', '杯', '勺'];
      const unitIndex = unitOptions.indexOf(unit) >= 0 ? unitOptions.indexOf(unit) : 0;
      
      this.setData({
        'newFood.name': ingredient.name,
        'newFood.unit': unit,
        'newFood.gramPerUnit': gramPerUnit,
        searchResults: [],
        showSearchResults: false,
        currentIngredient: ingredient,
        unitIndex: unitIndex
      });
      
      // 自动计算营养成分
      this.calculateNutrition(ingredient.name, this.data.newFood.amount, gramPerUnit);
    }
  },

  bindAmountInput(e) {
    const amount = e.detail.value;
    this.setData({ 'newFood.amount': amount });
    this.calculateNutrition(this.data.newFood.name, amount, this.data.newFood.gramPerUnit);
  },

  // 单位选择改变
  changeUnit(e) {
    const unitIndex = e.detail.value;
    const ingredient = this.data.currentIngredient;
    
    if (!ingredient) {
      wx.showToast({ title: '请先选择食物', icon: 'none' });
      return;
    }
    
    // 支持的单位列表
    const units = ['g', '个', '碗', '杯', '勺'];
    const gramValues = [100, 50, 200, 250, 10]; // 对应每个单位的克数
    
    const selectedUnit = units[unitIndex] || 'g';
    const gramPerUnit = gramValues[unitIndex] || 100;
    
    this.setData({
      'newFood.unit': selectedUnit,
      'newFood.gramPerUnit': gramPerUnit
    });
    
    // 重新计算营养成分
    this.calculateNutrition(this.data.newFood.name, this.data.newFood.amount, gramPerUnit);
  },

  calculateNutrition(foodName, amount, gramPerUnit = 100) {
    if (!foodName || !amount || isNaN(amount)) {
      this.setData({
        'newFood.nutrition': {
          calories: 0,
          protein: 0,
          carbohydrate: 0,
          fat: 0
        }
      });
      return;
    }

    const amountNum = parseFloat(amount);
    let nutrition = { calories: 0, protein: 0, carbohydrate: 0, fat: 0 };

    // 从后端获取的食材列表中查找食物营养数据
    const ingredients = this.data.ingredients;
    for (const ingredient of ingredients) {
      if (ingredient.name && (ingredient.name.includes(foodName) || foodName.includes(ingredient.name))) {
        // 解析营养成分
        let baseNutrition = {
          calories: ingredient.calorie_100g || 0,
          protein: 0,
          carbohydrate: 0,
          fat: 0
        };
        
        // 处理nutrition_100g字段
        if (ingredient.nutrition_100g) {
          if (typeof ingredient.nutrition_100g === 'string') {
            try {
              const nutritionObj = JSON.parse(ingredient.nutrition_100g);
              baseNutrition.protein = nutritionObj.protein || 0;
              baseNutrition.carbohydrate = nutritionObj.carbohydrate || 0;
              baseNutrition.fat = nutritionObj.fat || 0;
            } catch (e) {
              console.log('解析营养成分失败:', e);
            }
          } else {
            baseNutrition.protein = ingredient.nutrition_100g.protein || 0;
            baseNutrition.carbohydrate = ingredient.nutrition_100g.carbohydrate || 0;
            baseNutrition.fat = ingredient.nutrition_100g.fat || 0;
          }
        }
        
        // 基于用户选择的单位和数量计算营养成分
        // 实际重量(克) = 输入数量 × 每单位克数
        // 营养值 = (输入数量 × 每单位克数 / 100) × 每100g营养值
        const actualWeight = amountNum * gramPerUnit;
        const ratio = actualWeight / 100;
        nutrition = {
          calories: baseNutrition.calories * ratio,
          protein: baseNutrition.protein * ratio,
          carbohydrate: baseNutrition.carbohydrate * ratio,
          fat: baseNutrition.fat * ratio
        };
        break;
      }
    }

    this.setData({ 'newFood.nutrition': nutrition });
  },

  confirmAddFood() {
    const { name, amount, nutrition, unit, gramPerUnit } = this.data.newFood;

    if (!name) {
      wx.showToast({ title: '请输入食物名称', icon: 'none' });
      return;
    }

    if (!amount || isNaN(amount)) {
      wx.showToast({ title: '请输入有效分量', icon: 'none' });
      return;
    }

    if (nutrition.calories === 0) {
      wx.showToast({ title: '未找到食物营养数据', icon: 'none' });
      return;
    }

    const food = {
      name: name,
      amount: parseFloat(amount),
      unit: unit,
      gramPerUnit: gramPerUnit,
      nutrition: nutrition
    };

    let foods = [...this.data.foods];
    if (this.data.editingIndex >= 0) {
      // 编辑模式
      foods[this.data.editingIndex] = food;
    } else {
      // 添加模式
      foods.push(food);
    }

    this.setData({ foods });
    this.calculateTotalNutrition(foods);
    this.setData({ 
      showAddForm: false,
      searchResults: [],
      showSearchResults: false,
      currentIngredient: null
    });
  },

  cancelAddFood() {
    this.setData({ 
      showAddForm: false,
      searchResults: [],
      showSearchResults: false,
      currentIngredient: null
    });
  },

  editFood(e) {
    const index = e.currentTarget.dataset.index;
    const food = this.data.foods[index];
    
    // 查找对应的食材信息
    const ingredients = this.data.ingredients;
    let ingredient = null;
    for (const ing of ingredients) {
      if (ing.name === food.name) {
        ingredient = ing;
        break;
      }
    }
    
    this.setData({
      showAddForm: true,
      editingIndex: index,
      newFood: {
        name: food.name,
        amount: food.amount.toString(),
        unit: food.unit || 'g',
        gramPerUnit: food.gramPerUnit || 100,
        nutrition: food.nutrition
      },
      searchResults: [],
      showSearchResults: false,
      searchQuery: food.name,
      currentIngredient: ingredient
    });
  },

  deleteFood(e) {
    const index = e.currentTarget.dataset.index;
    const foods = [...this.data.foods];
    foods.splice(index, 1);
    
    this.setData({ foods });
    this.calculateTotalNutrition(foods);
  },

  calculateTotalNutrition(foods) {
    let total = {
      calories: 0,
      protein: 0,
      carbohydrate: 0,
      fat: 0
    };

    foods.forEach(food => {
      total.calories += food.nutrition.calories;
      total.protein += food.nutrition.protein;
      total.carbohydrate += food.nutrition.carbohydrate;
      total.fat += food.nutrition.fat;
    });

    this.setData({ totalNutrition: total });
  },

  takePhoto() {
    wx.showModal({
      title: '拍照识别',
      content: '此功能正在开发中，敬请期待',
      showCancel: false
    });
  },

  submitRecord() {
    const { mealType, foods, totalNutrition } = this.data;

    if (foods.length === 0) {
      wx.showToast({ title: '请添加食物', icon: 'none' });
      return;
    }

    const record = {
      meal_type: mealType,
      foods: foods.map(food => ({
        name: food.name,
        amount: food.amount,
        unit: food.unit || 'g',
        gram_per_unit: food.gramPerUnit || 100,
        calories: food.nutrition.calories,
        protein: food.nutrition.protein,
        carbohydrate: food.nutrition.carbohydrate,
        fat: food.nutrition.fat,
        fiber: food.nutrition.fiber || 0
      })),
      total_nutrition: totalNutrition
    };

    // 调用后端API保存记录
    api.nutrition.addRecord(record)
      .then(res => {
        if (res.code === 200) {
          // 保存到本地存储作为备份
          const todayRecords = wx.getStorageSync('todayNutritionRecords') || [];
          const allRecords = wx.getStorageSync('nutritionRecords') || [];

          const localRecord = {
            id: Date.now(),
            mealType: this.getMealTypeText(mealType),
            time: new Date().toLocaleString(),
            foods: foods.map(food => ({
              name: food.name,
              amount: food.amount,
              unit: food.unit || 'g'
            })),
            calories: totalNutrition.calories,
            protein: totalNutrition.protein,
            carbohydrate: totalNutrition.carbohydrate,
            fat: totalNutrition.fat
          };

          todayRecords.push(localRecord);
          allRecords.unshift(localRecord);

          wx.setStorageSync('todayNutritionRecords', todayRecords);
          wx.setStorageSync('nutritionRecords', allRecords);

          wx.showToast({ title: '记录成功', icon: 'success' });

          // 跳转回营养页面
          setTimeout(() => {
            wx.navigateBack();
          }, 1000);
        } else {
          wx.showToast({ title: '记录失败', icon: 'none' });
        }
      })
      .catch(() => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  getMealTypeText(type) {
    const mealTypes = {
      breakfast: '早餐',
      lunch: '午餐',
      dinner: '晚餐',
      snack: '加餐'
    };
    return mealTypes[type] || '其他';
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    const isLoggedIn = !!(userInfo && token);
    this.setData({ isLoggedIn });
    return isLoggedIn;
  },

  gotoLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/login'
    });
  }
});