// dietitian/service/diet-plan/index.js
const api = require('../../../../utils/api');

Page({
  data: {
    userId: '',
    planId: '', // 膳食计划ID，用于更新和发布
    userInfo: {
      username: '用户',
      usernameInitial: '用',
      healthData: {
        height: 170,
        weight: 60
      }
    },
    planInfo: {
      title: '',
      dietGoal: 'weight_loss',
      duration: 7,
      dailyCalories: 1800,
      nutritionRatio: {
        protein: 30,
        carbohydrate: 40,
        fat: 30
      }
    },
    dietGoals: ['减脂', '增重', '控糖', '养生', '运动营养', '孕期营养', '其他'],
    dietGoalValues: ['weight_loss', 'weight_gain', 'diabetes_control', 'health_maintain', 'sports_nutrition', 'pregnancy', 'other'],
    selectedDietGoalIndex: 0,
    currentDay: 1,
    currentDayMeals: [],
    planDays: [],
    ingredients: [], // 从后端获取的食材列表
    searchResults: [], // 搜索结果
    showSearchResults: false, // 是否显示搜索结果
    searchKeyword: '',
    showFoodModal: false,
    showAmountModal: false,
    selectedFood: {},
    foodAmount: 100,
    foodUnit: 'g',
    gramPerUnit: 1,
    unitOptions: ['g', '个', '碗', '杯', '勺'], // 单位选项
    unitIndex: 0,
    currentIngredient: null,
    selectedMealIndex: 0
  },

  onLoad(options) {
    const userId = options.userId || 'U001';
    console.log('=== onLoad 开始 === userId:', userId);
    this.setData({
      userId: userId
    });
    this.initPlanDays();
    this.loadIngredients();
    this.loadUserInfo(userId);
    this.loadUserDietPlan(userId);
  },

  loadUserDietPlan(userId) {
    console.log('=== 1. loadUserDietPlan 开始 === userId:', userId);
    
    api.dietPlan.getUserPlans(userId)
      .then(res => {
        console.log('=== 2. getUserPlans 响应 === code:', res.code);
        console.log('=== 2. getUserPlans 数据 === data:', res.data);
        
        if (res.code === 200 && Array.isArray(res.data) && res.data.length > 0) {
          const plans = res.data;
          
          plans.sort((a, b) => new Date(b.update_time) - new Date(a.update_time));
          const latestPlan = plans[0];
          
          console.log('=== 3. 最新计划 ===', latestPlan);
          console.log('=== 4. 计划ID ===', latestPlan.id);
          console.log('=== 5. 计划标题 ===', latestPlan.title);
          console.log('=== 6. 计划目标 ===', latestPlan.goal);
          console.log('=== 7. 计划天数 ===', latestPlan.cycle_days);
          
          this.setData({
            planId: latestPlan.id,
            planInfo: {
              title: latestPlan.title || '',
              dietGoal: latestPlan.goal || 'weight_loss',
              duration: latestPlan.cycle_days || 7,
              dailyCalories: 1800,
              nutritionRatio: {
                protein: 30,
                carbohydrate: 40,
                fat: 30
              }
            },
            selectedDietGoalIndex: Math.max(0, this.data.dietGoalValues.indexOf(latestPlan.goal || 'weight_loss'))
          });
          
          console.log('=== 8. setData 完成 ===');
          console.log('=== 8. 当前 planInfo.title ===', this.data.planInfo.title);
          
          if (latestPlan.id) {
            console.log('=== 9. 准备调用 loadPlanDays ===');
            this.loadPlanDays(latestPlan.id, userId);
          }
        } else {
          console.log('=== 2a. 没有找到计划 ===');
        }
      })
      .catch(err => {
        console.error('=== loadUserDietPlan 错误 ===', err);
      });
  },

  loadPlanDays(planId, userId) {
    console.log('=== 10. loadPlanDays 开始 === planId:', planId, 'userId:', userId);
    
    api.dietPlan.getDetail(planId, userId)
      .then(res => {
        console.log('=== 11. getDetail 响应 ===', res);
        
        if (res.code === 200 && res.data) {
          const planDetail = res.data;
          console.log('=== 12. planDetail ===', planDetail);
          console.log('=== 13. planDetail.plan_days ===', planDetail.plan_days);
          
          if (planDetail.plan_days && planDetail.plan_days.length > 0) {
            const planDays = planDetail.plan_days.map(day => ({
              dayIndex: day.day_index,
              date: day.date || day.plan_date,
              meals: day.meals || [
                { type: '早餐', time: '08:00', calories: 0, foods: [] },
                { type: '午餐', time: '12:00', calories: 0, foods: [] },
                { type: '晚餐', time: '18:00', calories: 0, foods: [] },
                { type: '加餐', time: '15:00', calories: 0, foods: [] }
              ]
            }));
            
            while (planDays.length < 7) {
              const dayIndex = planDays.length + 1;
              planDays.push({
                dayIndex: dayIndex,
                date: this.getDateByDayIndex(dayIndex),
                meals: [
                  { type: '早餐', time: '08:00', calories: 0, foods: [] },
                  { type: '午餐', time: '12:00', calories: 0, foods: [] },
                  { type: '晚餐', time: '18:00', calories: 0, foods: [] },
                  { type: '加餐', time: '15:00', calories: 0, foods: [] }
                ]
              });
            }
            
            console.log('=== 14. 准备 setData planDays ===', planDays);
            
            this.setData({
              planDays: planDays,
              currentDayMeals: planDays[0].meals
            });
            
            console.log('=== 15. setData 完成 ===');
            console.log('=== 15. planDays.length ===', this.data.planDays.length);
            
            wx.showToast({ title: '加载膳食计划成功', icon: 'success' });
          } else {
            console.log('=== 12a. 没有 plan_days 数据 ===');
          }
        }
      })
      .catch(err => {
        console.error('=== loadPlanDays 错误 ===', err);
      });
  },

  loadIngredients() {
    const cachedIngredients = wx.getStorageSync('cachedIngredients');
    if (cachedIngredients && cachedIngredients.length > 0) {
      this.setData({ ingredients: cachedIngredients });
    }
    
    api.ingredient.getList()
      .then(res => {
        if (res.code === 200 && res.data.ingredients) {
          const ingredients = res.data.ingredients;
          this.setData({ ingredients: ingredients });
          wx.setStorageSync('cachedIngredients', ingredients);
        }
      })
      .catch(() => {});
  },

  loadUserInfo(userId) {
    api.user.getUserInfo(userId)
      .then(res => {
        if (res.code === 200) {
          this.setData({
            userInfo: res.data
          });
        }
      })
      .catch(err => {
        console.error('loadUserInfo error:', err);
      });
  },

  initPlanDays() {
    const planDays = [];
    for (let i = 1; i <= 7; i++) {
      planDays.push({
        dayIndex: i,
        date: this.getDateByDayIndex(i),
        meals: [
          { type: '早餐', time: '08:00', calories: 0, foods: [] },
          { type: '午餐', time: '12:00', calories: 0, foods: [] },
          { type: '晚餐', time: '18:00', calories: 0, foods: [] },
          { type: '加餐', time: '15:00', calories: 0, foods: [] }
        ]
      });
    }
    this.setData({
      planDays: planDays,
      currentDayMeals: planDays[0].meals
    });
  },

  getDateByDayIndex(dayIndex) {
    const date = new Date();
    date.setDate(date.getDate() + dayIndex - 1);
    return date.toISOString().split('T')[0];
  },

  calculateBMI(height, weight) {
    const heightInMeters = height / 100;
    return weight / (heightInMeters * heightInMeters);
  },

  bindPlanInfo(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`planInfo.${field}`]: value
    });
  },

  bindDietGoalChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedDietGoalIndex: index,
      [`planInfo.dietGoal`]: this.data.dietGoalValues[index]
    });
  },

  bindNutritionRatio(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`planInfo.nutritionRatio.${field}`]: value
    });
  },

  calculateTotalRatio() {
    const { protein, carbohydrate, fat } = this.data.planInfo.nutritionRatio;
    return parseInt(protein) + parseInt(carbohydrate) + parseInt(fat);
  },

  switchDay(e) {
    const day = parseInt(e.currentTarget.dataset.day);
    const dayIndex = day - 1;
    if (dayIndex >= 0 && dayIndex < this.data.planDays.length) {
      const currentDayMeals = this.data.planDays[dayIndex].meals;
      this.setData({
        currentDay: day,
        currentDayMeals
      });
    }
  },

  addFood(e) {
    const mealIndex = e.currentTarget.dataset.mealIndex;
    this.setData({
      showFoodModal: true,
      selectedMealIndex: mealIndex
    });
  },

  deleteFood(e) {
    const mealIndex = e.currentTarget.dataset.mealIndex;
    const foodIndex = e.currentTarget.dataset.foodIndex;
    const planDays = this.data.planDays;
    const dayIndex = this.data.currentDay - 1;
    planDays[dayIndex].meals[mealIndex].foods.splice(foodIndex, 1);
    this.calculateMealCalories(dayIndex, mealIndex);
    const currentDayMeals = planDays[dayIndex].meals;
    this.setData({
      planDays,
      currentDayMeals
    });
  },

  bindSearchKeyword(e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });
    
    if (keyword) {
      const results = this.data.ingredients.filter(ingredient =>
        ingredient.name.toLowerCase().includes(keyword.toLowerCase())
      );
      this.setData({
        searchResults: results,
        showSearchResults: true
      });
    } else {
      this.setData({
        showSearchResults: false
      });
    }
  },

  selectIngredient(e) {
    const ingredient = e.currentTarget.dataset.ingredient;
    const selectedFood = {
      name: ingredient.name,
      calories: ingredient.calorie_100g || 0,
      protein: ingredient.protein || 0,
      carbohydrate: ingredient.carbohydrate || 0,
      fat: ingredient.fat || 0
    };
    this.setData({
      selectedFood: selectedFood,
      currentIngredient: ingredient,
      foodAmount: 100,
      foodUnit: 'g',
      gramPerUnit: 1,
      unitIndex: 0,
      showFoodModal: false,
      showAmountModal: true
    });
  },

  bindFoodAmount(e) {
    this.setData({ foodAmount: e.detail.value });
  },

  changeUnit(e) {
    const index = e.detail.value;
    const unit = this.data.unitOptions[index];
    let gramPerUnit = 100;
    switch(unit) {
      case 'g':
        gramPerUnit = 1;
        break;
      case '个':
        gramPerUnit = 100;
        break;
      case '碗':
        gramPerUnit = 200;
        break;
      case '杯':
        gramPerUnit = 250;
        break;
      case '勺':
        gramPerUnit = 15;
        break;
    }
    
    this.setData({
      unitIndex: index,
      foodUnit: unit,
      gramPerUnit: gramPerUnit
    });
  },

  confirmFoodAmount() {
    const { selectedFood, foodAmount, foodUnit, gramPerUnit, selectedMealIndex } = this.data;
    const planDays = this.data.planDays;
    const dayIndex = this.data.currentDay - 1;
    
    const actualGrams = foodAmount * gramPerUnit;
    const calories = (selectedFood.calories * actualGrams) / 100;
    
    planDays[dayIndex].meals[selectedMealIndex].foods.push({
      name: selectedFood.name,
      amount: `${foodAmount}${foodUnit}`,
      calories: Math.round(calories)
    });
    
    this.calculateMealCalories(dayIndex, selectedMealIndex);
    const currentDayMeals = planDays[dayIndex].meals;
    
    this.setData({
      planDays,
      currentDayMeals,
      showAmountModal: false,
      foodAmount: 100,
      foodUnit: 'g',
      gramPerUnit: 1,
      unitIndex: 0
    });
  },

  calculateMealCalories(dayIndex, mealIndex) {
    const planDays = this.data.planDays;
    const meal = planDays[dayIndex].meals[mealIndex];
    let totalCalories = 0;
    meal.foods.forEach(food => {
      totalCalories += food.calories;
    });
    meal.calories = totalCalories;
    this.setData({ planDays });
  },

  closeFoodModal() {
    this.setData({ showFoodModal: false });
  },

  closeAmountModal() {
    this.setData({ showAmountModal: false });
  },

  stopPropagation() {},

  savePlan() {
    const { planInfo, planDays, userId, planId } = this.data;
    
    if (!planInfo.title) {
      wx.showToast({ title: '请输入计划标题', icon: 'none' });
      return;
    }
    
    if (this.calculateTotalRatio() !== 100) {
      wx.showToast({ title: '营养比例总和必须为100%', icon: 'none' });
      return;
    }
    
    const requestData = {
      plan_title: planInfo.title,
      diet_goal: planInfo.dietGoal,
      cycle_days: planInfo.duration,
      plan_days: planDays.map(day => ({
        day_index: day.dayIndex,
        plan_date: day.date,
        calories: day.meals.reduce((total, meal) => total + meal.calories, 0),
        protein: 0,
        carbohydrate: 0,
        fat: 0,
        meals: day.meals.map(meal => ({
          type: meal.type,
          time: meal.time,
          calories: meal.calories,
          foods: meal.foods
        }))
      }))
    };
    
    wx.showLoading({ title: '保存中...' });
    
    if (planId) {
      api.dietPlan.update(planId, requestData, userId)
        .then(res => {
          wx.hideLoading();
          if (res.code === 200) {
            wx.showToast({ title: '计划保存成功', icon: 'success' });
          }
        })
        .catch(err => {
          wx.hideLoading();
          console.error('savePlan error:', err);
        });
    } else {
      const createData = {
        user_id: userId,
        service_request_id: '',
        dietitian_id: 'D001',
        plan_title: planInfo.title,
        source: 'dietitian',
        diet_goal: planInfo.dietGoal,
        cycle_days: planInfo.duration,
        plan_days: requestData.plan_days
      };
      
      api.dietPlan.create(createData)
        .then(res => {
          wx.hideLoading();
          if (res.code === 200) {
            wx.showToast({ title: '计划保存成功', icon: 'success' });
            this.setData({ planId: res.data.plan_id });
          }
        })
        .catch(err => {
          wx.hideLoading();
          console.error('savePlan error:', err);
        });
    }
  },

  publishPlan() {
    const { planInfo, planDays, userId, planId } = this.data;
    
    if (!planInfo.title) {
      wx.showToast({ title: '请输入计划标题', icon: 'none' });
      return;
    }
    
    if (this.calculateTotalRatio() !== 100) {
      wx.showToast({ title: '营养比例总和必须为100%', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '发布计划',
      content: '确定要发布此膳食计划吗？发布后用户将可以看到。',
      success: (res) => {
        if (res.confirm) {
          if (planId) {
            wx.showLoading({ title: '发布中...' });
            api.dietPlan.publish(planId, userId)
              .then(res => {
                wx.hideLoading();
                if (res.code === 200) {
                  wx.showToast({ title: '计划发布成功', icon: 'success' });
                  this.goBack();
                }
              })
              .catch(err => {
                wx.hideLoading();
                console.error('publishPlan error:', err);
              });
          } else {
            const requestData = {
              user_id: userId,
              service_request_id: '',
              dietitian_id: 'D001',
              plan_title: planInfo.title,
              source: 'dietitian',
              diet_goal: planInfo.dietGoal,
              cycle_days: planInfo.duration,
              plan_days: planDays.map(day => ({
                day_index: day.dayIndex,
                plan_date: day.date,
                calories: day.meals.reduce((total, meal) => total + meal.calories, 0),
                protein: 0,
                carbohydrate: 0,
                fat: 0,
                meals: day.meals.map(meal => ({
                  type: meal.type,
                  time: meal.time,
                  calories: meal.calories,
                  foods: meal.foods
                }))
              }))
            };
            
            wx.showLoading({ title: '发布中...' });
            
            api.dietPlan.create(requestData)
              .then(res => {
                wx.hideLoading();
                if (res.code === 200) {
                  wx.showToast({ title: '计划发布成功', icon: 'success' });
                  this.goBack();
                }
              })
              .catch(err => {
                wx.hideLoading();
                console.error('publishPlan error:', err);
              });
          }
        }
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
