const api = require('../../../utils/api');

Page({
  data: {
    hasHealthData: false,
    isLoggedIn: false,
    showBasicInfoModal: false,
    showHealthMetricsModal: false,
    isEditing: false,
    healthData: {
      gender: '男',
      age: 30,
      height: '',
      weight: '',
      heartRate: '',
      bloodPressure: '',
      bloodSugar: '',
      allergyHistory: '',
      activityLevel: 'moderately_active',
      nutritionGoal: 'maintain'
    },
    formData: {
      gender: '男',
      age: 30,
      height: '',
      weight: '',
      heartRate: '',
      bloodPressure: '',
      bloodSugar: '',
      allergyHistory: '',
      activityLevel: 'moderately_active',
      nutritionGoal: 'maintain'
    },
    activityLevelRange: ['久坐', '轻度', '中度', '高强度'],
    nutritionGoalRange: ['减重', '维持', '健康增重'],
    activityLevelIndex: 2, // 0: sedentary, 1: lightly_active, 2: moderately_active, 3: very_active
    nutritionGoalIndex: 1, // 0: lose_weight, 1: maintain, 2: healthy_gain
    evaluation: null,
    historyList: []
  },

  onLoad() {
    this.loadHealthData();
  },

  onShow() {
    this.loadHealthData();
  },

  onPullDownRefresh() {
    this.loadHealthData();
    wx.stopPullDownRefresh();
  },

  loadHealthData() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    
    console.log('loadHealthData - userInfo:', userInfo);
    console.log('loadHealthData - token:', token);
    console.log('loadHealthData - hasHealthData:', this.data.hasHealthData);
    
    if (!userInfo || !token) {
      console.log('loadHealthData - 未登录');
      this.setData({
        hasHealthData: false,
        isLoggedIn: false
      });
      return;
    }
    
    console.log('loadHealthData - 已登录');
    this.setData({
      isLoggedIn: true
    });
    
    if (userInfo) {
      this.setData({
        'healthData.gender': userInfo.gender || '',
        'healthData.age': userInfo.age || ''
      });
    }

    this.loadLatestHealthData();
    this.loadHistory();
  },

  loadLatestHealthData() {
    wx.showLoading({ title: '加载中...' });
    api.healthData.getLatest().then(res => {
      wx.hideLoading();
      if (res.code === 200 && res.data) {
        const data = res.data;
        const activityLevel = data.activity_level || 'moderately_active';
        const nutritionGoal = data.nutrition_goal || 'maintain';
        
        // 设置活动水平索引
        let activityLevelIndex = 2; // 默认中度
        switch(activityLevel) {
          case 'sedentary':
            activityLevelIndex = 0;
            break;
          case 'lightly_active':
            activityLevelIndex = 1;
            break;
          case 'moderately_active':
            activityLevelIndex = 2;
            break;
          case 'very_active':
            activityLevelIndex = 3;
            break;
        }
        
        // 设置营养目标索引
        let nutritionGoalIndex = 1; // 默认维持
        switch(nutritionGoal) {
          case 'lose_weight':
            nutritionGoalIndex = 0;
            break;
          case 'maintain':
            nutritionGoalIndex = 1;
            break;
          case 'healthy_gain':
            nutritionGoalIndex = 2;
            break;
        }
        
        this.setData({
          healthData: {
            data_id: data.data_id || '',
            gender: data.gender === 'male' ? '男' : '女',
            age: data.age || 30,
            height: data.height || '',
            weight: data.weight || '',
            heartRate: data.heart_rate || '',
            bloodPressure: data.blood_pressure || '',
            bloodSugar: data.blood_sugar || '',
            allergyHistory: data.allergy_history || '',
            activityLevel: activityLevel,
            nutritionGoal: nutritionGoal
          },
          activityLevelIndex: activityLevelIndex,
          nutritionGoalIndex: nutritionGoalIndex,
          hasHealthData: true
        });
        wx.setStorageSync('cachedHealthData', this.data.healthData);
      } else {
        console.log('暂无健康数据，设置hasHealthData为false');
        this.setData({
          hasHealthData: false
        });
        const cachedHealthData = wx.getStorageSync('cachedHealthData');
        if (cachedHealthData) {
          this.setData({
            healthData: { ...this.data.healthData, ...cachedHealthData },
            hasHealthData: true
          });
        }
      }
    }).catch(err => {
      wx.hideLoading();
      console.log('获取健康数据失败', err);
      console.log('错误状态码:', err.statusCode);
      console.log('错误数据:', err.data);
      
      // 如果是400错误（暂无健康数据），这是正常的
      if (err.statusCode === 400 && err.data && err.data.message === '暂无健康数据') {
        console.log('暂无健康数据，设置hasHealthData为false');
        this.setData({
          hasHealthData: false
        });
      } else {
        // 其他错误，尝试使用缓存数据
        const cachedHealthData = wx.getStorageSync('cachedHealthData');
        if (cachedHealthData) {
          this.setData({
            healthData: { ...this.data.healthData, ...cachedHealthData },
            hasHealthData: true
          });
        } else {
          this.setData({
            hasHealthData: false
          });
        }
      }
    });
  },

  loadHistory() {
    api.healthData.getList().then(res => {
      if (res.code === 200 && res.data) {
        const historyList = res.data.slice(0, 5).map(item => ({
          id: item.data_id,
          date: item.created_at ? item.created_at.split('T')[0] : '',
          height: item.height,
          weight: item.weight
        }));
        this.setData({ historyList });
        wx.setStorageSync('healthHistory', historyList);
      } else {
        console.log('暂无历史记录');
        this.setData({ historyList: [] });
      }
    }).catch(err => {
      console.log('获取历史记录失败', err);
      const history = wx.getStorageSync('healthHistory') || [];
      this.setData({ historyList: history.slice(0, 5) });
    });
  },

  loadEvaluation() {
    const evaluation = wx.getStorageSync('cachedEvaluation');
    if (evaluation) {
      this.setData({ evaluation });
    } else {
      this.setData({
        evaluation: {
          status: 'pending',
          statusText: '待评估',
          evalTime: '',
          bmi: '--',
          nutritionStatus: '--',
          suggestion: '请先完善健康数据'
        }
      });
    }
  },

  editBasicInfo() {
    this.setData({
      showBasicInfoModal: true,
      isEditing: this.data.hasHealthData,
      formData: { ...this.data.healthData }
    });
  },

  hideBasicInfoModal() {
    this.setData({ showBasicInfoModal: false });
  },

  editHealthMetrics() {
    this.setData({
      showHealthMetricsModal: true,
      isEditing: this.data.hasHealthData,
      formData: { ...this.data.healthData }
    });
  },

  hideHealthMetricsModal() {
    this.setData({ showHealthMetricsModal: false });
  },

  bindHeightInput(e) {
    this.setData({ 'formData.height': e.detail.value });
  },

  bindWeightInput(e) {
    this.setData({ 'formData.weight': e.detail.value });
  },

  bindHeartRateInput(e) {
    this.setData({ 'formData.heartRate': e.detail.value });
  },

  bindBloodPressureInput(e) {
    this.setData({ 'formData.bloodPressure': e.detail.value });
  },

  bindBloodSugarInput(e) {
    this.setData({ 'formData.bloodSugar': e.detail.value });
  },

  bindAllergyInput(e) {
    this.setData({ 'formData.allergyHistory': e.detail.value });
  },

  bindGenderChange(e) {
    this.setData({ 'formData.gender': e.detail.value });
  },

  bindAgeInput(e) {
    this.setData({ 'formData.age': e.detail.value });
  },

  toggleGender() {
    const newGender = this.data.formData.gender === '男' ? '女' : '男';
    this.setData({ 'formData.gender': newGender });
  },

  changeActivityLevel(e) {
    const index = e.detail.value;
    const activityLevels = ['sedentary', 'lightly_active', 'moderately_active', 'very_active'];
    const activityLevel = activityLevels[index];
    this.setData({ 
      activityLevelIndex: index,
      'formData.activityLevel': activityLevel 
    });
  },

  changeNutritionGoal(e) {
    const index = e.detail.value;
    const nutritionGoals = ['lose_weight', 'maintain', 'healthy_gain'];
    const nutritionGoal = nutritionGoals[index];
    this.setData({ 
      nutritionGoalIndex: index,
      'formData.nutritionGoal': nutritionGoal 
    });
  },

  saveBasicInfo() {
    const { gender, age, activityLevel, nutritionGoal } = this.data.formData;

    if (!gender) {
      wx.showToast({ title: '请选择性别', icon: 'none' });
      return;
    }
    if (!age) {
      wx.showToast({ title: '请输入年龄', icon: 'none' });
      return;
    }

    // 构建完整的请求数据，包含所有字段
    const requestData = {
      ...this.data.healthData,
      gender: gender === '男' ? 'male' : 'female',
      age: parseInt(age),
      activity_level: activityLevel,
      nutrition_goal: nutritionGoal
    };

    // 移除不需要的字段
    delete requestData.data_id;

    wx.showLoading({ title: '保存中...' });

    if (this.data.isEditing) {
      api.healthData.update(this.data.healthData.data_id || '', requestData).then(res => {
        wx.hideLoading();
        if (res.code === 200) {
          this.handleBasicInfoSaveSuccess();
        } else {
          wx.showToast({ title: res.message || '更新失败', icon: 'none' });
        }
      }).catch(err => {
        wx.hideLoading();
        console.log('更新失败', err);
        wx.showToast({ title: '更新失败', icon: 'none' });
      });
    } else {
      api.healthData.submit(requestData).then(res => {
        wx.hideLoading();
        if (res.code === 200) {
          this.handleBasicInfoSaveSuccess();
        } else {
          wx.showToast({ title: res.message || '保存失败', icon: 'none' });
        }
      }).catch(err => {
        wx.hideLoading();
        console.log('保存失败', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
    }
  },

  saveHealthMetrics() {
    const { height, weight, heartRate, bloodPressure, bloodSugar, allergyHistory } = this.data.formData;

    if (!height) {
      wx.showToast({ title: '请输入身高', icon: 'none' });
      return;
    }
    if (!weight) {
      wx.showToast({ title: '请输入体重', icon: 'none' });
      return;
    }

    // 构建完整的请求数据，包含所有字段
    const requestData = {
      ...this.data.healthData,
      height: parseFloat(height),
      weight: parseFloat(weight),
      heart_rate: parseInt(heartRate) || 0,
      blood_pressure: bloodPressure || '',
      blood_sugar: parseFloat(bloodSugar) || 0,
      allergy_history: allergyHistory || ''
    };

    // 移除不需要的字段
    delete requestData.data_id;

    wx.showLoading({ title: '保存中...' });

    if (this.data.isEditing) {
      api.healthData.update(this.data.healthData.data_id || '', requestData).then(res => {
        wx.hideLoading();
        if (res.code === 200) {
          this.handleHealthMetricsSaveSuccess();
        } else {
          wx.showToast({ title: res.message || '更新失败', icon: 'none' });
        }
      }).catch(err => {
        wx.hideLoading();
        console.log('更新失败', err);
        wx.showToast({ title: '更新失败', icon: 'none' });
      });
    } else {
      api.healthData.submit(requestData).then(res => {
        wx.hideLoading();
        if (res.code === 200) {
          this.handleHealthMetricsSaveSuccess();
        } else {
          wx.showToast({ title: res.message || '保存失败', icon: 'none' });
        }
      }).catch(err => {
        wx.hideLoading();
        console.log('保存失败', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
    }
  },

  handleBasicInfoSaveSuccess() {
    const healthData = {
      ...this.data.healthData,
      ...this.data.formData
    };

    wx.setStorageSync('cachedHealthData', healthData);

    this.setData({
      healthData,
      hasHealthData: true,
      showBasicInfoModal: false
    });

    wx.showToast({ title: '保存成功', icon: 'success' });

    setTimeout(() => {
      this.loadHealthData();
    }, 1000);
  },

  handleHealthMetricsSaveSuccess() {
    const healthData = {
      ...this.data.healthData,
      ...this.data.formData
    };

    wx.setStorageSync('cachedHealthData', healthData);

    const history = wx.getStorageSync('healthHistory') || [];
    history.unshift({
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      height: this.data.formData.height,
      weight: this.data.formData.weight
    });
    wx.setStorageSync('healthHistory', history.slice(0, 30));

    this.setData({
      healthData,
      hasHealthData: true,
      showHealthMetricsModal: false
    });

    wx.showToast({ title: '保存成功', icon: 'success' });

    setTimeout(() => {
      this.loadHealthData();
    }, 1000);
  },

  viewEvaluation() {
    if (!this.data.hasHealthData) {
      wx.showToast({ title: '请先录入健康数据', icon: 'none' });
      return;
    }

    const { height, weight } = this.data.healthData;
    if (height && weight) {
      const heightM = height / 100;
      const bmi = (weight / (heightM * heightM)).toFixed(1);
      let status = '';
      let suggestion = '';

      if (bmi < 18.5) {
        status = '偏瘦';
        suggestion = '建议增加营养摄入，适当增重';
      } else if (bmi < 24) {
        status = '正常';
        suggestion = '继续保持良好的饮食习惯';
      } else if (bmi < 28) {
        status = '偏胖';
        suggestion = '建议控制饮食，增加运动';
      } else {
        status = '肥胖';
        suggestion = '建议制定减重计划，咨询专业营养师';
      }

      const evaluation = {
        status: 'completed',
        statusText: '已完成',
        evalTime: new Date().toLocaleDateString(),
        bmi: bmi,
        nutritionStatus: status,
        suggestion: suggestion
      };

      wx.setStorageSync('cachedEvaluation', evaluation);
      this.setData({ evaluation });
    }

    wx.showToast({ title: '查看评估详情', icon: 'none' });
  },

  gotoLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/login'
    });
  }
});