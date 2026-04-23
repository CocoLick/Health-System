const api = require('../../../../utils/api');

Page({
  data: {
    mode: 'dietitian',
    dietitianId: '',
    dietitianName: '',
    serviceType: 'diet_plan',
    dietGoal: 'weight_loss',
    formData: {
      disease: '',
      allergy: '',
      demand: '',
      otherGoal: ''
    }
  },

  onLoad(options) {
    const mode = options.mode === 'ai' ? 'ai' : 'dietitian';
    if (options.dietitianId) {
      this.setData({
        dietitianId: options.dietitianId,
        dietitianName: options.dietitianName || '规划师'
      });
      return;
    }
    if (mode === 'ai') {
      this.setData({
        mode: 'ai',
        dietitianName: '系统智能助手'
      });
    }
  },

  selectServiceType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ serviceType: type });
  },

  selectGoal(e) {
    const goal = e.currentTarget.dataset.goal;
    this.setData({ dietGoal: goal });
  },

  bindDiseaseInput(e) {
    this.setData({ 'formData.disease': e.detail.value });
  },

  bindAllergyInput(e) {
    this.setData({ 'formData.allergy': e.detail.value });
  },

  bindDemandInput(e) {
    this.setData({ 'formData.demand': e.detail.value });
  },

  bindOtherGoalInput(e) {
    this.setData({ 'formData.otherGoal': e.detail.value });
  },

  submitRequest() {
    if (this.data.mode === 'ai') {
      this.submitAIRequest();
      return;
    }

    // 验证其他目标是否填写
    if (this.data.dietGoal === 'other' && !this.data.formData.otherGoal) {
      wx.showToast({ title: '请输入您的饮食目标', icon: 'none' });
      return;
    }

    // 显示加载动画
    wx.showLoading({ title: '检查中...' });

    // 先检查用户是否已有待处理或已通过的服务申请
    api.serviceRequest.getList()
      .then(res => {
        wx.hideLoading();
        if (res.code === 200) {
          const requests = res.data || [];
          if (requests.length > 0) {
            // 按创建时间排序，获取最新的请求
            requests.sort((a, b) => {
              const dateA = a.create_time ? new Date(a.create_time) : new Date(0);
              const dateB = b.create_time ? new Date(b.create_time) : new Date(0);
              return dateB - dateA;
            });
            const latestRequest = requests[0];
            // 检查最新申请的状态
            if (latestRequest.status === 'pending') {
              wx.showModal({
                title: '无法提交申请',
                content: '您有一条正在处理的服务申请（状态：待处理），暂无法发起新申请。如需申请新的规划师服务，请先取消当前申请。',
                showCancel: true,
                confirmText: '查看申请',
                cancelText: '好的',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.redirectTo({
                      url: '/pages/user/dietitian/request-detail/index?id=' + latestRequest.request_id
                    });
                  }
                }
              });
              return;
            }
            if (latestRequest.status === 'approved') {
              wx.showModal({
                title: '无法提交申请',
                content: '您有一条已通过的服务申请（状态：已通过），该服务可能正在进行中。如需申请新的规划师服务，请等待当前服务完成或联系当前规划师。',
                showCancel: true,
                confirmText: '查看申请',
                cancelText: '好的',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.redirectTo({
                      url: '/pages/user/dietitian/request-detail/index?id=' + latestRequest.request_id
                    });
                  }
                }
              });
              return;
            }
          }
          // 没有待处理或已通过的申请，继续提交
          this.doSubmit();
        } else {
          // API调用失败，但仍然允许提交
          this.doSubmit();
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('检查服务请求失败:', err);
        // 网络错误时仍然允许提交
        this.doSubmit();
      });
  },

  submitAIRequest() {
    if (this.data.dietGoal === 'other' && !this.data.formData.otherGoal) {
      wx.showToast({ title: '请输入您的饮食目标', icon: 'none' });
      return;
    }

    const healthProfile = [
      this.data.formData.disease ? `疾病情况：${this.data.formData.disease}` : '',
      this.data.formData.allergy ? `过敏食物：${this.data.formData.allergy}` : ''
    ].filter(Boolean).join('；');

    const additionalRequirements = this.data.formData.demand || '';
    const goalText = this.getGoalText(this.data.dietGoal, this.data.formData.otherGoal);

    wx.showLoading({ title: '生成中...', mask: true });
    api.dietPlan.generateAIPlan({
      plan_title: `智能推荐膳食计划（${goalText}）`,
      cycle_days: 7,
      diet_goal: this.data.dietGoal,
      other_goal: this.data.formData.otherGoal || '',
      health_profile: healthProfile || '无额外补充',
      additional_requirements: additionalRequirements
    })
      .then((res) => {
        wx.hideLoading();
        if (res.code !== 200 || !res.data) {
          wx.showToast({ title: (res && res.message) || '生成失败', icon: 'none' });
          return;
        }
        const plan = this.buildCurrentPlanFromDetail(res.data);
        wx.setStorageSync('currentDietPlan', plan);
        wx.showToast({
          title: '生成成功，正在跳转...',
          icon: 'success',
          duration: 800
        });
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/user/diet/diet-plan/index',
            fail: () => {
              wx.reLaunch({ url: '/pages/user/diet/diet-plan/index' });
            }
          });
        }, 650);
      })
      .catch((err) => {
        wx.hideLoading();
        const msg = (err && err.data && err.data.message) || err.errMsg || '网络错误，请稍后重试';
        wx.showToast({ title: msg, icon: 'none', duration: 3000 });
      });
  },

  buildCurrentPlanFromDetail(detailData) {
    const day0 = detailData.plan_days && detailData.plan_days.length > 0 ? detailData.plan_days[0] : null;
    const rawGoal = detailData.goal != null ? detailData.goal : (detailData.diet_goal || '');
    const goal = String(rawGoal || '').trim();
    return {
      id: detailData.id,
      user_id: detailData.user_id,
      dietitian_id: detailData.dietitian_id,
      title: detailData.title,
      source: detailData.source || 'ai',
      dietitianName: detailData.dietitian_name || '系统智能',
      status: detailData.status,
      generationSource: detailData.generation_source || '',
      goal,
      goalText: this.getGoalText(goal, detailData.other_goal || this.data.formData.otherGoal),
      startDate: day0 ? (day0.date || day0.plan_date || '') : '',
      calories: day0 ? day0.calories : 0,
      protein: day0 ? day0.protein : 0,
      carbohydrate: day0 ? day0.carbohydrate : 0,
      fat: day0 ? day0.fat : 0,
      createTime: detailData.create_time || detailData.published_at || new Date().toLocaleString(),
      meals: day0 && day0.meals ? day0.meals.map(meal => ({
        type: meal.type,
        time: meal.time,
        calories: meal.calories,
        foods: meal.foods ? meal.foods.map(food => ({
          name: food.name,
          amount: food.amount,
          calories: food.calories
        })) : []
      })) : [],
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
  },

  getGoalText(goal, otherGoal) {
    if (goal === 'other') return otherGoal || '其他';
    const map = {
      weight_loss: '减脂',
      weight_gain: '增重',
      diabetes_control: '控糖',
      health_maintain: '养生',
      sports_nutrition: '运动营养',
      pregnancy: '孕期营养'
    };
    return map[goal] || '智能匹配';
  },

  doSubmit() {
    const requestData = {
      dietitian_id: this.data.dietitianId,
      service_type: this.data.serviceType,
      diet_goal: this.data.dietGoal,
      other_goal: this.data.formData.otherGoal,
      health_data: this.data.formData
    };

    console.log('提交服务请求:', requestData);

    // 显示加载动画
    wx.showLoading({ title: '提交中...' });

    api.serviceRequest.submit(requestData)
      .then((res) => {
        wx.hideLoading();
        if (res.code === 200 && res.data) {
          const requestId = res.data.request_id || res.data.RequestID || res.data.requestId;
          if (!requestId) {
            wx.showModal({
              title: '提交成功',
              content: '您的服务请求已提交，请等待规划师响应',
              showCancel: false,
              success: () => {
                wx.redirectTo({
                  url: '/pages/user/diet/diet-plan/index'
                });
              }
            });
            return;
          }
          wx.showModal({
            title: '提交成功',
            content: '您的服务请求已提交，请等待规划师响应',
            showCancel: false,
            success: () => {
              wx.redirectTo({
                url: '/pages/user/dietitian/request-detail/index?id=' + requestId
              });
            }
          });
          return;
        }
        wx.showToast({ title: '提交失败: ' + ((res && res.message) || '未知错误'), icon: 'none' });
      })
      .catch((err) => {
        wx.hideLoading();
        const msg = (err && err.data && err.data.message) || err.errMsg || '网络错误，请稍后重试';
        wx.showToast({ title: msg, icon: 'none' });
      });
  }
});