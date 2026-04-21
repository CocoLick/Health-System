const api = require('../../../../utils/api');

// diet-plan/index.js
Page({
  data: {
    planStatus: 0,
    selectedDietitian: null,
    pendingRequest: null,
    currentPlan: null,
    historyPlans: [],
    latestRequest: null
  },

  onLoad() {
    console.log('页面加载');
    // 检查是否有当前膳食计划，如果有则直接跳转到详情页面
    this.checkDietPlan();
    this.checkPendingRequest();
    this.loadLatestRequest();
  },

  onShow() {
    console.log('页面显示');
    // 检查是否有当前膳食计划，如果有则直接跳转到详情页面
    this.checkDietPlan();
    this.checkPendingRequest();
    this.loadLatestRequest();
  },

  // 检查是否有当前膳食计划
  checkDietPlan() {
    const currentPlan = wx.getStorageSync('currentDietPlan');
    if (currentPlan && currentPlan.status === 'published') {
      // 有膳食计划，直接跳转到详情页面
      // 使用redirectTo替代navigateTo，减少跳转感知
      wx.redirectTo({
        url: '/pages/user/diet/diet-plan/detail/index'
      });
    }
  },

  checkPendingRequest() {
    // 检查是否有未处理的服务请求
    console.log('检查未处理的服务请求');
    api.serviceRequest.getList()
      .then(res => {
        console.log('服务请求列表API响应:', res);
        if (res.code === 200) {
          const requests = res.data || [];
          console.log('服务请求列表:', requests);
          // 只查找状态为pending的请求
          const pendingRequest = requests.find(req => req.status === 'pending');
          console.log('未处理的服务请求:', pendingRequest);
          
          // 不再自动跳转到服务请求详情页面，而是在初始页面显示申请信息
          // 清除本地存储中的pendingServiceRequest
          wx.removeStorageSync('pendingServiceRequest');
          this.loadData();
        } else {
          // API调用失败，加载本地数据
          console.log('服务请求列表API调用失败:', res);
          this.loadData();
        }
      })
      .catch(err => {
        console.error('检查服务请求失败:', err);
        // 网络错误，加载本地数据
        this.loadData();
      });
  },

  loadData() {
    const selectedDietitian = wx.getStorageSync('selectedDietitian');
    let pendingRequest = wx.getStorageSync('pendingServiceRequest');
    // 只保留状态为pending的请求
    if (pendingRequest && pendingRequest.status !== 'pending') {
      pendingRequest = null;
      wx.removeStorageSync('pendingServiceRequest');
    }
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
    const { pendingRequest, currentPlan } = this.data;
    let status = 0;

    if (currentPlan && currentPlan.status === 'published') {
      status = 4;
    } else if (currentPlan && currentPlan.status === 'pending_audit') {
      status = 3;
    } else if (pendingRequest) {
      status = 2;
    } else {
      status = 0;
    }

    this.setData({ planStatus: status });
  },

  goToSelectDietitian() {
    wx.navigateTo({
      url: '/pages/user/dietitian/select/index'
    });
  },

  goToServiceRequest() {
    const dietitian = this.data.selectedDietitian;
    if (dietitian) {
      wx.navigateTo({
        url: '/pages/user/dietitian/request/index?dietitianId=' + dietitian.id + '&dietitianName=' + dietitian.name
      });
    }
  },

  viewPlanDetail() {
    if (!this.data.currentPlan) {
      wx.showToast({ title: '暂无计划', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/user/diet/diet-plan/detail/index'
    });
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
      // 直接跳转到膳食计划详情页面
      wx.navigateTo({
        url: '/pages/user/diet/diet-plan/detail/index'
      });
    }, 1500);
  },

  viewPendingRequestDetail() {
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
  },

  // 加载最新服务请求
  loadLatestRequest() {
    console.log('开始加载最新服务请求');
    api.serviceRequest.getList()
      .then(res => {
        console.log('服务请求列表API响应:', res);
        if (res.code === 200) {
          const requests = res.data || [];
          console.log('服务请求列表:', requests);
          console.log('服务请求列表长度:', requests.length);
          if (requests.length > 0) {
            // 按创建时间排序，获取最新的请求
            requests.sort((a, b) => {
              const dateA = a.create_time ? new Date(a.create_time) : new Date(0);
              const dateB = b.create_time ? new Date(b.create_time) : new Date(0);
              return dateB - dateA;
            });
            const latestRequest = requests[0];
            console.log('最新服务请求:', latestRequest);
            
            // 转换字段为中文
            latestRequest.statusText = this.getStatusText(latestRequest.status);
            latestRequest.serviceTypeText = this.getServiceTypeName(latestRequest.service_type);
            latestRequest.dietGoalText = this.getDietGoalText(latestRequest.diet_goal, latestRequest.other_goal);
            latestRequest.createTimeText = this.formatDate(latestRequest.create_time);
            
            console.log('最新服务请求状态:', latestRequest.status);
            console.log('最新服务请求服务类型:', latestRequest.service_type);
            console.log('最新服务请求饮食目标:', latestRequest.diet_goal);
            console.log('最新服务请求创建时间:', latestRequest.create_time);
            this.setData({ latestRequest }, () => {
              console.log('最新服务请求设置完成');
              console.log('当前latestRequest:', this.data.latestRequest);
            });
          } else {
            console.log('没有服务请求');
            this.setData({ latestRequest: null }, () => {
              console.log('设置latestRequest为null');
            });
          }
        } else {
          console.log('获取服务请求列表失败:', res);
          this.setData({ latestRequest: null });
        }
      })
      .catch(err => {
        console.error('加载最新服务请求失败:', err);
        this.setData({ latestRequest: null });
      });
  },

  // 获取服务类型名称
  getServiceTypeName(type) {
    const typeMap = {
      'diet_plan': '膳食计划定制',
      'nutrition_consult': '营养咨询服务',
      'health_management': '健康管理服务'
    };
    return typeMap[type] || type;
  },

  // 获取饮食目标文本
  getDietGoalText(goal, otherGoal) {
    if (goal === 'other' && otherGoal) {
      return otherGoal;
    }
    const goalMap = {
      'weight_loss': '减脂',
      'weight_gain': '增重',
      'diabetes_control': '控糖',
      'health_maintain': '养生',
      'sports_nutrition': '运动营养',
      'pregnancy': '孕期营养'
    };
    return goalMap[goal] || goal;
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待处理',
      'approved': '已通过',
      'rejected': '已拒绝',
      'cancelled': '已取消',
      'completed': '已完成'
    };
    return statusMap[status] || status;
  },

  // 格式化日期
  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // 查看请求详情
  viewRequestDetail() {
    const request = this.data.latestRequest;
    if (!request) return;
    wx.redirectTo({
      url: '/pages/user/dietitian/request-detail/index?id=' + request.request_id
    });
  },

  // 重新申请
  reapplyRequest() {
    const request = this.data.latestRequest;
    if (!request) return;
    wx.navigateTo({
      url: '/pages/user/dietitian/request/index?dietitianId=' + request.dietitian_id + '&dietitianName=' + request.dietitian_name
    });
  }
});