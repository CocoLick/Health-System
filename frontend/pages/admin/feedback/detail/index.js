const api = require('../../../../utils/api');

function fmtTime(iso) {
  if (!iso) {
    return '';
  }
  const s = String(iso);
  return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
}

function replyRoleLabel(senderType) {
  if (senderType === 'admin') {
    return '管理员';
  }
  if (senderType === 'dietitian') {
    return '规划师';
  }
  if (senderType === 'user') {
    return '用户';
  }
  return '平台';
}

Page({
  data: {
    feedbackId: '',
    loading: true,
    detail: null,
    replyText: '',
    sending: false,
    closing: false
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
      .adminSystemDetail(id)
      .then((res) => {
        const ok = res && Number(res.code) === 200;
        if (!ok || !res.data) {
          wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' });
          this.setData({ loading: false, detail: null });
          return;
        }
        const d = res.data;
        const replies = (d.replies || []).map((r) =>
          Object.assign({}, r, {
            display_time: fmtTime(r.created_at),
            isMine: r.sender_type === 'admin',
            role_label: replyRoleLabel(r.sender_type)
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
      .adminSystemReply(this.data.feedbackId, { body })
      .then((res) => {
        this.setData({ sending: false });
        if (res && Number(res.code) === 200) {
          wx.showToast({ title: '已发送', icon: 'success' });
          this.setData({ replyText: '' });
          this.loadDetail();
        } else {
          wx.showToast({ title: (res && res.message) || '发送失败', icon: 'none' });
        }
      })
      .catch((err) => {
        this.setData({ sending: false });
        wx.showToast({
          title: (err && err.data && err.data.message) || '发送失败',
          icon: 'none'
        });
      });
  },

  submitClose() {
    if (this.data.closing) {
      return;
    }
    wx.showModal({
      title: '关闭工单',
      content: '将关闭该反馈工单（状态变为已关闭），确定继续？',
      success: (r) => {
        if (!r.confirm) {
          return;
        }
        this.setData({ closing: true });
        api.feedback
          .adminSystemClose(this.data.feedbackId)
          .then((res) => {
            this.setData({ closing: false });
            if (res && Number(res.code) === 200) {
              wx.showToast({ title: '已关闭', icon: 'success' });
              this.loadDetail();
              return;
            }
            wx.showToast({ title: (res && res.message) || '操作失败', icon: 'none' });
          })
          .catch(() => {
            this.setData({ closing: false });
            wx.showToast({ title: '网络错误', icon: 'none' });
          });
      }
    });
  }
});
