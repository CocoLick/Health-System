// login.js
const api = require('../../../utils/api');

Page({
  data: {
    username: '',
    password: '',
    errorMessage: '',
    successMessage: '',
    showPassword: false
  },
  
  bindUsername(e) {
    this.setData({
      username: e.detail.value
    });
  },
  
  bindPassword(e) {
    this.setData({
      password: e.detail.value
    });
  },

  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },
  
  handleLogin() {
    const { username, password } = this.data;
    
    if (!username || !password) {
      this.setData({
        errorMessage: '请输入用户名和密码',
        successMessage: ''
      });
      return;
    }
    
    console.log('登录请求参数:', { username, password });
    
    api.auth.login({ username, password })
    .then(res => {
      console.log('登录响应:', res);
      console.log('响应数据结构:', JSON.stringify(res, null, 2));
      if (res.code === 200) {
        console.log('登录成功，设置token和userInfo');
        wx.setStorageSync('token', res.data.token);
        wx.setStorageSync('userInfo', res.data.user_info);
        
        console.log('存储的token:', wx.getStorageSync('token'));
        console.log('存储的userInfo:', wx.getStorageSync('userInfo'));
        
        this.setData({
          successMessage: '登录成功',
          errorMessage: ''
        });
        
        const roleType = res.data.user_info.role_type || 'user';
        console.log('登录角色:', roleType);
        
        setTimeout(() => {
          if (roleType === 'admin') {
            wx.reLaunch({
              url: '/pages/admin/dashboard/index'
            });
          } else if (roleType === 'dietitian') {
            wx.reLaunch({
              url: '/pages/dietitian/dashboard/index'
            });
          } else {
            wx.reLaunch({
              url: '/pages/home/index'
            });
          }
        }, 1000);
      } else {
        this.setData({
          errorMessage: res.message,
          successMessage: ''
        });
      }
    })
    .catch(err => {
      console.log('登录失败:', err);
      let errorMsg = '登录失败，请稍后重试';
      if (err && err.data && err.data.message) {
        errorMsg = err.data.message;
      }
      this.setData({
        errorMessage: errorMsg,
        successMessage: ''
      });
    });
  },
  
  navigateToRegister() {
    wx.redirectTo({
      url: '/pages/auth/register/register'
    });
  }
})