// 冷启动首屏：仅负责按登录态与角色 reLaunch，避免先渲染用户端首页再跳转。
Page({
  onLoad() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');

    let url = '/pages/home/index';
    if (token && userInfo) {
      const roleType = userInfo.role_type || userInfo.role || 'user';
      if (roleType === 'admin') {
        url = '/pages/admin/dashboard/index';
      } else if (roleType === 'dietitian') {
        url = '/pages/dietitian/dashboard/index';
      }
    }

    wx.reLaunch({ url });
  }
});
