Page({
  data: {
    activeRange: '7d',
    rangeOptions: [
      { key: '7d', text: '近7天' },
      { key: '30d', text: '近30天' },
      { key: '90d', text: '近90天' }
    ],
    overview: [
      { key: 'newUsers', label: '新增用户', value: 218, trend: '+12.8%' },
      { key: 'activeUsers', label: '活跃用户', value: 1694, trend: '+6.4%' },
      { key: 'serviceDone', label: '完成服务', value: 782, trend: '+9.2%' },
      { key: 'satisfaction', label: '满意度', value: '97.1%', trend: '+0.9%' }
    ],
    trendRows: [
      { label: '周一', users: 42, services: 98 },
      { label: '周二', users: 33, services: 103 },
      { label: '周三', users: 48, services: 116 },
      { label: '周四', users: 39, services: 109 },
      { label: '周五', users: 56, services: 134 },
      { label: '周六', users: 51, services: 121 },
      { label: '周日', users: 44, services: 101 }
    ],
    issueList: [
      '晚间 20:00 后打卡峰值明显，建议放大容量冗余',
      '新用户 3 日留存略低于目标值，需加强引导流程',
      '慢病用户服务完成率上涨，评估链路表现稳定'
    ]
  },

  switchRange(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeRange) return;
    this.setData({ activeRange: key });
    wx.showToast({ title: `已切换到${e.currentTarget.dataset.text}`, icon: 'none' });
  }
});