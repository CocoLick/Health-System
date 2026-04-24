Page({
  data: {
    settings: [
      {
        title: '审核提醒',
        desc: '有新计划或文章提交时，第一时间提醒管理员',
        key: 'auditNotify',
        enabled: true
      },
      {
        title: '系统异常告警',
        desc: '接口错误率上升时触发告警消息',
        key: 'alertNotify',
        enabled: true
      },
      {
        title: '夜间静默',
        desc: '23:00 - 07:00 不推送普通通知',
        key: 'nightSilent',
        enabled: false
      }
    ],
    securityItems: [
      { title: '管理员密码策略', value: '至少 10 位，含大小写与数字' },
      { title: '登录保护', value: '连续 5 次失败后锁定 15 分钟' },
      { title: '会话有效期', value: '24 小时自动过期' }
    ]
  },

  onToggleSetting(e) {
    const key = e.currentTarget.dataset.key;
    const next = !!e.detail.value;
    const settings = this.data.settings.map((item) => (
      item.key === key ? { ...item, enabled: next } : item
    ));
    this.setData({ settings });
    wx.showToast({ title: '设置已更新', icon: 'success' });
  },

  saveSettings() {
    wx.showToast({ title: '配置已保存', icon: 'success' });
  },

  resetRiskConfig() {
    wx.showToast({ title: '已恢复默认', icon: 'none' });
  }
});