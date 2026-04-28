// register.js
const api = require('../../../utils/api');

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
    genderIndex: -1,
    ageOptions: Array.from({ length: 100 }, (_, i) => (i + 1).toString()),
    ageIndex: -1
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
    const usernameTrim = String(username || '').trim();
    const phoneTrim = String(phone || '').trim();
    const emailTrim = String(email || '').trim();
    const ageNum = parseInt(String(age).trim(), 10);

    // 表单验证
    if (!usernameTrim) {
      this.setData({ errorMessage: '请输入用户名', successMessage: '' });
      return;
    }
    if (!password || password.length < 6) {
      this.setData({ errorMessage: '密码长度至少6位', successMessage: '' });
      return;
    }
    if (!phoneTrim) {
      this.setData({ errorMessage: '请输入手机号', successMessage: '' });
      return;
    }
    if (!gender) {
      this.setData({ errorMessage: '请选择性别', successMessage: '' });
      return;
    }
    if (!age || !Number.isFinite(ageNum) || ageNum < 1 || ageNum > 150) {
      this.setData({ errorMessage: '请选择有效的年龄', successMessage: '' });
      return;
    }
    if (!emailTrim) {
      this.setData({ errorMessage: '请输入邮箱', successMessage: '' });
      return;
    }
    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) {
      this.setData({ errorMessage: '请输入有效的邮箱格式', successMessage: '' });
      return;
    }

    // 注册请求：age 必须为数字，避免 NaN 序列化为 null 导致后端 age=0 校验失败
    const payload = {
      username: usernameTrim,
      password: String(password),
      phone: phoneTrim,
      gender: String(gender),
      age: ageNum,
      email: emailTrim
    };
    console.log('注册请求参数:', { ...payload, password: '***' });
    
    api.auth.register(payload)
    .then(res => {
      console.log('注册响应:', res);
      if (res.code === 200 || res.code === '200') {
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
          errorMessage: res.message || '注册失败',
          successMessage: ''
        });
      }
    })
    .catch(err => {
      console.log('注册失败:', err);
      const body = err && err.data;
      const msg =
        (body && (body.message || body.Message)) ||
        (typeof err === 'string' ? err : '') ||
        (err && err.errMsg) ||
        '';
      this.setData({
        errorMessage: msg ? String(msg) : '注册失败，请检查网络连接',
        successMessage: ''
      });
    });
  },

  navigateToLogin() {
    wx.redirectTo({
      url: '/pages/auth/login/login'
    });
  }
})