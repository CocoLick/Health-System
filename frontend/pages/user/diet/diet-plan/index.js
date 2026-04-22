const api = require('../../../../utils/api');

// diet-plan/index.js
Page({
  data: {
    planStatus: 0,
    selectedDietitian: null,
    pendingRequest: null,
    currentPlan: null,
    historyPlans: [],
    latestRequest: null,
    selectedDate: '',
    selectedDateText: '',
    proteinPercentage: 0,
    carbohydratePercentage: 0,
    fatPercentage: 0
  },

  onLoad() {
    console.log('页面加载');
    this.checkPendingRequest();
    this.loadLatestRequest();
    // 初始化日期和营养比例
    this.initDate();
  },

  onShow() {
    console.log('页面显示');
    this.checkPendingRequest();
    this.loadLatestRequest();
    // 初始化日期和营养比例
    this.initDate();
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

  /** 切换账号后本地仍缓存他人膳食计划时，避免误删导致 403 */
  clearStaleDietPlanCache() {
    const plan = wx.getStorageSync('currentDietPlan');
    const me = (wx.getStorageSync('userInfo') || {}).user_id;
    if (plan && plan.user_id && me && plan.user_id !== me) {
      wx.removeStorageSync('currentDietPlan');
    }
  },

  loadData() {
    this.clearStaleDietPlanCache();
    const selectedDietitian = wx.getStorageSync('selectedDietitian');
    let pendingRequest = wx.getStorageSync('pendingServiceRequest');
    // 只保留状态为pending的请求
    if (pendingRequest && pendingRequest.status !== 'pending') {
      pendingRequest = null;
      wx.removeStorageSync('pendingServiceRequest');
    }
    
    // 从API获取用户的膳食计划
    api.dietPlan.getUserPlans()
      .then(res => {
        if (res.code === 200) {
          const plans = (res.data || []).slice();
          let currentPlan = null;
          let historyPlans = [];
          
          // 找到最新的已发布计划（按发布时间倒序更稳定）
          const publishedPlans = plans
            .filter(p => p && p.status === 'published')
            .sort((a, b) => {
              const dateA = a.published_at ? new Date(a.published_at) : new Date(0);
              const dateB = b.published_at ? new Date(b.published_at) : new Date(0);
              return dateB - dateA;
            });

          if (publishedPlans.length > 0) {
            const planData = publishedPlans[0];
              // 调用API获取计划详情，包含餐次和食物信息
              api.dietPlan.getDetail(planData.id)
                .then(detailRes => {
                  if (detailRes.code === 200) {
                    const detailData = detailRes.data;
                    const planGoalRaw = this.normalizePlanGoalRaw(detailData);
                    // 转换数据格式以适应前端需求
                    // 尝试从plan_days中获取开始时间（取第一天的日期）
                    let startDate = '';
                    if (detailData.plan_days && detailData.plan_days.length > 0) {
                      startDate = detailData.plan_days[0].date || detailData.plan_days[0].plan_date || '';
                    }
                    
                    currentPlan = {
                      id: detailData.id,
                      user_id: detailData.user_id,
                      dietitian_id: detailData.dietitian_id,
                      title: detailData.title,
                      source: detailData.source || (detailData.dietitian_name ? 'dietitian' : 'ai'),
                      // 规划师计划但后端没返回名字时，避免误显示“系统智能”
                      dietitianName: detailData.dietitian_name || detailData.dietitian_id || '规划师',
                      status: detailData.status,
                      // 后端详情/列表均使用 json 字段名 goal（饮食目标快照）
                      goal: planGoalRaw,
                      goalText: this.getDietGoalText(planGoalRaw, detailData.other_goal),
                      startDate: startDate,
                      calories: detailData.plan_days && detailData.plan_days.length > 0 ? detailData.plan_days[0].calories : 0,
                      protein: detailData.plan_days && detailData.plan_days.length > 0 ? detailData.plan_days[0].protein : 0,
                      carbohydrate: detailData.plan_days && detailData.plan_days.length > 0 ? detailData.plan_days[0].carbohydrate : 0,
                      fat: detailData.plan_days && detailData.plan_days.length > 0 ? detailData.plan_days[0].fat : 0,
                      createTime: detailData.published_at || new Date().toLocaleString(),
                      meals: detailData.plan_days && detailData.plan_days.length > 0 && detailData.plan_days[0].meals ? detailData.plan_days[0].meals.map(meal => ({
                        type: meal.type,
                        time: meal.time,
                        calories: meal.calories,
                        foods: meal.foods ? meal.foods.map(food => ({
                          name: food.name,
                          amount: food.amount,
                          calories: food.calories
                        })) : []
                      })) : [],
                      // 存储完整的plan_days数据
                      plan_days: detailData.plan_days ? detailData.plan_days.map(day => ({
                        id: day.id,
                        plan_id: day.plan_id,
                        day_index: day.day_index,
                        date: day.date,
                        plan_date: day.plan_date,
                        calories: day.calories,
                        protein: day.protein,
                        carbohydrate: day.carbohydrate,
                        fat: day.fat,
                        meals: day.meals ? day.meals.map(meal => ({
                          id: meal.id,
                          day_id: meal.day_id,
                          type: meal.type,
                          time: meal.time,
                          calories: meal.calories,
                          foods: meal.foods ? meal.foods.map(food => ({
                            id: food.id,
                            meal_id: food.meal_id,
                            name: food.name,
                            amount: food.amount,
                            calories: food.calories
                          })) : []
                        })) : []
                      })) : []
                    };
                    
                    // 存储到本地
                    wx.setStorageSync('currentDietPlan', currentPlan);
                    
                    this.setData({
                      selectedDietitian,
                      pendingRequest,
                      currentPlan,
                      historyPlans
                    });
                    
                    this.determineStatus();
                    this.initDate();
                  }
                })
                .catch(err => {
                  console.error('获取计划详情失败:', err);
                  // API调用失败，使用本地存储
                  const currentPlan = wx.getStorageSync('currentDietPlan');
                  const historyPlans = wx.getStorageSync('dietPlanHistory') || [];
                  
                  this.setData({
                    selectedDietitian,
                    pendingRequest,
                    currentPlan,
                    historyPlans
                  });
                  
                  this.determineStatus();
                  this.initDate();
                });
          }
          
          // 其他计划作为历史计划
          for (const planData of plans) {
            if (planData.status !== 'published') {
              historyPlans.push({
                id: planData.id,
                title: planData.title,
                dateRange: planData.published_at
              });
            }
          }
          
          if (historyPlans.length > 0) {
            wx.setStorageSync('dietPlanHistory', historyPlans);
          }
          
          if (!currentPlan) {
            // API调用失败，使用本地存储
            const currentPlan = wx.getStorageSync('currentDietPlan');
            
            this.setData({
              selectedDietitian,
              pendingRequest,
              currentPlan,
              historyPlans
            });
            
            this.determineStatus();
            this.initDate();
          }
        } else {
          // API调用失败，使用本地存储
          const currentPlan = wx.getStorageSync('currentDietPlan');
          const historyPlans = wx.getStorageSync('dietPlanHistory') || [];
          
          this.setData({
            selectedDietitian,
            pendingRequest,
            currentPlan,
            historyPlans
          });
        }
        
        this.determineStatus();
      })
      .catch(err => {
        // 网络错误，使用本地存储
        const currentPlan = wx.getStorageSync('currentDietPlan');
        const historyPlans = wx.getStorageSync('dietPlanHistory') || [];
        
        this.setData({
          selectedDietitian,
          pendingRequest,
          currentPlan,
          historyPlans
        });
        
        this.determineStatus();
      });
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
    // 计划详情已经在当前页面显示，不需要任何操作
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

    // 若已有当前计划，先删除，避免生成多份“已发布计划”导致放弃后又出现旧计划
    const existingPlan = this.data.currentPlan;
    const removeExistingPlanIfNeeded = () => {
      if (existingPlan && existingPlan.id) {
        return api.dietPlan.remove(existingPlan.id).catch(() => undefined);
      }
      return Promise.resolve();
    };

    // 生成7天的膳食计划数据
    const planDays = [];
    const today = new Date();
    
    // 7天的早餐选项
    const breakfastOptions = [
      {
        foods: [
          { name: '全麦面包', amount: '2片', calories: 140 },
          { name: '鸡蛋', amount: '1个', calories: 70 },
          { name: '牛奶', amount: '200ml', calories: 120 },
          { name: '蔬菜', amount: '100g', calories: 30 }
        ]
      },
      {
        foods: [
          { name: '燕麦粥', amount: '1碗', calories: 150 },
          { name: '鸡蛋', amount: '1个', calories: 70 },
          { name: '酸奶', amount: '100g', calories: 100 },
          { name: '香蕉', amount: '1根', calories: 80 }
        ]
      },
      {
        foods: [
          { name: '小米粥', amount: '1碗', calories: 120 },
          { name: '包子', amount: '1个', calories: 150 },
          { name: '鸡蛋', amount: '1个', calories: 70 },
          { name: '蔬菜', amount: '100g', calories: 30 }
        ]
      },
      {
        foods: [
          { name: '全麦馒头', amount: '1个', calories: 100 },
          { name: '鸡蛋', amount: '1个', calories: 70 },
          { name: '豆浆', amount: '200ml', calories: 80 },
          { name: '苹果', amount: '1个', calories: 100 }
        ]
      },
      {
        foods: [
          { name: '玉米', amount: '1根', calories: 120 },
          { name: '鸡蛋', amount: '1个', calories: 70 },
          { name: '牛奶', amount: '200ml', calories: 120 },
          { name: '蔬菜', amount: '100g', calories: 30 }
        ]
      },
      {
        foods: [
          { name: '红薯', amount: '1个', calories: 150 },
          { name: '鸡蛋', amount: '1个', calories: 70 },
          { name: '酸奶', amount: '100g', calories: 100 },
          { name: '草莓', amount: '100g', calories: 30 }
        ]
      },
      {
        foods: [
          { name: '全麦面包', amount: '2片', calories: 140 },
          { name: '鸡蛋', amount: '1个', calories: 70 },
          { name: '豆浆', amount: '200ml', calories: 80 },
          { name: '橙子', amount: '1个', calories: 70 }
        ]
      }
    ];
    
    // 7天的午餐选项
    const lunchOptions = [
      {
        foods: [
          { name: '糙米饭', amount: '1碗', calories: 200 },
          { name: '鸡胸肉', amount: '100g', calories: 130 },
          { name: '西兰花', amount: '150g', calories: 55 },
          { name: '番茄', amount: '1个', calories: 30 }
        ]
      },
      {
        foods: [
          { name: '荞麦面', amount: '1碗', calories: 220 },
          { name: '鱼肉', amount: '100g', calories: 100 },
          { name: '菠菜', amount: '150g', calories: 45 },
          { name: '豆腐', amount: '50g', calories: 40 }
        ]
      },
      {
        foods: [
          { name: '米饭', amount: '1碗', calories: 180 },
          { name: '牛肉', amount: '100g', calories: 150 },
          { name: '胡萝卜', amount: '100g', calories: 40 },
          { name: '黄瓜', amount: '100g', calories: 15 }
        ]
      },
      {
        foods: [
          { name: '全麦面包', amount: '2片', calories: 140 },
          { name: '鸡胸肉', amount: '100g', calories: 130 },
          { name: '生菜', amount: '100g', calories: 15 },
          { name: '番茄', amount: '1个', calories: 30 }
        ]
      },
      {
        foods: [
          { name: '糙米饭', amount: '1碗', calories: 200 },
          { name: '虾肉', amount: '100g', calories: 90 },
          { name: '西兰花', amount: '150g', calories: 55 },
          { name: '豆腐', amount: '50g', calories: 40 }
        ]
      },
      {
        foods: [
          { name: '荞麦面', amount: '1碗', calories: 220 },
          { name: '瘦猪肉', amount: '100g', calories: 143 },
          { name: '菠菜', amount: '150g', calories: 45 },
          { name: '番茄', amount: '1个', calories: 30 }
        ]
      },
      {
        foods: [
          { name: '米饭', amount: '1碗', calories: 180 },
          { name: '鱼肉', amount: '100g', calories: 100 },
          { name: '胡萝卜', amount: '100g', calories: 40 },
          { name: '西兰花', amount: '150g', calories: 55 }
        ]
      }
    ];
    
    // 7天的晚餐选项
    const dinnerOptions = [
      {
        foods: [
          { name: '红薯', amount: '1个', calories: 150 },
          { name: '鱼肉', amount: '100g', calories: 90 },
          { name: '菠菜', amount: '150g', calories: 45 },
          { name: '豆腐', amount: '50g', calories: 40 }
        ]
      },
      {
        foods: [
          { name: '玉米', amount: '1根', calories: 120 },
          { name: '鸡胸肉', amount: '100g', calories: 130 },
          { name: '生菜', amount: '100g', calories: 15 },
          { name: '番茄', amount: '1个', calories: 30 }
        ]
      },
      {
        foods: [
          { name: '糙米饭', amount: '半碗', calories: 100 },
          { name: '牛肉', amount: '100g', calories: 150 },
          { name: '胡萝卜', amount: '100g', calories: 40 },
          { name: '黄瓜', amount: '100g', calories: 15 }
        ]
      },
      {
        foods: [
          { name: '全麦馒头', amount: '1个', calories: 100 },
          { name: '鱼肉', amount: '100g', calories: 100 },
          { name: '菠菜', amount: '150g', calories: 45 },
          { name: '豆腐', amount: '50g', calories: 40 }
        ]
      },
      {
        foods: [
          { name: '红薯', amount: '1个', calories: 150 },
          { name: '虾肉', amount: '100g', calories: 90 },
          { name: '西兰花', amount: '150g', calories: 55 },
          { name: '番茄', amount: '1个', calories: 30 }
        ]
      },
      {
        foods: [
          { name: '玉米', amount: '1根', calories: 120 },
          { name: '瘦猪肉', amount: '100g', calories: 143 },
          { name: '生菜', amount: '100g', calories: 15 },
          { name: '黄瓜', amount: '100g', calories: 15 }
        ]
      },
      {
        foods: [
          { name: '糙米饭', amount: '半碗', calories: 100 },
          { name: '鸡胸肉', amount: '100g', calories: 130 },
          { name: '胡萝卜', amount: '100g', calories: 40 },
          { name: '菠菜', amount: '150g', calories: 45 }
        ]
      }
    ];
    
    // 7天的加餐选项
    const snackOptions = [
      {
        foods: [
          { name: '水果', amount: '1份', calories: 80 },
          { name: '坚果', amount: '10g', calories: 70 }
        ]
      },
      {
        foods: [
          { name: '酸奶', amount: '100g', calories: 100 },
          { name: '水果', amount: '1份', calories: 50 }
        ]
      },
      {
        foods: [
          { name: '坚果', amount: '10g', calories: 70 },
          { name: '水果', amount: '1份', calories: 80 }
        ]
      },
      {
        foods: [
          { name: '酸奶', amount: '100g', calories: 100 },
          { name: '坚果', amount: '10g', calories: 70 }
        ]
      },
      {
        foods: [
          { name: '水果', amount: '1份', calories: 80 },
          { name: '酸奶', amount: '100g', calories: 100 }
        ]
      },
      {
        foods: [
          { name: '坚果', amount: '10g', calories: 70 },
          { name: '酸奶', amount: '100g', calories: 100 }
        ]
      },
      {
        foods: [
          { name: '水果', amount: '1份', calories: 80 },
          { name: '坚果', amount: '10g', calories: 70 }
        ]
      }
    ];
    
    // 生成7天的计划
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const planDate = date.toISOString().split('T')[0];
      
      // 计算每天的营养数据（保持基本一致，略有变化）
      const calories = 1800 + Math.floor(Math.random() * 100) - 50;
      const protein = parseFloat((75 + Math.floor(Math.random() * 10) - 5).toFixed(1));
      const carbohydrate = parseFloat((220 + Math.floor(Math.random() * 20) - 10).toFixed(1));
      const fat = parseFloat((50 + Math.floor(Math.random() * 10) - 5).toFixed(1));
      
      // 为每天选择不同的餐食
      const breakfast = {
        type: '早餐',
        time: '07:30',
        calories: 400,
        foods: breakfastOptions[i].foods
      };
      
      const lunch = {
        type: '午餐',
        time: '12:00',
        calories: 650,
        foods: lunchOptions[i].foods
      };
      
      const dinner = {
        type: '晚餐',
        time: '18:30',
        calories: 500,
        foods: dinnerOptions[i].foods
      };
      
      const snack = {
        type: '加餐',
        time: '15:00',
        calories: 150,
        foods: snackOptions[i].foods
      };
      
      planDays.push({
        day_index: i + 1,
        plan_date: planDate,
        calories: calories,
        protein: protein,
        carbohydrate: carbohydrate,
        fat: fat,
        meals: [breakfast, lunch, dinner, snack]
      });
    }

    // 调用API创建智能推荐膳食计划
    removeExistingPlanIfNeeded()
      .then(() => api.dietPlan.create({
        dietitian_id: 'D20260325001',
        plan_title: '智能推荐膳食计划',
        source: 'ai',
        diet_goal: '智能匹配',
        cycle_days: 7,
        plan_days: planDays
      }))
      .then(res => {
        if (res.code !== 200 || !res.data || !res.data.id) {
          throw new Error('create_diet_plan_failed');
        }
        const planId = res.data.id;
        // 创建接口可能不返回完整 plan_days/meals，二次拉详情更稳
        return api.dietPlan.getDetail(planId);
      })
      .then(detailRes => {
        wx.hideLoading();
        if (detailRes.code !== 200 || !detailRes.data) {
          throw new Error('get_diet_plan_detail_failed');
        }
        const detailData = detailRes.data;
        const day0 = detailData.plan_days && detailData.plan_days.length > 0 ? detailData.plan_days[0] : null;
        const planGoalRaw = this.normalizePlanGoalRaw(detailData);

        const plan = {
          id: detailData.id,
          user_id: detailData.user_id,
          dietitian_id: detailData.dietitian_id,
          title: detailData.title,
          source: detailData.source,
          dietitianName: detailData.dietitian_name || '系统智能',
          status: detailData.status,
          goal: planGoalRaw,
          goalText: this.getDietGoalText(planGoalRaw, detailData.other_goal),
          calories: day0 ? day0.calories : 0,
          protein: day0 ? day0.protein : 0,
          carbohydrate: day0 ? day0.carbohydrate : 0,
          fat: day0 ? day0.fat : 0,
          createTime: detailData.published_at || new Date().toLocaleString(),
          meals: day0 && day0.meals ? day0.meals.map(meal => ({
            type: meal.type,
            time: meal.time,
            calories: meal.calories,
            foods: meal.foods ? meal.foods.map(food => ({
              name: food.name,
              amount: food.amount,
              calories: food.calories
            })) : []
          })) : []
        };

        wx.setStorageSync('currentDietPlan', plan);
        this.setData({ currentPlan: plan });
        this.determineStatus();
        this.initDate();
        // 期望在当前 tab 页面直接展示详情，不再跳转旧的详情页
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      });
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

  /** 从膳食计划接口对象中取出饮食目标（兼容 goal / diet_goal） */
  normalizePlanGoalRaw(detail) {
    if (!detail) return '';
    const g = detail.goal != null && detail.goal !== '' ? detail.goal : (detail.diet_goal != null ? detail.diet_goal : (detail.dietGoal || ''));
    return String(g).trim();
  },

  // 获取饮食目标展示文案（枚举 + 快照全文）
  getDietGoalText(goal, otherGoal) {
    const g = goal != null ? String(goal).trim() : '';
    if (!g || g === '—') {
      return '未填写';
    }
    if (g === 'other' && otherGoal) {
      return String(otherGoal).trim();
    }
    const goalMap = {
      'weight_loss': '减脂',
      'weight_gain': '增重',
      'diabetes_control': '控糖',
      'health_maintain': '养生',
      'sports_nutrition': '运动营养',
      'pregnancy': '孕期营养'
    };
    return goalMap[g] || g;
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
  },

  // 初始化日期
  initDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    this.setData({
      selectedDate: formattedDate,
      selectedDateText: `${year}年${month}月${day}日`
    });
    // 计算营养比例
    this.calculateNutritionPercentage();
  },

  // 日期选择
  changeDate(e) {
    const selectedDate = e.detail.value;
    const dateObj = new Date(selectedDate);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    this.setData({
      selectedDate: selectedDate,
      selectedDateText: `${year}年${month}月${day}日`
    });
    // 根据选择的日期加载对应的数据
    this.loadDayData(selectedDate);
  },
  
  // 加载指定日期的数据
  loadDayData(selectedDate) {
    const currentPlan = this.data.currentPlan;
    if (!currentPlan || !currentPlan.plan_days) return;
    
    const normalizeDate = (d) => {
      if (!d) return '';
      const s = String(d).trim();
      // 兼容 "2026-04-22" / "2026/04/22" / "2026-04-22T00:00:00Z" 等格式
      const first10 = s.slice(0, 10).replace(/\//g, '-');
      const parsed = new Date(first10);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return first10;
    };
    const targetDate = normalizeDate(selectedDate);

    // 找到对应日期的天计划，支持 date 或 plan_date 字段
    let dayPlan = currentPlan.plan_days.find(day => {
      const dayDate = normalizeDate(day.date || day.plan_date);
      return dayDate === targetDate;
    });
    
    // 如果没有找到对应日期的计划，尝试根据开始时间计算第几天
    if (!dayPlan) {
      const start = normalizeDate(currentPlan.startDate) || normalizeDate(currentPlan.plan_days[0] && (currentPlan.plan_days[0].date || currentPlan.plan_days[0].plan_date));
      if (start) {
        const startDate = new Date(start);
        const target = new Date(targetDate);
        const dayDiff = Math.floor((target - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
        if (dayDiff > 0 && dayDiff <= currentPlan.plan_days.length) {
          dayPlan = currentPlan.plan_days[dayDiff - 1];
        }
      }
    }
    
    if (dayPlan) {
      // 更新页面显示的数据
      this.setData({
        currentPlan: {
          ...currentPlan,
          calories: dayPlan.calories,
          protein: dayPlan.protein,
          carbohydrate: dayPlan.carbohydrate,
          fat: dayPlan.fat,
          meals: dayPlan.meals.map(meal => ({
            type: meal.type,
            time: meal.time,
            calories: meal.calories,
            foods: meal.foods.map(food => ({
              name: food.name,
              amount: food.amount,
              calories: food.calories
            }))
          })),
          hasPlanForDate: true
        }
      });
      // 重新计算营养比例
      this.calculateNutritionPercentage();
    } else {
      // 没有对应日期的计划，显示提示
      this.setData({
        currentPlan: {
          ...currentPlan,
          calories: 0,
          protein: 0,
          carbohydrate: 0,
          fat: 0,
          meals: [],
          hasPlanForDate: false
        }
      });
      // 重新计算营养比例
      this.calculateNutritionPercentage();
      // 显示提示
      wx.showToast({
        title: '当日无饮食计划',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 计算营养比例
  calculateNutritionPercentage() {
    const currentPlan = this.data.currentPlan;
    if (!currentPlan) return;

    const proteinCalories = currentPlan.protein * 4;
    const carbohydrateCalories = currentPlan.carbohydrate * 4;
    const fatCalories = currentPlan.fat * 9;
    const totalCalories = proteinCalories + carbohydrateCalories + fatCalories;

    const proteinPercentage = totalCalories > 0 ? Math.round((proteinCalories / totalCalories) * 100) : 0;
    const carbohydratePercentage = totalCalories > 0 ? Math.round((carbohydrateCalories / totalCalories) * 100) : 0;
    const fatPercentage = totalCalories > 0 ? Math.round((fatCalories / totalCalories) * 100) : 0;

    this.setData({
      proteinPercentage: proteinPercentage,
      carbohydratePercentage: carbohydratePercentage,
      fatPercentage: fatPercentage
    });
  },

  // 记录饮食
  recordDiet() {
    console.log('记录饮食');
    // 存储tab参数，跳转到饮食记录页面
    wx.setStorageSync('nutritionTab', 'record');
    wx.switchTab({
      url: '/pages/user/diet/nutrition/index'
    });
  },

  // 查看详细对比
  viewDetailedComparison() {
    console.log('查看详细对比');
    // 存储tab参数，跳转到营养分析页面
    wx.setStorageSync('nutritionTab', 'analysis');
    wx.switchTab({
      url: '/pages/user/diet/nutrition/index'
    });
  },

  /** 跳转健康 Tab 并滚动到「营养评估」区块 */
  goToNutritionEvaluation() {
    wx.setStorageSync('healthScrollToEvaluation', true);
    wx.switchTab({
      url: '/pages/user/health/index'
    });
  },

  // 解除服务：删除当前膳食计划，并将关联服务申请置为 completed（后端）
  terminateService() {
    const plan = this.data.currentPlan;
    if (!plan || !plan.id) {
      wx.showToast({ title: '暂无膳食计划', icon: 'none' });
      return;
    }
    const me = (wx.getStorageSync('userInfo') || {}).user_id;
    if (plan.user_id && me && plan.user_id !== me) {
      wx.showModal({
        title: '无法解除服务',
        content: '当前膳食计划属于其他用户账号，与当前登录不一致（常见于切换账号后未刷新）。请重新进入本页或清除缓存后再试。',
        showCancel: false
      });
      return;
    }

    wx.showModal({
      title: '解除服务',
      content: '将删除当前膳食计划，并结束与当前规划师的服务关系（服务申请标记为已完成）。此操作不可撤销。',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        api.dietPlan.remove(plan.id)
          .then((apiRes) => {
            wx.hideLoading();
            if (apiRes.code === 200) {
              wx.removeStorageSync('currentDietPlan');
              wx.showToast({ title: '已解除服务', icon: 'success', duration: 1500 });
              setTimeout(() => {
                this.setData({ currentPlan: null, planStatus: 0 });
                this.loadData();
              }, 800);
            } else {
              wx.showToast({ title: apiRes.message || '解除失败', icon: 'none' });
            }
          })
          .catch((err) => {
            wx.hideLoading();
            console.error('解除服务失败:', err);
            const msg = (err && err.data && err.data.message) || (err && err.message) || '网络异常，请重试';
            wx.showToast({ title: msg, icon: 'none', duration: 3000 });
          });
      }
    });
  }
});