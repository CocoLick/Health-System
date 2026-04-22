const api = require('../../../../utils/api');

Page({
  data: {
    loading: true,
    error: '',
    article: null
  },

  onLoad(options) {
    const id = (options.id || '').trim();
    if (!id) {
      this.setData({ loading: false, error: '缺少文章参数' });
      return;
    }
    wx.showLoading({ title: '加载中' });
    api.healthEducation
      .readerDetail(id)
      .then((res) => {
        wx.hideLoading();
        if (res.code !== 200 || !res.data) {
          this.setData({
            loading: false,
            error: res.message || '加载失败',
            article: null
          });
          return;
        }
        const d = res.data;
        const s = d.updated_at ? String(d.updated_at) : '';
        const timeText = s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
        this.setData({
          loading: false,
          error: '',
          article: Object.assign({}, d, {
            updated_at_text: timeText,
            visibility_label: d.visibility === 'assigned' ? '指派给您' : '公开'
          })
        });
      })
      .catch(() => {
        wx.hideLoading();
        this.setData({ loading: false, error: '网络错误', article: null });
      });
  }
});
