const api = require('../../../../utils/api');

function fmtTime(iso) {
  if (!iso) {
    return '';
  }
  const s = String(iso);
  return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
}

Page({
  data: {
    feedbackId: '',
    loading: true,
    detail: null,
    replyText: '',
    sending: false
  },

  onLoad(options) {
    const id = (options.id || '').trim();
    if (!id) {
      this.setData({ loading: false });
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.setData({ feedbackId: id });
    this.loadDetail();
  },

  loadDetail() {
    const id = this.data.feedbackId;
    if (!id) {
      return;
    }
    this.setData({ loading: true });
    api.feedback
      .detail(id)
      .then((res) => {
        if (res.code !== 200 || !res.data) {
          wx.showToast({ title: res.message || '加载失败', icon: 'none' });
          this.setData({ loading: false, detail: null });
          return;
        }
        const d = res.data;
        const replies = (d.replies || []).map((r) =>
          Object.assign({}, r, {
            display_time: fmtTime(r.created_at),
            isMine: r.sender_type === 'dietitian'
          })
        );
        this.setData({
          loading: false,
          detail: Object.assign({}, d, {
            created_display: fmtTime(d.created_at),
            replies
          })
        });
      })
      .catch(() => {
        this.setData({ loading: false, detail: null });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  onReplyInput(e) {
    this.setData({ replyText: e.detail.value });
  },

  submitReply() {
    const body = (this.data.replyText || '').trim();
    if (!body) {
      wx.showToast({ title: '请输入回复内容', icon: 'none' });
      return;
    }
    if (this.data.sending) {
      return;
    }
    this.setData({ sending: true });
    api.feedback
      .reply(this.data.feedbackId, { body })
      .then((res) => {
        this.setData({ sending: false });
        if (res.code === 200) {
          wx.showToast({ title: '已发送', icon: 'success' });
          this.setData({ replyText: '' });
          this.loadDetail();
        } else {
          wx.showToast({ title: res.message || '发送失败', icon: 'none' });
        }
      })
      .catch((err) => {
        this.setData({ sending: false });
        wx.showToast({
          title: (err && err.data && err.data.message) || '发送失败',
          icon: 'none'
        });
      });
  }
});
