const api = require('../../../../utils/api');

Page({
  data: {
    mealType: 'breakfast',
    showAddForm: false,
    editingIndex: -1,
    foods: [],
    newFood: {
      name: '',
      amount: '',
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
    ingredients: [] // 从后端获取的食材列表
  },

  onLoad() {
    // 页面加载时获取食材列表
    this.loadIngredients();
  },

  loadIngredients() {
    console.log('加载食材数据');
    api.ingredient.getList()
      .then(res => {
        if (res.code === 200) {
          this.setData({
            ingredients: res.data.ingredients || []
          });
        }
      })
      .catch(() => {
        console.log('加载食材数据失败');
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
        nutrition: {
          calories: 0,
          protein: 0,
          carbohydrate: 0,
          fat: 0
        }
      }
    });
  },

  bindFoodNameInput(e) {
    const name = e.detail.value;
    this.setData({ 'newFood.name': name });
    this.calculateNutrition(name, this.data.newFood.amount);
  },

  bindAmountInput(e) {
    const amount = e.detail.value;
    this.setData({ 'newFood.amount': amount });
    this.calculateNutrition(this.data.newFood.name, amount);
  },

  calculateNutrition(foodName, amount) {
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
      if (ingredient.name && foodName.includes(ingredient.name)) {
        const baseNutrition = {
          calories: ingredient.calorie_100g,
          protein: ingredient.nutrition_100g.protein,
          carbohydrate: ingredient.nutrition_100g.carbohydrate,
          fat: ingredient.nutrition_100g.fat
        };
        // 基于100g的营养数据计算
        const ratio = amountNum / 100;
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
    const { name, amount, nutrition } = this.data.newFood;

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
    this.setData({ showAddForm: false });
  },

  cancelAddFood() {
    this.setData({ showAddForm: false });
  },

  editFood(e) {
    const index = e.currentTarget.dataset.index;
    const food = this.data.foods[index];
    
    this.setData({
      showAddForm: true,
      editingIndex: index,
      newFood: {
        name: food.name,
        amount: food.amount.toString(),
        nutrition: food.nutrition
      }
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
      id: Date.now(),
      mealType: this.getMealTypeText(mealType),
      time: new Date().toLocaleString(),
      foods: foods.map(food => ({
        name: food.name,
        amount: food.amount,
        unit: 'g'
      })),
      calories: totalNutrition.calories,
      protein: totalNutrition.protein,
      carbohydrate: totalNutrition.carbohydrate,
      fat: totalNutrition.fat
    };

    // 保存到本地存储
    const todayRecords = wx.getStorageSync('todayNutritionRecords') || [];
    const allRecords = wx.getStorageSync('nutritionRecords') || [];

    todayRecords.push(record);
    allRecords.unshift(record);

    wx.setStorageSync('todayNutritionRecords', todayRecords);
    wx.setStorageSync('nutritionRecords', allRecords);

    wx.showToast({ title: '记录成功', icon: 'success' });

    // 跳转回营养页面
    setTimeout(() => {
      wx.navigateBack();
    }, 1000);
  },

  getMealTypeText(type) {
    const mealTypes = {
      breakfast: '早餐',
      lunch: '午餐',
      dinner: '晚餐',
      snack: '加餐'
    };
    return mealTypes[type] || '其他';
  }
});