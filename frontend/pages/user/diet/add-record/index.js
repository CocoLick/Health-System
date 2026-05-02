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

  onLoad(options) {
    this.prefillIngredientId = (options.ingredient_id || '').trim();
    this.shortcutIngredientId = this.prefillIngredientId;
    this.shortcutSubmissionId = (options.submission_id || '').trim();
    let sfn = options.shortcut_food_name || '';
    try {
      if (typeof sfn === 'string' && /%[0-9A-Fa-f]{2}/.test(sfn)) {
        sfn = decodeURIComponent(sfn.replace(/\+/g, ' '));
      }
    } catch (e) {
      /* keep raw */
    }
    this.shortcutSubmittedName = typeof sfn === 'string' ? sfn : '';
    this._prefillIngredientDone = false;
    const mt = (options.meal_type || '').trim();
    if (mt && ['breakfast', 'lunch', 'dinner', 'snack'].includes(mt)) {
      this.setData({ mealType: mt });
    }
    if (!this.checkLogin()) {
      return;
    }
    this.loadIngredients();
  },

  onShow() {
    this.checkLogin();
    if (this.data.isLoggedIn) {
      const submitFlag = wx.getStorageSync('ingredientSubmitRefreshFlag');
      if (submitFlag && submitFlag.shouldRefresh) {
        wx.removeStorageSync('ingredientSubmitRefreshFlag');
        if (submitFlag.pendingAudit) {
          wx.showToast({
            title: '待管理员审核，通过后即可搜索记录',
            icon: 'none',
            duration: 2800
          });
        }
      }
      this.loadIngredients();
    }
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
    api.ingredient.getUserVisibleList({ page: 1, page_size: 200 })
      .then(res => {
        if (res.code === 200 && res.data.ingredients) {
          const ingredients = res.data.ingredients;
          this.setData({ ingredients: ingredients });
          // 缓存到本地存储
          wx.setStorageSync('cachedIngredients', ingredients);
          console.log('从后端更新食材数据并缓存');
          this.refreshSearchResultsAfterLoad();
          this.tryApplyIngredientPrefill();
        }
      })
      .catch(() => {
        // 新接口不可用时回退旧接口，确保历史逻辑仍可用
        api.ingredient.getList()
          .then(res => {
            if (res.code === 200 && res.data.ingredients) {
              const ingredients = res.data.ingredients;
              this.setData({ ingredients: ingredients });
              wx.setStorageSync('cachedIngredients', ingredients);
              this.refreshSearchResultsAfterLoad();
              this.tryApplyIngredientPrefill();
            }
          })
          .catch(() => {
            console.log('从后端加载食材数据失败，使用本地缓存');
            this.tryApplyIngredientPrefill();
          });
      });
  },

  tryApplyIngredientPrefill() {
    const id = this.prefillIngredientId;
    if (!id || this._prefillIngredientDone) {
      return;
    }
    const finish = (ag) => {
      if (!ag || !ag.name) {
        wx.showToast({ title: '未找到该食材', icon: 'none' });
        this.prefillIngredientId = '';
        return;
      }
      const defaultAmount = (ag.unit || 'g') === 'g' ? '100' : '1';
      this.applyIngredientToForm(ag, { amountStr: defaultAmount, openForm: true });
      this._prefillIngredientDone = true;
      this.prefillIngredientId = '';
    };

    const list = this.data.ingredients || [];
    const hit = list.find((i) => i.ingredient_id === id);
    if (hit) {
      finish(hit);
      return;
    }

    api.ingredient
      .getDetail(id)
      .then((res) => {
        if (res.code === 200 && res.data) {
          const d = res.data;
          finish({
            ingredient_id: d.ingredient_id,
            name: d.name,
            unit: d.unit || 'g',
            gram_per_unit: d.gram_per_unit != null ? d.gram_per_unit : 100,
            calorie_100g: d.calorie_100g,
            nutrition_100g: d.nutrition_100g
          });
        } else {
          finish(null);
        }
      })
      .catch(() => finish(null));
  },

  applyIngredientToForm(ingredient, options = {}) {
    const unit = ingredient.unit || 'g';
    const gramPerUnit = ingredient.gram_per_unit != null ? ingredient.gram_per_unit : 100;
    const unitOptions = ['g', '个', '碗', '杯', '勺'];
    const unitIndex = unitOptions.indexOf(unit) >= 0 ? unitOptions.indexOf(unit) : 0;
    const amountStr =
      options.amountStr !== undefined ? String(options.amountStr) : this.data.newFood.amount;

    const patch = {
      'newFood.name': ingredient.name,
      'newFood.unit': unit,
      'newFood.gramPerUnit': gramPerUnit,
      searchResults: [],
      showSearchResults: false,
      currentIngredient: ingredient,
      unitIndex
    };
    if (options.amountStr !== undefined) {
      patch['newFood.amount'] = String(options.amountStr);
    }
    if (options.openForm) {
      patch.showAddForm = true;
    }

    this.setData(patch, () => {
      this.calculateNutrition(ingredient.name, amountStr, gramPerUnit);
    });
  },

  refreshSearchResultsAfterLoad() {
    const keyword = (this.data.newFood.name || '').trim();
    if (this.data.showAddForm && keyword) {
      this.searchIngredients(keyword);
    }
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
      showSearchResults: query.length >= 1
    });
  },

  gotoCreateIngredient() {
    const name = (this.data.newFood.name || '').trim();
    const url = name
      ? `/pages/user/diet/ingredient-submit/index?name=${encodeURIComponent(name)}`
      : '/pages/user/diet/ingredient-submit/index';
    wx.navigateTo({ url });
  },

  selectIngredient(e) {
    const ingredient = e.currentTarget.dataset.ingredient;
    if (ingredient) {
      this.applyIngredientToForm(ingredient);
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

    const ingredients = this.data.ingredients;
    const cur = this.data.currentIngredient;
    let picked = null;
    if (cur && cur.ingredient_id) {
      picked = ingredients.find((i) => i.ingredient_id === cur.ingredient_id);
    }
    if (!picked && cur && cur.ingredient_id && (cur.calorie_100g != null || cur.nutrition_100g)) {
      picked = cur;
    }
    if (!picked) {
      for (const ingredient of ingredients) {
        if (ingredient.name && (ingredient.name.includes(foodName) || foodName.includes(ingredient.name))) {
          picked = ingredient;
          break;
        }
      }
    }

    if (picked) {
      const ingredient = picked;
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
    const ci = this.data.currentIngredient;
    if (ci && ci.ingredient_id) {
      food.ingredientId = ci.ingredient_id;
    }

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
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const filePath = res.tempFilePaths && res.tempFilePaths[0];
        if (!filePath) {
          wx.showToast({ title: '未获取到图片', icon: 'none' });
          return;
        }
        this.recognizeFoodsFromImage(filePath);
      },
      fail: () => {
        wx.showToast({ title: '已取消选择', icon: 'none' });
      }
    });
  },

  recognizeFoodsFromImage(filePath) {
    wx.showLoading({ title: '识别中...', mask: true });
    this.readFileAsBase64(filePath)
      .then((base64) => api.nutrition.photoRecognize({
        image_base64: base64,
        meal_type: this.data.mealType
      }))
      .then((res) => {
        wx.hideLoading();
        if (res.code !== 200 || !res.data || !Array.isArray(res.data.recognized_foods)) {
          wx.showToast({ title: '识别失败，请重试', icon: 'none' });
          return;
        }
        this.importRecognizedFoods(res.data.recognized_foods);
      })
      .catch((err) => {
        wx.hideLoading();
        const msg = (err && err.data && err.data.message) || (err && err.message) || '识别失败，请重试';
        wx.showToast({ title: msg, icon: 'none' });
      });
  },

  readFileAsBase64(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: reject
      });
    });
  },

  importRecognizedFoods(recognizedFoods) {
    const importedFoods = recognizedFoods
      .filter(item => item && item.name)
      .map(item => ({
        name: item.name,
        amount: Number(item.amount) > 0 ? Number(item.amount) : 1,
        unit: item.unit || '份',
        gramPerUnit: Number(item.gram_per_unit) > 0 ? Number(item.gram_per_unit) : 100,
        nutrition: {
          calories: Number((item.nutrition && item.nutrition.calories) || 0),
          protein: Number((item.nutrition && item.nutrition.protein) || 0),
          carbohydrate: Number((item.nutrition && item.nutrition.carbohydrate) || 0),
          fat: Number((item.nutrition && item.nutrition.fat) || 0),
          fiber: Number((item.nutrition && item.nutrition.fiber) || 0)
        }
      }))
      .filter(item => item.nutrition.calories > 0);

    if (importedFoods.length === 0) {
      wx.showToast({ title: '未识别到可导入食物', icon: 'none' });
      return;
    }

    const foods = [...this.data.foods, ...importedFoods];
    this.setData({
      foods,
      showAddForm: false,
      searchResults: [],
      showSearchResults: false,
      currentIngredient: null
    });
    this.calculateTotalNutrition(foods);
    wx.showToast({ title: `已导入${importedFoods.length}项`, icon: 'success' });
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

          this.markIngredientShortcutConsumed(foods);

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

  markIngredientShortcutConsumed(foods) {
    const sid = this.shortcutSubmissionId;
    if (!sid) return;
    const iid = this.shortcutIngredientId;
    const expectName = (this.shortcutSubmittedName || '').trim();
    let ok = false;
    if (iid) {
      ok = foods.some((f) => f.ingredientId && f.ingredientId === iid);
    }
    if (!ok && expectName) {
      ok = foods.some((f) => (f.name || '').trim() === expectName);
    }
    if (!ok) return;
    const arr = wx.getStorageSync('ingredientShortcutRecordedIds') || [];
    if (!arr.includes(sid)) {
      arr.push(sid);
      wx.setStorageSync('ingredientShortcutRecordedIds', arr);
    }
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