const api = require('../../../utils/api');

function formatEvalDateTime(iso) {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return String(iso);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

function nutritionStatusLabel(code) {
  const map = {
    normal: '总体正常',
    excess_energy: '能量过剩倾向',
    low_energy: '能量不足倾向',
    imbalanced: '膳食结构不均衡',
    unclear_data: '依据有限待复评'
  };
  return map[code] || code || '—';
}

function evaluationExpired(ev) {
  if (!ev || !ev.valid_until) {
    return false;
  }
  const end = new Date(ev.valid_until);
  const today = new Date();
  end.setHours(23, 59, 59, 999);
  today.setHours(0, 0, 0, 0);
  return end < today;
}

function activityLevelText(level) {
  const map = {
    sedentary: '久坐',
    lightly_active: '轻度',
    moderately_active: '中度',
    very_active: '高强度'
  };
  return map[level] || '—';
}

function displayGender(g) {
  if (g === 'male' || g === '男') return '男';
  if (g === 'female' || g === '女') return '女';
  return '';
}

function backendGender(g) {
  if (g === '男' || g === 'male') return 'male';
  if (g === '女' || g === 'female') return 'female';
  return '';
}

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
    evaluationId: '',
    historyList: [],
    healthMainTab: 'data',
    heUserFilter: 'all',
    heUserListDisplay: [],
    heEduLoading: false,
    heEduHint: ''
  },

  onLoad() {
    this.loadHealthData();
  },

  onShow() {
    const scrollEval = wx.getStorageSync('healthScrollToEvaluation');
    if (scrollEval) {
      wx.removeStorageSync('healthScrollToEvaluation');
    }
    const ui = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    this.loadHealthData();
    if (ui && token && this.data.healthMainTab === 'education') {
      this.loadEducationReaderList();
    }
    if (scrollEval) {
      setTimeout(() => {
        wx.pageScrollTo({
          selector: '#eval-section',
          duration: 300
        });
      }, 500);
    }
  },

  onPullDownRefresh() {
    const ui = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    if (ui && token && this.data.healthMainTab === 'education') {
      this.loadEducationReaderList().finally(() => wx.stopPullDownRefresh());
    } else {
      this.loadHealthData();
      wx.stopPullDownRefresh();
    }
  },

  switchHealthMainTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.healthMainTab) {
      return;
    }
    this.setData({ healthMainTab: tab });
    if (tab === 'education') {
      this.loadEducationReaderList();
    }
  },

  setHeUserFilter(e) {
    const v = e.currentTarget.dataset.v;
    if (!v || v === this.data.heUserFilter) {
      return;
    }
    this.setData({ heUserFilter: v });
    this.loadEducationReaderList();
  },

  formatHeReaderRow(item) {
    const s = item.updated_at ? String(item.updated_at) : '';
    const updatedAtText = s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
    const vis = item.visibility === 'assigned' ? 'assigned' : 'public';
    return Object.assign({}, item, {
      updated_at_text: updatedAtText,
      visibility: vis,
      visibilityLabel: vis === 'assigned' ? '指派' : '公开',
      dietitian_name: item.dietitian_name || ''
    });
  },

  loadEducationReaderList() {
    const ui = wx.getStorageSync('userInfo');
    if (!ui || ui.role_type !== 'user') {
      this.setData({
        heUserListDisplay: [],
        heEduLoading: false,
        heEduHint: '当前登录身份无法浏览健康教育，请使用普通用户账号。'
      });
      return Promise.resolve();
    }
    this.setData({ heEduLoading: true, heEduHint: '' });
    return api.healthEducation
      .readerList({ visibility: this.data.heUserFilter })
      .then((res) => {
        if (res.code === 200) {
          const raw = res.data || [];
          const heUserListDisplay = raw.map((x) => this.formatHeReaderRow(x));
          this.setData({ heUserListDisplay });
        } else {
          this.setData({
            heUserListDisplay: [],
            heEduHint: res.message || '加载失败'
          });
        }
      })
      .catch(() => {
        this.setData({
          heUserListDisplay: [],
          heEduHint: '网络错误，请稍后重试'
        });
      })
      .finally(() => {
        this.setData({ heEduLoading: false });
      });
  },

  openHeDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({
      url: '/pages/user/health/education-detail/index?id=' + encodeURIComponent(id)
    });
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
        isLoggedIn: false,
        evaluation: null,
        evaluationId: '',
        healthMainTab: 'data',
        heUserListDisplay: [],
        heEduHint: ''
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
    this.loadEvaluation();
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
            gender: displayGender(data.gender) || '男',
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
    api.healthData.getHistory().then(res => {
      if (res.code === 200 && Array.isArray(res.data)) {
        const historyList = res.data.slice(0, 8).map(item => ({
          id: item.history_id || item.data_id,
          date: item.snapshot_at ? String(item.snapshot_at).slice(0, 10) : (item.created_at ? String(item.created_at).slice(0, 10) : ''),
          height: item.height || 0,
          weight: item.weight || 0,
          bloodSugar: item.blood_sugar || 0,
          activityLevelText: activityLevelText(item.activity_level)
        }));
        this.setData({ historyList });
        wx.setStorageSync('healthHistory', historyList);
      } else {
        this.setData({ historyList: [] });
      }
    }).catch(err => {
      console.log('获取历史记录失败', err);
      const history = wx.getStorageSync('healthHistory') || [];
      this.setData({ historyList: history.slice(0, 8) });
    });
  },

  loadEvaluation() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ evaluation: null, evaluationId: '' });
      return;
    }
    api.evaluation
      .getUserEvaluations(10)
      .then((res) => {
        if (res.code !== 200 && res.code !== '200') {
          this.setData({ evaluation: null, evaluationId: '' });
          return;
        }
        const list = Array.isArray(res.data) ? res.data : [];
        if (!list.length) {
          this.setData({ evaluation: null, evaluationId: '' });
          return;
        }
        const ev = list[0];
        const expired = evaluationExpired(ev);
        const card = {
          status: expired ? 'expired' : 'completed',
          statusText: expired ? '已过期' : '最新',
          evalTime: formatEvalDateTime(ev.created_at),
          bmi: ev.bmi != null && ev.bmi !== '' ? String(ev.bmi) : '—',
          nutritionStatus: nutritionStatusLabel(ev.nutrition_status),
          suggestion: (ev.professional_conclusion || '—').slice(0, 220)
        };
        this.setData({
          evaluation: card,
          evaluationId: ev.evaluation_id || ''
        });
      })
      .catch(() => {
        this.setData({ evaluation: null, evaluationId: '' });
      });
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
      gender: backendGender(gender),
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
      gender: backendGender(this.data.healthData.gender),
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
    const id = this.data.evaluationId;
    if (!id) {
      wx.showToast({ title: '暂无专业营养评估', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/user/health/evaluation-detail/index?id=' + encodeURIComponent(id)
    });
  },

  gotoLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/login'
    });
  }
});