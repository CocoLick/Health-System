Page({
  data: {
    searchKeyword: '',
    roleTab: 'all',
    roleTabs: [
      { key: 'all', text: '全部' },
      { key: 'user', text: '普通用户' },
      { key: 'dietitian', text: '规划师' }
    ],
    users: [
      { id: 1, name: '张晨曦', role: 'user', roleText: '普通用户', phone: '138****1021', joinedAt: '2026-03-11', lastActive: '今天 09:12', status: 'active' },
      { id: 2, name: '李晓楠', role: 'dietitian', roleText: '规划师', phone: '136****7781', joinedAt: '2026-02-26', lastActive: '今天 08:31', status: 'active' },
      { id: 3, name: '王子墨', role: 'user', roleText: '普通用户', phone: '155****4492', joinedAt: '2026-01-19', lastActive: '昨天 21:50', status: 'inactive' },
      { id: 4, name: '周若涵', role: 'dietitian', roleText: '规划师', phone: '189****0663', joinedAt: '2025-12-15', lastActive: '2 天前', status: 'active' },
      { id: 5, name: '刘嘉禾', role: 'user', roleText: '普通用户', phone: '177****3008', joinedAt: '2025-11-30', lastActive: '3 天前', status: 'active' }
    ],
    filteredUsers: [],
    metrics: {
      total: 0,
      active: 0,
      blocked: 0
    }
  },

  onLoad() {
    this.applyFilters();
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: (e.detail.value || '').trim() });
    this.applyFilters();
  },

  switchRoleTab(e) {
    const next = e.currentTarget.dataset.key;
    if (!next || next === this.data.roleTab) return;
    this.setData({ roleTab: next });
    this.applyFilters();
  },

  toggleStatus(e) {
    const id = Number(e.currentTarget.dataset.id);
    const users = this.data.users.map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        status: item.status === 'active' ? 'inactive' : 'active'
      };
    });
    this.setData({ users });
    this.applyFilters();
    wx.showToast({ title: '状态已更新', icon: 'success' });
  },

  quickContact(e) {
    const name = e.currentTarget.dataset.name || '该用户';
    wx.showToast({ title: `已提醒${name}`, icon: 'none' });
  },

  applyFilters() {
    const { users, roleTab, searchKeyword } = this.data;
    const keyword = (searchKeyword || '').toLowerCase();
    const filtered = users.filter((item) => {
      const hitRole = roleTab === 'all' || item.role === roleTab;
      const hitKeyword = !keyword
        || item.name.toLowerCase().includes(keyword)
        || item.phone.toLowerCase().includes(keyword);
      return hitRole && hitKeyword;
    });
    const active = users.filter((item) => item.status === 'active').length;
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