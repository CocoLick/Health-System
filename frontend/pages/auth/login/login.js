// login.js
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
    
    // 统一使用用户登录API
    const url = 'http://localhost:8000/api/auth/login';
    const requestData = { username, password };
    
    // 登录请求
    console.log('登录请求参数:', requestData);
    wx.request({
      url: url,
      method: 'POST',
      data: requestData,
      header: {
        'Content-Type': 'application/json'
      },
      success: (res) => {
        console.log('登录响应:', res);
        console.log('响应数据结构:', JSON.stringify(res.data, null, 2));
        if (res.data.code === 200) {
          // 登录成功，存储token和用户信息
          wx.setStorageSync('token', res.data.data.token);
          wx.setStorageSync('userInfo', res.data.data.user_info);
          
          this.setData({
            successMessage: '登录成功',
            errorMessage: ''
          });
          
          // 从响应中获取角色信息
          console.log('用户信息:', res.data.data.user_info);
          const roleType = res.data.data.user_info.role_type || 'user';
          console.log('登录角色:', roleType);
          console.log('角色类型:', typeof roleType);
          
          // 根据角色跳转到不同页面
          setTimeout(() => {
            console.log('开始跳转，角色:', roleType);
            if (roleType === 'admin') {
              console.log('跳转到管理员工作台');
              wx.reLaunch({
                url: '/pages/admin/dashboard/index'
              });
            } else if (roleType === 'dietitian') {
              console.log('跳转到营养师工作台');
              wx.reLaunch({
                url: '/pages/dietitian/dashboard/index'
              });
            } else {
              console.log('跳转到普通用户首页');
              wx.reLaunch({
                url: '/pages/home/index'
              });
            }
          }, 1000);
        } else {
          this.setData({
            errorMessage: res.data.message,
            successMessage: ''
          });
        }
      },
      fail: (err) => {
        console.log('登录失败:', err);
        this.setData({
          errorMessage: '登录失败，请检查网络连接',
          successMessage: ''
        });
      }
    });
  },
  
  navigateToRegister() {
    wx.redirectTo({
      url: '/pages/auth/register/register'
    });
  }
})