const api = require('../../../utils/api');

const ROLE_LABEL = { user: '普通用户', dietitian: '规划师', admin: '管理员' };

function formatYmd(s) {
  if (!s) {
    return '—';
  }
  const t = new Date(s);
  if (isNaN(t.getTime())) {
    return String(s).length >= 10 ? String(s).slice(0, 10) : '—';
  }
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate()
  ).padStart(2, '0')}`;
}

function mapListUser(u) {
  const isBlocked = (u.status && String(u.status).trim()) === '禁用';
  return {
    id: u.user_id,
    name: (u.name && String(u.name).trim()) || u.username || '—',
    role: u.role_type,
    roleText: ROLE_LABEL[u.role_type] || u.role_type || '—',
    phone: (u.phone && String(u.phone).trim()) || '未填写',
    joinedAt: formatYmd(u.created_at),
    lastActive: formatYmd(u.updated_at),
    status: isBlocked ? 'inactive' : 'active',
    canToggle: u.role_type !== 'admin'
  };
}

Page({
  data: {
    listLoading: false,
    searchKeyword: '',
    roleTab: 'all',
    /* 仅展示普通用户，与后端 role_type=user 一致，不再做角色子筛选 */
    roleTabs: [{ key: 'all', text: '全部' }],
    users: [],
    filteredUsers: [],
    metrics: {
      total: 0,
      active: 0,
      blocked: 0
    }
  },

  onLoad() {
    this.loadList();
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    this.setData({ listLoading: true });
    api.admin
      .getAllUsers()
      .then((res) => {
        if (res.code === 200 || res.code === '200') {
          const raw = Array.isArray(res.data) ? res.data : [];
          const users = raw.map(mapListUser);
          this.setData({ users, listLoading: false });
          this.applyFilters();
        } else {
          this.setData({ users: [], listLoading: false });
          this.applyFilters();
          wx.showToast({ title: res.message || '加载失败', icon: 'none' });
        }
      })
      .catch((err) => {
        this.setData({ users: [], listLoading: false });
        this.applyFilters();
        const code = err && (err.statusCode != null ? err.statusCode : err.status);
        if (code === 404) {
          wx.showToast({
            title: '接口 404：请停止并重新 go run 后端，再重试',
            icon: 'none',
            duration: 3500
          });
        } else {
          wx.showToast({ title: '网络错误', icon: 'none' });
        }
      });
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: (e.detail.value || '').trim() });
    this.applyFilters();
  },

  switchRoleTab(e) {
    const next = e.currentTarget.dataset.key;
    if (!next || next === this.data.roleTab) {
      return;
    }
    this.setData({ roleTab: next });
    this.applyFilters();
  },

  toggleStatus(e) {
    const userId = e.currentTarget.dataset.id;
    if (!userId) {
      return;
    }
    const row = this.data.users.find((x) => x.id === userId);
    if (!row) {
      return;
    }
    if (!row.canToggle) {
      wx.showToast({ title: '不能通过此处修改管理员账号', icon: 'none' });
      return;
    }
    const toApi = row.status === 'active' ? '禁用' : '启用';
    api.admin
      .updateUserStatus(userId, toApi)
      .then((res) => {
        if (res.code === 200 || res.code === '200') {
          this.loadList();
          wx.showToast({ title: toApi === '启用' ? '已恢复' : '已禁用', icon: 'success' });
        } else {
          wx.showToast({ title: res.message || '操作失败', icon: 'none' });
        }
      })
      .catch(() => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  quickContact(e) {
    const name = e.currentTarget.dataset.name || '该用户';
    wx.showToast({ title: `已记录联系提醒：${name}`, icon: 'none' });
  },

  applyFilters() {
    const { users, roleTab, searchKeyword } = this.data;
    const keyword = (searchKeyword || '').toLowerCase();
    const filtered = users.filter((item) => {
      const hitRole = roleTab === 'all' || item.role === roleTab;
      const hitKeyword =
        !keyword ||
        String(item.name)
          .toLowerCase()
          .includes(keyword) ||
        String(item.phone)
          .toLowerCase()
          .includes(keyword) ||
        String(item.id || '')
          .toLowerCase()
          .includes(keyword);
      return hitRole && hitKeyword;
    });
    const active = users.filter((x) => x.status === 'active').length;
    this.setData({
      filteredUsers: filtered,
      metrics: {
        total: users.length,
        active,
        blocked: users.length - active
      }
    });
  }
});
