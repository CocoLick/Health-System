// app.js
App({
  onLaunch() {
    // 小程序启动时执行
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