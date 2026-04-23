// nutrition/index.js
const api = require('../../../../utils/api');

Page({
  data: {
    activeTab: 'record',
    today: '',
    todayIntake: {
      calories: 0,
      protein: 0,
      carbohydrate: 0,
      fat: 0
    },
    targetIntake: {
      calories: 2000,
      protein: 75,
      carbohydrate: 250,
      fat: 65
    },
    records: [],
    suggestions: [],
    bmr: 0,
    isLoading: false,
    // 历史记录相关变量
    historyData: [],
    selectedDate: '',
    selectedDateText: '',
    trendTimeRange: '7',
    // 当日记录
    selectedDateRecords: [],
    selectedDateTotal: { calories: 0, protein: 0, carbohydrate: 0, fat: 0 },
    // 趋势数据
    trendData: [],
    trendAvgCalories: 0,
    trendMaxCalories: 0,
    // 食物详情弹窗
    showFoodDetailsModal: false,
    selectedMealName: '',
    selectedMealCalories: 0,
    selectedMealNutrition: { protein: 0, carbohydrate: 0, fat: 0 },
    selectedMealFoods: [],
    // 今日饮食记录详情弹窗
    showRecordDetailModal: false,
    selectedRecordDetail: null
  },

  onLoad(options) {
    // 设置今日日期
    const today = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
    this.setData({ today });
    
    // 初始化历史记录相关日期
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const selectedDate = `${year}-${month}-${day}`;
    const selectedDateText = `${year}年${month}月${day}日`;
    this.setData({
      selectedDate,
      selectedDateText
    });
    
    // 检查本地存储中是否有nutritionTab参数，如果有则切换到对应的标签页
    const nutritionTab = wx.getStorageSync('nutritionTab');
    if (nutritionTab) {
      this.setData({ activeTab: nutritionTab });
      // 清除本地存储中的参数，避免下次打开页面时仍然切换到该标签页
      wx.removeStorageSync('nutritionTab');
    }
    
    this.loadTargetIntake();
    this.loadTodayData();
    this.loadRecords();
  },

  onShow() {
    // 每次显示页面时更新日期
    const today = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
    this.setData({ today });
    
    // 清除缓存，确保每次都从后端获取最新数据
    wx.removeStorageSync('todayNutritionRecords');
    
    // 检查本地存储中是否有nutritionTab参数，如果有则切换到对应的标签页
    const nutritionTab = wx.getStorageSync('nutritionTab');
    if (nutritionTab) {
      this.setData({ activeTab: nutritionTab });
      // 清除本地存储中的参数，避免下次打开页面时仍然切换到该标签页
      wx.removeStorageSync('nutritionTab');
    }
    
    this.loadTargetIntake();
    this.loadTodayData();
    this.loadRecords();
  },

  loadTodayData() {
    // 从后端API获取今日营养数据
    api.nutrition.getTodayRecords()
      .then(res => {
        if (res.code === 200 && res.data) {
          const records = res.data || [];
          let totals = { calories: 0, protein: 0, carbohydrate: 0, fat: 0 };

          records.forEach(record => {
            totals.calories += record.total_calories || 0;
            totals.protein += record.total_protein || 0;
            totals.carbohydrate += record.total_carbohydrate || 0;
            totals.fat += record.total_fat || 0;
          });

          // 处理小数，保留1位小数
          const formattedTotals = {
            calories: parseFloat(this.formatNumber(totals.calories)),
            protein: parseFloat(this.formatNumber(totals.protein)),
            carbohydrate: parseFloat(this.formatNumber(totals.carbohydrate)),
            fat: parseFloat(this.formatNumber(totals.fat))
          };

          this.setData({
            todayIntake: formattedTotals
          });

          // 缓存到本地Storage
          wx.setStorageSync('todayNutritionRecords', records);

          this.generateSuggestions(totals);
        } else {
          this.setData({
            todayIntake: { calories: 0, protein: 0, carbohydrate: 0, fat: 0 }
          });
        }
      })
      .catch(() => {
        console.log('获取今日数据失败，尝试使用缓存');
        // 网络错误时尝试读取缓存
        const todayRecords = wx.getStorageSync('todayNutritionRecords') || [];
        let totals = { calories: 0, protein: 0, carbohydrate: 0, fat: 0 };

        todayRecords.forEach(record => {
          totals.calories += record.calories || 0;
          totals.protein += record.protein || 0;
          totals.carbohydrate += record.carbohydrate || 0;
          totals.fat += record.fat || 0;
        });

        // 处理小数，保留1位小数
        const formattedTotals = {
          calories: parseFloat(this.formatNumber(totals.calories)),
          protein: parseFloat(this.formatNumber(totals.protein)),
          carbohydrate: parseFloat(this.formatNumber(totals.carbohydrate)),
          fat: parseFloat(this.formatNumber(totals.fat))
        };

        this.setData({
          todayIntake: formattedTotals
        });

        this.generateSuggestions(formattedTotals);
      });
  },

  // 加载目标摄入量（优先使用膳食计划）
  loadTargetIntake() {
    this.setData({ isLoading: true });
    
    // 优先检查是否存在当日膳食计划
    const currentPlan = wx.getStorageSync('currentDietPlan');
    if (currentPlan && currentPlan.status === 'published') {
      // 使用膳食计划的营养目标
      const formattedNutrients = {
        calories: parseFloat(this.formatNumber(currentPlan.calories)),
        protein: parseFloat(this.formatNumber(currentPlan.protein)),
        carbohydrate: parseFloat(this.formatNumber(currentPlan.carbohydrate)),
        fat: parseFloat(this.formatNumber(currentPlan.fat))
      };
      
      this.setData({
        targetIntake: formattedNutrients,
        bmr: 0, // 膳食计划模式下不使用BMR
        isLoading: false
      });
      
      console.log('使用膳食计划的营养目标');
      return;
    }
    
    // 如果没有膳食计划，使用基于个人健康数据的推荐标准
    api.nutrition.getRecommendation()
      .then(res => {
        if (res.code === 200 && res.data) {
          const recommendation = res.data;
          
          // 处理小数，保留1位小数
          const formattedNutrients = {
            calories: parseFloat(this.formatNumber(recommendation.nutrients.calories)),
            protein: parseFloat(this.formatNumber(recommendation.nutrients.protein)),
            carbohydrate: parseFloat(this.formatNumber(recommendation.nutrients.carbohydrate)),
            fat: parseFloat(this.formatNumber(recommendation.nutrients.fat))
          };
          
          this.setData({
            targetIntake: formattedNutrients,
            bmr: parseFloat(this.formatNumber(recommendation.bmr))
          });
          
          // 缓存推荐标准
          wx.setStorageSync('nutritionRecommendation', {
            ...recommendation,
            nutrients: formattedNutrients,
            bmr: parseFloat(this.formatNumber(recommendation.bmr))
          });
        }
      })
      .catch(() => {
        console.log('获取推荐标准失败，使用默认值');
        // 尝试使用缓存
        const cached = wx.getStorageSync('nutritionRecommendation');
        if (cached) {
          // 处理小数，保留1位小数
          const formattedNutrients = {
            calories: parseFloat(this.formatNumber(cached.nutrients.calories)),
            protein: parseFloat(this.formatNumber(cached.nutrients.protein)),
            carbohydrate: parseFloat(this.formatNumber(cached.nutrients.carbohydrate)),
            fat: parseFloat(this.formatNumber(cached.nutrients.fat))
          };
          
          this.setData({
            targetIntake: formattedNutrients,
            bmr: parseFloat(this.formatNumber(cached.bmr))
          });
        }
      })
      .finally(() => {
        this.setData({ isLoading: false });
      });
  },

  // 加载营养推荐标准（保留原方法，供需要时使用）
  loadRecommendation() {
    this.setData({ isLoading: true });
    
    api.nutrition.getRecommendation()
      .then(res => {
        if (res.code === 200 && res.data) {
          const recommendation = res.data;
          
          // 处理小数，保留1位小数
          const formattedNutrients = {
            calories: parseFloat(this.formatNumber(recommendation.nutrients.calories)),
            protein: parseFloat(this.formatNumber(recommendation.nutrients.protein)),
            carbohydrate: parseFloat(this.formatNumber(recommendation.nutrients.carbohydrate)),
            fat: parseFloat(this.formatNumber(recommendation.nutrients.fat))
          };
          
          this.setData({
            targetIntake: formattedNutrients,
            bmr: parseFloat(this.formatNumber(recommendation.bmr))
          });
          
          // 缓存推荐标准
          wx.setStorageSync('nutritionRecommendation', {
            ...recommendation,
            nutrients: formattedNutrients,
            bmr: parseFloat(this.formatNumber(recommendation.bmr))
          });
        }
      })
      .catch(() => {
        console.log('获取推荐标准失败，使用默认值');
        // 尝试使用缓存
        const cached = wx.getStorageSync('nutritionRecommendation');
        if (cached) {
          // 处理小数，保留1位小数
          const formattedNutrients = {
            calories: parseFloat(this.formatNumber(cached.nutrients.calories)),
            protein: parseFloat(this.formatNumber(cached.nutrients.protein)),
            carbohydrate: parseFloat(this.formatNumber(cached.nutrients.carbohydrate)),
            fat: parseFloat(this.formatNumber(cached.nutrients.fat))
          };
          
          this.setData({
            targetIntake: formattedNutrients,
            bmr: parseFloat(this.formatNumber(cached.bmr))
          });
        }
      })
      .finally(() => {
        this.setData({ isLoading: false });
      });
  },

  loadRecords() {
    // 从后端API获取今日记录
    api.nutrition.getTodayRecords()
      .then(res => {
        if (res.code === 200) {
          const records = res.data || [];
          // 处理时间格式和小数
          const processedRecords = records.map(record => ({
            ...record,
            total_calories: parseFloat(this.formatNumber(record.total_calories)),
            total_protein: parseFloat(this.formatNumber(record.total_protein)),
            total_carbohydrate: parseFloat(this.formatNumber(record.total_carbohydrate)),
            total_fat: parseFloat(this.formatNumber(record.total_fat)),
            formattedTime: this.formatTime(record.created_at)
          }));
          this.setData({ records: processedRecords });
          // 缓存到本地
          wx.setStorageSync('nutritionRecords', processedRecords);
        }
      })
      .catch(() => {
        // 网络错误时使用缓存
        const records = wx.getStorageSync('nutritionRecords') || [];
        // 处理时间格式和小数
        const processedRecords = records.map(record => ({
          ...record,
          total_calories: parseFloat(this.formatNumber(record.total_calories)),
          total_protein: parseFloat(this.formatNumber(record.total_protein)),
          total_carbohydrate: parseFloat(this.formatNumber(record.total_carbohydrate)),
          total_fat: parseFloat(this.formatNumber(record.total_fat)),
          formattedTime: this.formatTime(record.created_at)
        }));
        this.setData({ records: processedRecords });
      });
  },

  generateSuggestions(intake) {
    const suggestions = [];
    const { calories, protein, carbohydrate, fat } = intake;
    const target = this.data.targetIntake;

    if (calories < target.calories * 0.5) {
      suggestions.push({
        icon: '🍽️',
        title: '热量摄入不足',
        desc: '今日热量摄入偏低，建议适当增加主食和肉类摄入'
      });
    } else if (calories > target.calories) {
      suggestions.push({
        icon: '⚠️',
        title: '热量摄入超标',
        desc: '今日热量摄入已超过目标，建议减少高油脂食物'
      });
    }

    if (protein < target.protein * 0.6) {
      suggestions.push({
        icon: '💪',
        title: '蛋白质摄入不足',
        desc: '建议增加鸡蛋、鸡胸肉、鱼虾等优质蛋白'
      });
    }

    if (carbohydrate < target.carbohydrate * 0.5) {
      suggestions.push({
        icon: '🍚',
        title: '碳水化合物不足',
        desc: '建议增加粗粮、薯类等碳水化合物摄入'
      });
    }

    if (fat > target.fat) {
      suggestions.push({
        icon: '🥑',
        title: '脂肪摄入偏高',
        desc: '建议减少油炸食品和肥肉的摄入'
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        icon: '✅',
        title: '营养摄入均衡',
        desc: '今日营养摄入结构良好，请继续保持'
      });
    }

    this.setData({ suggestions });
  },



  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  addRecord() {
    console.log('addRecord函数被调用');
    console.log('导航到:', '/pages/user/diet/add-record/index');
    wx.navigateTo({
      url: '/pages/user/diet/add-record/index',
      success: function(res) {
        console.log('导航成功:', res);
      },
      fail: function(err) {
        console.log('导航失败:', err);
      }
    });
  },

  viewRecordDetail(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.records[index];
    if (!record) return;

    const detail = {
      mealTypeText: this.getMealTypeText(record.meal_type),
      timeText: record.formattedTime || this.formatTime(record.created_at),
      calories: record.total_calories || 0,
      protein: record.total_protein || 0,
      carbohydrate: record.total_carbohydrate || 0,
      fat: record.total_fat || 0,
      foods: (record.items || []).map((f) => ({
        name: f.food_name || f.name || '未知食物',
        amount: f.amount || 0,
        unit: f.unit || 'g',
        calories: f.calories || 0
      }))
    };

    this.setData({
      showRecordDetailModal: true,
      selectedRecordDetail: detail
    });
  },

  closeRecordDetail() {
    this.setData({
      showRecordDetailModal: false,
      selectedRecordDetail: null
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

  formatTime(datetime) {
    if (!datetime) return '';
    // 解析日期时间
    const date = new Date(datetime);
    if (isNaN(date.getTime())) return datetime;
    // 格式化为 HH:MM
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 处理小数，保留指定位数
  formatNumber(num, decimalPlaces = 1) {
    return parseFloat(num).toFixed(decimalPlaces);
  },

  // 切换到历史记录标签时加载数据
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    
    // 如果切换到历史记录标签，加载当日记录和趋势数据
    if (tab === 'history') {
      this.loadSelectedDateRecords();
      this.loadTrendData();
    }
  },

  // 处理日期选择
  changeDate(e) {
    const date = e.detail.value;
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const selectedDateText = `${year}年${month}月${day}日`;
    
    this.setData({
      selectedDate: date,
      selectedDateText
    });
    
    this.loadSelectedDateRecords();
  },

  // 设置趋势时间范围
  setTrendTimeRange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ trendTimeRange: range });
    this.loadTrendData();
  },

  // 显示食物详情
  showFoodDetails(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.selectedDateRecords[index];
    if (!record) return;

    // 计算该餐的营养素
    const protein = record.protein || 0;
    const carbohydrate = record.carbohydrate || 0;
    const fat = record.fat || 0;

    // 转换餐别名称
    let mealName = '';
    switch (record.meal_type) {
      case 'breakfast':
        mealName = '早餐';
        break;
      case 'lunch':
        mealName = '午餐';
        break;
      case 'dinner':
        mealName = '晚餐';
        break;
      case 'snack':
        mealName = '加餐';
        break;
      default:
        mealName = '其他';
    }

    this.setData({
      showFoodDetailsModal: true,
      selectedMealName: mealName,
      selectedMealCalories: record.calories,
      selectedMealNutrition: {
        protein: parseFloat(this.formatNumber(protein)),
        carbohydrate: parseFloat(this.formatNumber(carbohydrate)),
        fat: parseFloat(this.formatNumber(fat))
      },
      selectedMealFoods: record.foods
    });
  },

  // 关闭食物详情
  closeFoodDetails() {
    this.setData({ showFoodDetailsModal: false });
  },

  // 加载选中日期的记录
  loadSelectedDateRecords() {
    const selectedDate = this.data.selectedDate;
    if (!selectedDate) return;
    
    wx.showLoading({ title: '加载中...' });
    
    api.nutrition.getRecordsByDate(selectedDate)
      .then(res => {
        wx.hideLoading();
        if (res.code === 200) {
          const records = res.data || [];
          // 转换数据格式
          const formattedRecords = records.map(record => ({
            meal_type: record.meal_type,
            calories: record.total_calories || 0,
            protein: record.total_protein || 0,
            carbohydrate: record.total_carbohydrate || 0,
            fat: record.total_fat || 0,
            foods: (record.items || []).map(item => ({
              food_name: item.food_name,
              amount: item.amount,
              unit: item.unit,
              calories: item.calories,
              protein: item.protein || 0,
              carbohydrate: item.carbohydrate || 0,
              fat: item.fat || 0
            }))
          }));
          
          const totalCalories = formattedRecords.reduce((sum, record) => sum + record.calories, 0);
          const totalProtein = formattedRecords.reduce((sum, record) => sum + (record.protein || 0), 0);
          const totalCarbohydrate = formattedRecords.reduce((sum, record) => sum + (record.carbohydrate || 0), 0);
          const totalFat = formattedRecords.reduce((sum, record) => sum + (record.fat || 0), 0);
          
          this.setData({
            selectedDateRecords: formattedRecords,
            selectedDateTotal: {
              calories: parseFloat(this.formatNumber(totalCalories)),
              protein: parseFloat(this.formatNumber(totalProtein)),
              carbohydrate: parseFloat(this.formatNumber(totalCarbohydrate)),
              fat: parseFloat(this.formatNumber(totalFat))
            }
          });
        } else {
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('加载记录失败:', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  // 加载趋势数据
  loadTrendData() {
    const trendTimeRange = this.data.trendTimeRange;
    const days = trendTimeRange === '7' ? 7 : 30;
    
    wx.showLoading({ title: '加载中...' });
    
    api.nutrition.getTrendData(days)
      .then(res => {
        wx.hideLoading();
        if (res.code === 200) {
          const trendData = res.data.trendData || [];
          const avgCalories = res.data.avgCalories || 0;
          const maxCalories = res.data.maxCalories || 0;
          
          // 计算图表高度百分比
          const maxHeight = maxCalories || 1;
          const processedTrendData = trendData.map(item => ({
            ...item,
            height: (item.calories / maxHeight * 100).toFixed(1)
          }));
          
          this.setData({
            trendData: processedTrendData,
            trendAvgCalories: parseFloat(this.formatNumber(avgCalories)),
            trendMaxCalories: parseFloat(this.formatNumber(maxCalories))
          });
        } else {
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('加载趋势数据失败:', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },



  // 导出数据
  exportData() {
    wx.showModal({
      title: '导出数据',
      content: '确定要导出历史饮食记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '导出中...' });
          
          // 模拟导出过程
          setTimeout(() => {
            wx.hideLoading();
            wx.showToast({ title: '导出成功', icon: 'success' });
          }, 1000);
        }
      }
    });
  }
});