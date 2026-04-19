// nutrition/index.js
const api = require('../../../../utils/api');

Page({
  data: {
    activeTab: 'record',
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
    suggestions: []
  },

  onLoad() {
    this.loadTodayData();
    this.loadRecords();
  },

  onShow() {
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

          this.setData({
            todayIntake: totals
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

        this.setData({
          todayIntake: totals
        });

        if (totals.calories > 0) {
          this.generateSuggestions(totals);
        }
      });
  },

  loadRecords() {
    // 从后端API获取记录列表
    api.nutrition.getRecords()
      .then(res => {
        if (res.code === 200 && res.data) {
          const records = res.data.records || [];
          this.setData({ records: records.slice(0, 10) });
          // 缓存到本地
          wx.setStorageSync('nutritionRecords', records);
        }
      })
      .catch(() => {
        // 网络错误时使用缓存
        const records = wx.getStorageSync('nutritionRecords') || [];
        this.setData({ records: records.slice(0, 10) });
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

    const mealTypeText = this.getMealTypeText(record.meal_type);
    const foods = record.items ? record.items.map(f => f.food_name).join('、') : '';

    wx.showModal({
      title: mealTypeText + ' - ' + (record.created_at || ''),
      content: `食物：${foods}\n热量：${record.total_calories || 0}kcal\n蛋白质：${record.total_protein || 0}g\n碳水：${record.total_carbohydrate || 0}g\n脂肪：${record.total_fat || 0}g`,
      showCancel: false
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
  }
});