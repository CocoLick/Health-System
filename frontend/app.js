// app.js
App({
  onLaunch() {
    console.log('小程序启动');
  },

  globalData: {
    userInfo: null,
    token: null
  },
  // API 配置
  apiConfig: {
    baseUrl: 'http://localhost:8000'
  }
})