const api = require('../../../utils/api');

function buildSelectedMap(ids) {
  const m = {};
  (ids || []).forEach((id) => {
    if (id) {
      m[id] = true;
    }
  });
  return m;
}

Page({
  data: {
    id: '',
    contextUserId: '',
    title: '',
    summary: '',
    body: '',
    category: '',
    visibility: 'public',
    serviceUsers: [],
    selectedUserIds: [],
    selectedMap: {},
    saving: false,
    publishing: false
  },

  onLoad(options) {
    const userId = (options.userId || '').trim();
    const id = (options.id || '').trim();
    if (userId) {
      this.setData({
        contextUserId: userId,
        visibility: 'assigned',
        selectedUserIds: [userId],
        selectedMap: buildSelectedMap([userId])
      });
    }
    if (id) {
      this.setData({ id });
      this.loadDetail(id);
    }
    this.loadServiceUsers();
  },

  loadServiceUsers() {
    api.serviceRequest
      .getDietitianUsers()
      .then((res) => {
        if (res.code === 200) {
          const list = (res.data || []).map((u) => ({
            userId: u.user_id,
            username: u.username || u.user_id
          }));
          this.setData({ serviceUsers: list });
        }
      })
      .catch(() => {});
  },

  loadDetail(heId) {
    wx.showLoading({ title: '加载中' });
    api.healthEducation
      .getDetail(heId)
      .then((res) => {
        wx.hideLoading();
        if (res.code !== 200 || !res.data) {
          wx.showToast({ title: res.message || '加载失败', icon: 'none' });
          return;
        }
        const d = res.data;
        const ids = Array.isArray(d.target_user_ids) ? d.target_user_ids : [];
        this.setData({
          id: d.he_id,
          title: d.title || '',
          summary: d.summary || '',
          body: d.body || '',
          category: d.category || '',
          visibility: d.visibility === 'assigned' ? 'assigned' : 'public',
          selectedUserIds: ids,
          selectedMap: buildSelectedMap(ids)
        });
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },
  onSummaryInput(e) {
    this.setData({ summary: e.detail.value });
  },
  onCategoryInput(e) {
    this.setData({ category: e.detail.value });
  },
  onBodyInput(e) {
    this.setData({ body: e.detail.value });
  },

  onVisibilityChange(e) {
    const v = e.detail.value;
    this.setData({ visibility: v });
    if (v === 'public') {
      this.setData({ selectedUserIds: [], selectedMap: {} });
    }
  },

  toggleUser(e) {
    if (this.data.visibility !== 'assigned') {
      return;
    }
    const uid = (e.currentTarget.dataset.userid || '').trim();
    if (!uid) {
      return;
    }
    const set = new Set(this.data.selectedUserIds);
    if (set.has(uid)) {
      set.delete(uid);
    } else {
      set.add(uid);
    }
    const arr = Array.from(set);
    this.setData({
      selectedUserIds: arr,
      selectedMap: buildSelectedMap(arr)
    });
  },

  payloadForSave() {
    const { title, summary, body, category, visibility, selectedUserIds } = this.data;
    return {
      title: (title || '').trim(),
      summary: (summary || '').trim(),
      body: (body || '').trim(),
      category: (category || '').trim(),
      visibility,
      target_user_ids: visibility === 'assigned' ? selectedUserIds : []
    };
  },

  saveDraft() {
    if (this.data.saving) {
      return;
    }
    const p = this.payloadForSave();
    if (p.visibility === 'assigned' && p.target_user_ids.length > 0) {
      const allowed = new Set((this.data.serviceUsers || []).map((u) => u.userId));
      const ok = p.target_user_ids.every((id) => allowed.has(id));
      if (!ok) {
        wx.showToast({ title: '所选用户须为服务用户', icon: 'none' });
        return;
      }
    }
    this.setData({ saving: true });
    const done = () => this.setData({ saving: false });

    if (!this.data.id) {
      api.healthEducation
        .create(p)
        .then((res) => {
          done();
          if (res.code === 200 && res.data && res.data.he_id) {
            this.setData({ id: res.data.he_id });
            wx.showToast({ title: '草稿已保存', icon: 'success' });
          } else {
            wx.showToast({ title: res.message || '保存失败', icon: 'none' });
          }
        })
        .catch((err) => {
          done();
          const msg = (err && err.data && err.data.message) || '保存失败';
          wx.showToast({ title: msg, icon: 'none' });
        });
    } else {
      api.healthEducation
        .update(this.data.id, p)
        .then((res) => {
          done();
          if (res.code === 200) {
            wx.showToast({ title: '已更新', icon: 'success' });
          } else {
            wx.showToast({ title: res.message || '保存失败', icon: 'none' });
          }
        })
        .catch((err) => {
          done();
          const msg = (err && err.data && err.data.message) || '保存失败';
          wx.showToast({ title: msg, icon: 'none' });
        });
    }
  },

  publish() {
    const title = (this.data.title || '').trim();
    const body = (this.data.body || '').trim();
    if (!title) {
      wx.showToast({ title: '请填写标题', icon: 'none' });
      return;
    }
    if (!body) {
      wx.showToast({ title: '请填写正文', icon: 'none' });
      return;
    }
    const vis = this.data.visibility;
    const targets = vis === 'assigned' ? this.data.selectedUserIds : [];
    if (vis === 'assigned' && targets.length === 0) {
      wx.showToast({ title: '请至少选择一名用户', icon: 'none' });
      return;
    }

    const runPublish = (heId) => {
      this.setData({ publishing: true });
      api.healthEducation
        .publish(heId, {
          visibility: vis,
          target_user_ids: targets
        })
        .then((res) => {
          this.setData({ publishing: false });
          if (res.code === 200) {
            wx.showToast({ title: '已发布', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 600);
          } else {
            wx.showToast({ title: res.message || '发布失败', icon: 'none' });
          }
        })
        .catch((err) => {
          this.setData({ publishing: false });
          const msg = (err && err.data && err.data.message) || '发布失败';
          wx.showToast({ title: msg, icon: 'none' });
        });
    };

    const saveFirst = () => {
      this.setData({ saving: true });
      const p = this.payloadForSave();
      api.healthEducation
        .create(p)
        .then((res) => {
          this.setData({ saving: false });
          if (res.code === 200 && res.data && res.data.he_id) {
            this.setData({ id: res.data.he_id });
            runPublish(res.data.he_id);
          } else {
            wx.showToast({ title: res.message || '创建失败', icon: 'none' });
          }
        })
        .catch((err) => {
          this.setData({ saving: false });
          wx.showToast({
            title: (err && err.data && err.data.message) || '创建失败',
            icon: 'none'
          });
        });
    };

    if (!this.data.id) {
      wx.showModal({
        title: '发布',
        content: '将先保存为草稿再立即发布，是否继续？',
        success: (r) => {
          if (r.confirm) {
            saveFirst();
          }
        }
      });
      return;
    }

    this.setData({ saving: true });
    api.healthEducation
      .update(this.data.id, this.payloadForSave())
      .then((res) => {
        this.setData({ saving: false });
        if (res.code !== 200) {
          wx.showToast({ title: res.message || '保存失败', icon: 'none' });
          return;
        }
        runPublish(this.data.id);
      })
      .catch((err) => {
        this.setData({ saving: false });
        wx.showToast({
          title: (err && err.data && err.data.message) || '保存失败',
          icon: 'none'
        });
      });
  }
});
