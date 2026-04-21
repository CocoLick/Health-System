// dietitian/service/user-panel.js
const api = require('../../../utils/api');
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
      healthData: {
        height: 0,
        weight: 0,
        bloodPressure: '',
        bloodSugar: '',
        heartRate: 0,
        allergyHistory: ''
      }
    },
    serviceHistory: [
      {
        icon: '📋',
        title: '制定了减脂膳食计划',
        time: '2026-04-10 14:30'
      },
      {
        icon: '🔍',
        title: '完成了营养评估',
        time: '2026-03-15 10:00'
      },
      {
        icon: '👤',
        title: '查看了健康档案',
        time: '2026-03-15 09:30'
      }
    ]
  },

  onLoad(options) {
    const userId = options.userId || 'U001';
    this.setData({
      userId: userId
    });
    this.loadUserInfo(userId);
  },

  loadUserInfo(userId) {
    console.log('加载用户信息', userId);
    wx.showLoading({ title: '加载中...' });
    
    // 加载用户基本信息
    api.auth.getUserByID(userId)
      .then(res => {
        console.log('用户信息API响应:', res);
        if (res.code === 200) {
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
            healthData: {
              height: 0,
              weight: 0,
              bloodPressure: '',
              bloodSugar: '',
              heartRate: 0,
              allergyHistory: ''
            }
          };
          
          // 加载健康档案（使用规划师专用接口）
          return api.healthData.getUserHealthData(userId)
            .then(healthRes => {
              console.log('健康档案API响应:', healthRes);
              if (healthRes.code === 200 && healthRes.data) {
                userInfo.hasProfile = true;
                userInfo.healthData = {
                  height: healthRes.data.height || 0,
                  weight: healthRes.data.weight || 0,
                  bloodPressure: healthRes.data.blood_pressure || '',
                  bloodSugar: healthRes.data.blood_sugar || '',
                  heartRate: healthRes.data.heart_rate || 0,
                  allergyHistory: healthRes.data.allergy_history || ''
                };
              }
              
              // 更新页面数据
              this.setData({ userInfo });
              wx.hideLoading();
            });
        } else {
          wx.hideLoading();
          wx.showToast({ title: '获取用户信息失败', icon: 'none' });
        }
      })
      .then(() => {
        // 加载膳食计划信息
        return this.loadDietPlanInfo(userId);
      })
      .catch(err => {
        console.error('加载用户信息失败:', err);
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  // 加载膳食计划信息
  loadDietPlanInfo(userId) {
    console.log('加载膳食计划信息', userId);
    
    return api.dietPlan.getUserPlans(userId)
      .then(res => {
        console.log('膳食计划API响应:', res);
        if (res.code === 200 && res.data && res.data.length > 0) {
          // 按更新时间排序，取最新的计划
          const plans = res.data.sort((a, b) => new Date(b.update_time) - new Date(a.update_time));
          const latestPlan = plans[0];
          
          console.log('最新计划数据:', latestPlan);
          
          const planStatusText = {
            'draft': '📝 草稿',
            'published': '✅ 已发布'
          };
          
          this.setData({
            userInfo: {
              ...this.data.userInfo,
              hasPlan: true,
              planTitle: latestPlan.title || '未命名计划',
              planStatus: planStatusText[latestPlan.status] || '❓ 未知状态'
            }
          });
          console.log('已设置膳食计划信息:', this.data.userInfo.planTitle, this.data.userInfo.planStatus);
        } else {
          this.setData({
            userInfo: {
              ...this.data.userInfo,
              hasPlan: false,
              planTitle: '',
              planStatus: '❌ 无计划'
            }
          });
          console.log('用户没有膳食计划');
        }
      })
      .catch(err => {
        console.error('加载膳食计划信息失败:', err);
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

  goBack() {
    wx.navigateBack();
  },

  viewProfile() {
    wx.showToast({
      title: '查看/编辑健康档案',
      icon: 'none'
    });
  },

  doEvaluation() {
    wx.showToast({
      title: '进行营养评估',
      icon: 'none'
    });
  },

  managePlan() {
    wx.navigateTo({
      url: '/pages/dietitian/service/diet-plan/index?userId=' + this.data.userId
    });
  },

  startServiceWizard() {
    wx.showToast({
      title: '开始服务向导',
      icon: 'none'
    });
  }
})