const api = require('../../../utils/api');

function roleLabel(roleType) {
  if (roleType === 'admin') return '管理员';
  if (roleType === 'dietitian') return '规划师';
  return '普通用户';
}

Page({
  data: {
    roleText: '普通用户',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    submitting: false
  },

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      roleText: roleLabel(userInfo.role_type || userInfo.role)
    });
  },

  bindOldPassword(e) {
    this.setData({ oldPassword: e.detail.value });
  },

  bindNewPassword(e) {
    this.setData({ newPassword: e.detail.value });
  },

  bindConfirmPassword(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  submitChangePassword() {
    if (this.data.submitting) return;
    const oldPassword = (this.data.oldPassword || '').trim();
    const newPassword = (this.data.newPassword || '').trim();
    const confirmPassword = (this.data.confirmPassword || '').trim();

    if (!oldPassword || !newPassword || !confirmPassword) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    if (newPassword.length < 6) {
      wx.showToast({ title: '新密码至少6位', icon: 'none' });
      return;
    }
    if (newPassword !== confirmPassword) {
      wx.showToast({ title: '两次输入的新密码不一致', icon: 'none' });
      return;
    }
    if (newPassword === oldPassword) {
      wx.showToast({ title: '新密码不能与旧密码相同', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });
    api.auth
      .changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
      .then((res) => {
        wx.hideLoading();
        if (res.code === 200 || res.code === '200') {
          wx.showToast({ title: '密码修改成功', icon: 'success' });
          this.setData({
            oldPassword: '',
            newPassword: '',
            confirmPassword: ''
          });
          setTimeout(() => {
            wx.navigateBack({ delta: 1 });
          }, 500);
          return;
        }
        wx.showToast({ title: res.message || '修改失败', icon: 'none' });
      })
      .catch((err) => {
        wx.hideLoading();
        const msg = (err && err.data && err.data.message) || '网络错误，请稍后重试';
        wx.showToast({ title: msg, icon: 'none' });
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  }
});