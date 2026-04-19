// nutrition/index.js
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

    this.generateSuggestions(totals);
  },

  loadRecords() {
    const records = wx.getStorageSync('nutritionRecords') || [];
    this.setData({ records: records.slice(0, 10) });
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
    console.log('导航到:', '/pages/nutrition/add-record/index');
    wx.navigateTo({
      url: '/pages/nutrition/add-record/index',
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
    wx.showModal({
      title: record.mealType + ' - ' + record.time,
      content: `食物：${record.foods.map(f => f.name).join('、')}\n热量：${record.calories}kcal\n蛋白质：${record.protein}g\n碳水：${record.carbohydrate}g\n脂肪：${record.fat}g`,
      showCancel: false
    });
  }
});