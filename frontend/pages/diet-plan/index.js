// diet-plan/index.js
Page({
  data: {
    planStatus: 0,
    selectedDietitian: null,
    pendingRequest: null,
    currentPlan: null,
    historyPlans: []
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const selectedDietitian = wx.getStorageSync('selectedDietitian');
    const pendingRequest = wx.getStorageSync('pendingServiceRequest');
    const currentPlan = wx.getStorageSync('currentDietPlan');
    const historyPlans = wx.getStorageSync('dietPlanHistory') || [];

    this.setData({
      selectedDietitian,
      pendingRequest,
      currentPlan,
      historyPlans
    });

    this.determineStatus();
  },

  determineStatus() {
    const { selectedDietitian, pendingRequest, currentPlan } = this.data;
    let status = 0;

    if (currentPlan && currentPlan.status === 'published') {
      status = 4;
    } else if (currentPlan && currentPlan.status === 'pending_audit') {
      status = 3;
    } else if (pendingRequest) {
      status = 2;
    } else if (selectedDietitian) {
      status = 1;
    } else {
      status = 0;
    }

    this.setData({ planStatus: status });
  },

  goToSelectDietitian() {
    wx.navigateTo({
      url: '/pages/user/select-dietitian/index'
    });
  },

  goToServiceRequest() {
    const dietitian = this.data.selectedDietitian;
    if (dietitian) {
      wx.navigateTo({
        url: '/pages/user/service-request/index?dietitianId=' + dietitian.id + '&dietitianName=' + dietitian.name
      });
    }
  },

  viewPlanDetail() {
    if (!this.data.currentPlan) {
      wx.showToast({ title: '暂无计划', icon: 'none' });
      return;
    }
    wx.showToast({ title: '查看计划详情', icon: 'none' });
  },

  applyOptimization() {
    wx.showModal({
      title: '申请优化',
      content: '确定要申请优化当前膳食计划吗？',
      success: (res) => {
        if (res.confirm) {
          const plan = this.data.currentPlan;
          if (plan) {
            plan.optimizationRequested = true;
            wx.setStorageSync('currentDietPlan', plan);
            this.setData({ currentPlan: plan });
            wx.showToast({ title: '已提交优化申请', icon: 'success' });
          }
        }
      }
    });
  },

  changeDietitian() {
    wx.showModal({
      title: '变更规划师',
      content: '确定要更换规划师吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('selectedDietitian');
          wx.removeStorageSync('pendingServiceRequest');
          this.setData({
            selectedDietitian: null,
            pendingRequest: null
          });
          this.determineStatus();
          this.goToSelectDietitian();
        }
      }
    });
  },

  cancelRequest() {
    wx.showModal({
      title: '取消请求',
      content: '确定要取消当前服务请求吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('pendingServiceRequest');
          this.setData({ pendingRequest: null });
          this.determineStatus();
          wx.showToast({ title: '已取消请求', icon: 'success' });
        }
      }
    });
  },

  requestAiRecommendation() {
    const healthData = wx.getStorageSync('cachedHealthData');
    if (!healthData || !healthData.height || !healthData.weight) {
      wx.showModal({
        title: '提示',
        content: '请先完善健康数据，以便生成更精准的推荐方案',
        showCancel: true,
        confirmText: '去完善',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/user/health/index' });
          }
        }
      });
      return;
    }

    wx.showLoading({ title: '生成推荐方案中...' });

    setTimeout(() => {
      wx.hideLoading();
      const plan = {
        id: 'AI' + Date.now(),
        title: '智能推荐膳食计划',
        source: 'ai',
        dietitianName: '系统智能',
        status: 'published',
        goal: '智能匹配',
        calories: 1800,
        protein: 75,
        carbohydrate: 220,
        fat: 50,
        createTime: new Date().toLocaleString(),
        meals: [
          {
            type: '早餐',
            time: '07:30',
            calories: 400,
            foods: [
              { name: '全麦面包', amount: '2片', calories: 140 },
              { name: '鸡蛋', amount: '1个', calories: 70 },
              { name: '牛奶', amount: '200ml', calories: 120 },
              { name: '蔬菜', amount: '100g', calories: 30 }
            ]
          },
          {
            type: '午餐',
            time: '12:00',
            calories: 650,
            foods: [
              { name: '糙米饭', amount: '1碗', calories: 200 },
              { name: '鸡胸肉', amount: '100g', calories: 130 },
              { name: '西兰花', amount: '150g', calories: 55 },
              { name: '番茄', amount: '1个', calories: 30 }
            ]
          },
          {
            type: '晚餐',
            time: '18:30',
            calories: 500,
            foods: [
              { name: '红薯', amount: '1个', calories: 150 },
              { name: '鱼肉', amount: '100g', calories: 90 },
              { name: '菠菜', amount: '150g', calories: 45 },
              { name: '豆腐', amount: '50g', calories: 40 }
            ]
          },
          {
            type: '加餐',
            time: '15:00',
            calories: 150,
            foods: [
              { name: '水果', amount: '1份', calories: 80 },
              { name: '坚果', amount: '10g', calories: 70 }
            ]
          }
        ]
      };

      wx.setStorageSync('currentDietPlan', plan);
      this.setData({ currentPlan: plan });
      this.determineStatus();
      wx.showToast({ title: '推荐方案已生成', icon: 'success' });
    }, 1500);
  },

  viewRequestDetail() {
    const request = this.data.pendingRequest;
    if (!request) return;

    wx.showModal({
      title: '服务请求详情',
      content: `服务类型：${request.service_type === 'diet_plan' ? '膳食计划定制' : '营养咨询服务'}\n饮食目标：${request.diet_goal}\n提交时间：${request.create_time}\n状态：等待规划师响应`,
      showCancel: false
    });
  },

  executeMeal(e) {
    const mealIndex = e.currentTarget.dataset.mealIndex;
    const plan = this.data.currentPlan;
    if (plan && plan.meals[mealIndex]) {
      plan.meals[mealIndex].executed = !plan.meals[mealIndex].executed;
      wx.setStorageSync('currentDietPlan', plan);
      this.setData({ currentPlan: plan });
      wx.showToast({
        title: plan.meals[mealIndex].executed ? '已标记完成' : '已取消完成',
        icon: 'success'
      });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  }
});