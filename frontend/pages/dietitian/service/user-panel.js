// dietitian/service/user-panel.js
const api = require('../../../utils/api');

function activityText(level) {
  const m = {
    sedentary: '久坐少动',
    lightly_active: '轻度活动',
    moderately_active: '中度活动',
    very_active: '高强度活动'
  };
  return m[level] || level || '—';
}

function dietGoalText(goal, other) {
  if (goal === 'other' && other) {
    return other;
  }
  const map = {
    weight_loss: '减脂',
    weight_gain: '增重',
    diabetes_control: '控糖',
    health_maintain: '养生',
    sports_nutrition: '运动营养',
    pregnancy: '孕期营养'
  };
  return map[goal] || goal || '—';
}

function pickServiceRequestForUser(rows, userId, preferredRequestId) {
  const uid = String(userId || '').trim();
  const list = Array.isArray(rows) ? rows : [];
  if (!uid) {
    return null;
  }
  if (preferredRequestId) {
    const byId = list.find((x) => String(x.request_id) === String(preferredRequestId));
    if (byId) {
      return byId;
    }
  }
  const mine = list.filter((x) => String(x.user_id) === uid);
  if (!mine.length) {
    return null;
  }
  const rank = (s) => {
    if (s === 'pending' || s === 'approved') {
      return 2;
    }
    if (s === 'completed') {
      return 1;
    }
    return 0;
  };
  mine.sort((a, b) => {
    const d = rank(b.status) - rank(a.status);
    if (d !== 0) {
      return d;
    }
    const ta = new Date(a.create_time || a.update_time || 0).getTime();
    const tb = new Date(b.create_time || b.update_time || 0).getTime();
    return tb - ta;
  });
  return mine[0];
}

function formatEvalTime(iso) {
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

function signedText(v, unit) {
  const n = Number(v || 0);
  if (!isFinite(n) || n === 0) {
    return `0${unit}`;
  }
  return `${n > 0 ? '+' : ''}${n}${unit}`;
}

function activityChangeText(fromLevel, toLevel, changed) {
  const fromText = activityText(fromLevel);
  const toText = activityText(toLevel);
  if (!changed) {
    return '无明显变化';
  }
  if (fromText !== '—' && toText !== '—') {
    return `${fromText} → ${toText}`;
  }
  if (fromText === '—' && toText !== '—') {
    return `当前：${toText}`;
  }
  if (fromText !== '—' && toText === '—') {
    return `由${fromText}调整`;
  }
  return '无明显变化';
}

Page({
  data: {
    userId: '',
    userInfo: {
      userId: '',
      username: '',
      usernameInitial: '',
      gender: '',
      age: 0,
      phone: '',
      hasProfile: false,
      hasEvaluation: false,
      hasPlan: false,
      evaluationTime: '',
      evaluationExpired: false,
      planTitle: '',
      planStatus: '',
      serviceRequestId: '',
      dietGoalText: '—',
      healthData: {
        height: 0,
        weight: 0,
        bloodPressure: '',
        bloodSugar: '',
        heartRate: 0,
        allergyHistory: '',
        activityLevelText: ''
      }
    },
    serviceHistory: [],
    changeSummary: null,
    _skipEvalSummaryOnFirstShow: true
  },

  onLoad(options) {
    const userId = options.userId || '';
    this.setData({ userId });
    if (!userId) {
      wx.showToast({ title: '缺少用户', icon: 'none' });
      return;
    }
    this.loadUserInfo(userId);
  },

  onShow() {
    const uid = this.data.userId;
    if (!uid) {
      return;
    }
    if (this.data._skipEvalSummaryOnFirstShow) {
      this.setData({ _skipEvalSummaryOnFirstShow: false });
      return;
    }
    this.loadEvaluationSummary(uid);
    this.loadChangeSummary(uid);
  },

  loadUserInfo(userId) {
    wx.showLoading({ title: '加载中...' });

    api.auth
      .getUserByID(userId)
      .then((res) => {
        if (res.code !== 200) {
          wx.hideLoading();
          wx.showToast({ title: '获取用户信息失败', icon: 'none' });
          return Promise.reject(new Error('user'));
        }
        const userData = res.data;
        const userInfo = {
          userId: userData.user_id,
          username: userData.username,
          usernameInitial: userData.username ? userData.username.charAt(0) : '?',
          gender: userData.gender || '',
          age: userData.age || 0,
          phone: userData.phone || '',
          hasProfile: false,
          hasEvaluation: false,
          hasPlan: false,
          evaluationTime: '',
          evaluationExpired: false,
          planTitle: '',
          planStatus: '',
          serviceRequestId: '',
          dietGoalText: '—',
          healthData: {
            height: 0,
            weight: 0,
            bloodPressure: '',
            bloodSugar: '',
            heartRate: 0,
            allergyHistory: '',
            activityLevelText: ''
          }
        };
        this.setData({ userInfo });

        return api.healthData.getUserHealthData(userId).then((healthRes) => {
          if (healthRes.code === 200 && healthRes.data) {
            userInfo.hasProfile = true;
            const d = healthRes.data;
            userInfo.healthData = {
              height: d.height || 0,
              weight: d.weight || 0,
              bloodPressure: d.blood_pressure || '',
              bloodSugar: d.blood_sugar != null ? String(d.blood_sugar) : '',
              heartRate: d.heart_rate || 0,
              allergyHistory: d.allergy_history || '',
              activityLevelText: activityText(d.activity_level)
            };
          }
          this.setData({ userInfo });
        });
      })
      .then(() => this.loadDietPlanInfo(userId))
      .then(() => this.loadServiceContext(userId))
      .then(() => this.loadEvaluationSummary(userId))
      .then(() => this.loadChangeSummary(userId))
      .then(() => {
        wx.hideLoading();
      })
      .catch((err) => {
        console.error('加载用户信息失败:', err);
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  loadServiceContext(userId) {
    return api.serviceRequest.getDietitianList().then((res) => {
      if (res.code !== 200 && res.code !== '200') {
        return;
      }
      const list = Array.isArray(res.data) ? res.data : [];
      const r = pickServiceRequestForUser(list, userId, '');
      if (!r) {
        this.setData({
          userInfo: {
            ...this.data.userInfo,
            serviceRequestId: '',
            dietGoalText: '—'
          }
        });
        return;
      }
      this.setData({
        userInfo: {
          ...this.data.userInfo,
          serviceRequestId: r.request_id,
          dietGoalText: dietGoalText(r.diet_goal, r.other_goal)
        }
      });
    });
  },

  loadEvaluationSummary(userId) {
    return api.evaluation.listByUser(userId, 5).then((res) => {
      if ((res.code !== 200 && res.code !== '200') || !Array.isArray(res.data)) {
        return;
      }
      const list = res.data;
      let hasEvaluation = list.length > 0;
      let evaluationTime = '';
      let evaluationExpired = false;
      if (hasEvaluation) {
        const latest = list[0];
        evaluationTime = formatEvalTime(latest.created_at);
        if (latest.valid_until) {
          const end = new Date(latest.valid_until);
          const today = new Date();
          end.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);
          evaluationExpired = end < today;
        }
      }
      this.setData({
        userInfo: {
          ...this.data.userInfo,
          hasEvaluation,
          evaluationTime,
          evaluationExpired
        }
      });
    });
  },

  loadDietPlanInfo(userId) {
    return api.dietPlan
      .getUserPlans({ user_id: userId })
      .then((res) => {
        if (res.code === 200 && res.data && res.data.length > 0) {
          const plans = res.data.sort((a, b) => new Date(b.update_time) - new Date(a.update_time));
          const latestPlan = plans[0];
          const planStatusText = {
            draft: '📝 草稿',
            published: '✅ 已发布'
          };
          this.setData({
            userInfo: {
              ...this.data.userInfo,
              hasPlan: true,
              planTitle: latestPlan.title || '未命名计划',
              planStatus: planStatusText[latestPlan.status] || '❓ 未知状态'
            }
          });
        } else {
          this.setData({
            userInfo: {
              ...this.data.userInfo,
              hasPlan: false,
              planTitle: '',
              planStatus: '❌ 无计划'
            }
          });
        }
      })
      .catch(() => {
        this.setData({
          userInfo: {
            ...this.data.userInfo,
            hasPlan: false,
            planTitle: '',
            planStatus: '❌ 无计划'
          }
        });
      });
  },

  loadChangeSummary(userId) {
    return api.healthData.getUserChangeSummary(userId)
      .then((res) => {
        if (res.code !== 200 || !res.data) {
          this.setData({ changeSummary: null });
          return;
        }
        const delta = res.data.delta || {};
        this.setData({
          changeSummary: {
            weightDeltaText: signedText(delta.weight, 'kg'),
            bmiDeltaText: signedText(delta.bmi, ''),
            bloodSugarDeltaText: signedText(delta.blood_sugar, 'mmol/L'),
            activityChanged: !!delta.activity_changed,
            activityFrom: delta.activity_from || '—',
            activityTo: delta.activity_to || '—',
            activityFromText: activityText(delta.activity_from),
            activityToText: activityText(delta.activity_to),
            activityChangeText: activityChangeText(delta.activity_from, delta.activity_to, !!delta.activity_changed),
            insufficientSample: !!res.data.insufficient_sample,
            insufficientHint: res.data.insufficient_hint || '样本不足（至少2次记录）'
          }
        });
      })
      .catch(() => {
        this.setData({ changeSummary: null });
      });
  },

  openHealthEducation() {
    const uid = (this.data.userId || '').trim();
    if (!uid) {
      return;
    }
    wx.navigateTo({
      url: '/pages/dietitian/health-education/edit?userId=' + encodeURIComponent(uid)
    });
  },

  goBack() {
    wx.navigateBack();
  },

  doEvaluation() {
    const { userId, userInfo } = this.data;
    let url =
      '/pages/dietitian/service/evaluation-center/index?userId=' +
      encodeURIComponent(userId) +
      '&username=' +
      encodeURIComponent(userInfo.username || '');
    if (userInfo.serviceRequestId) {
      url += '&serviceRequestId=' + encodeURIComponent(userInfo.serviceRequestId);
    }
    wx.navigateTo({ url });
  },

  managePlan() {
    wx.navigateTo({
      url: '/pages/dietitian/service/diet-plan/index?userId=' + this.data.userId
    });
  }
});
