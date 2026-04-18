// register.js
Page({
  data: {
    username: '',
    password: '',
    phone: '',
    gender: '',
    age: '',
    email: '',
    errorMessage: '',
    successMessage: '',
    showPassword: false,
    genderOptions: ['男', '女', '其他'],
    genderIndex: 0,
    ageOptions: Array.from({ length: 100 }, (_, i) => (i + 1).toString()),
    ageIndex: 0
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

  bindPhone(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  bindGender(e) {
    this.setData({
      gender: e.detail.value
    });
  },

  bindAge(e) {
    this.setData({
      age: e.detail.value
    });
  },

  bindEmail(e) {
    this.setData({
      email: e.detail.value
    });
  },

  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },

  bindGenderChange(e) {
    const index = e.detail.value;
    this.setData({
      genderIndex: index,
      gender: this.data.genderOptions[index]
    });
  },

  bindAgeChange(e) {
    const index = e.detail.value;
    this.setData({
      ageIndex: index,
      age: this.data.ageOptions[index]
    });
  },

  handleRegister() {
    const { username, password, phone, gender, age, email } = this.data;

    // 表单验证
    if (!username) {
      this.setData({ errorMessage: '请输入用户名', successMessage: '' });
      return;
    }
    if (!password || password.length < 6) {
      this.setData({ errorMessage: '密码长度至少6位', successMessage: '' });
      return;
    }
    if (!phone) {
      this.setData({ errorMessage: '请输入手机号', successMessage: '' });
      return;
    }
    if (!gender) {
      this.setData({ errorMessage: '请选择性别', successMessage: '' });
      return;
    }
    if (!age || isNaN(age) || age <= 0) {
      this.setData({ errorMessage: '请选择有效的年龄', successMessage: '' });
      return;
    }
    if (!email) {
      this.setData({ errorMessage: '请输入邮箱', successMessage: '' });
      return;
    }
    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.setData({ errorMessage: '请输入有效的邮箱格式', successMessage: '' });
      return;
    }

    // 注册请求
    console.log('注册请求参数:', { username, password, phone, gender, age, email });
    wx.request({
      url: 'http://localhost:8000/api/auth/register',
      method: 'POST',
      data: {
        username,
        password,
        phone,
        gender,
        age: parseInt(age),
        email
      },
      header: {
        'Content-Type': 'application/json'
      },
      success: (res) => {
        console.log('注册响应:', res);
        if (res.data.code === 200) {
          this.setData({
            successMessage: '注册成功，请登录',
            errorMessage: ''
          });

          // 跳转到登录页面
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/auth/login/login'
            });
          }, 1500);
        } else {
          this.setData({
            errorMessage: res.data.message,
            successMessage: ''
          });
        }
      },
      fail: (err) => {
        console.log('注册失败:', err);
        this.setData({
          errorMessage: '注册失败，请检查网络连接',
          successMessage: ''
        });
      }
    });
  },

  navigateToLogin() {
    wx.redirectTo({
      url: '/pages/auth/login/login'
    });
  }
})