const api = require('../../../../utils/api');

function formatEvalTime(iso) {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return String(iso);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

function formatDateOnly(iso) {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return String(iso).slice(0, 10);
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function nutritionStatusLabel(code) {
  const map = {
    normal: '总体正常',
    excess_energy: '能量过剩倾向',
    low_energy: '能量不足倾向',
    imbalanced: '膳食结构不均衡',
    unclear_data: '依据有限待复评'
  };
  return map[code] || code || '—';
}

function expiredFromValidUntil(validUntil) {
  if (!validUntil) {
    return false;
  }
  const end = new Date(validUntil);
  if (isNaN(end.getTime())) {
    return false;
  }
  const today = new Date();
  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return end < today;
}

function mapCurrent(ev) {
  if (!ev) {
    return null;
  }
  const expired = expiredFromValidUntil(ev.valid_until);
  const conclusion = (ev.professional_conclusion || '').trim();
  return {
    evaluation_id: ev.evaluation_id || '',
    createdAtText: formatEvalTime(ev.created_at),
    validUntilText: ev.valid_until ? formatDateOnly(ev.valid_until) : '',
    nutritionStatusText: nutritionStatusLabel(ev.nutrition_status),
    bmiText: ev.bmi != null ? String(ev.bmi) : '—',
    conclusionShort: conclusion.length > 120 ? conclusion.slice(0, 120) + '…' : conclusion || '—',
    expired
  };
}

function mapHistoryRow(ev) {
  const expired = expiredFromValidUntil(ev.valid_until);
  const conclusion = (ev.professional_conclusion || '').trim();
  const snippet = conclusion.length > 80 ? conclusion.slice(0, 80) + '…' : conclusion || '—';
  return {
    evaluation_id: ev.evaluation_id || '',
    createdAtText: formatEvalTime(ev.created_at),
    nutritionStatusText: nutritionStatusLabel(ev.nutrition_status),
    subtitle: snippet,
    expired
  };
}

Page({
  data: {
    loading: true,
    loadError: '',
    userId: '',
    serviceRequestId: '',
    username: '',
    current: null,
    historyList: [],
    hasOlderHistory: false
  },

  onLoad(options) {
    const userId = options.userId ? decodeURIComponent(options.userId) : '';
    const serviceRequestId = options.serviceRequestId ? decodeURIComponent(options.serviceRequestId) : '';
    const username = options.username ? decodeURIComponent(options.username) : '';
    if (!userId) {
      this.setData({ loading: false, loadError: '缺少用户' });
      wx.showToast({ title: '缺少用户', icon: 'none' });
      return;
    }
    this.setData({ userId, serviceRequestId, username });
    this.loadList();
  },

  loadList() {
    const { userId } = this.data;
    if (!userId) {
      return;
    }
    this.setData({ loading: true, loadError: '' });
    api.evaluation
      .listByUser(userId, 50)
      .then((res) => {
        if (res.code !== 200 && res.code !== '200') {
          this.setData({
            loading: false,
            loadError: res.message || '加载失败',
            current: null,
            historyList: [],
            hasOlderHistory: false
          });
          return;
        }
        const list = Array.isArray(res.data) ? res.data : [];
        const current = list.length ? mapCurrent(list[0]) : null;
        const rest = list.length > 1 ? list.slice(1).map(mapHistoryRow) : [];
        this.setData({
          loading: false,
          loadError: '',
          current,
          historyList: rest,
          hasOlderHistory: rest.length > 0
        });
      })
      .catch(() => {
        this.setData({
          loading: false,
          loadError: '网络异常',
          current: null,
          historyList: [],
          hasOlderHistory: false
        });
      });
  },

  startNewEvaluation() {
    const { userId, serviceRequestId } = this.data;
    let url = `/pages/dietitian/service/nutrition-eval/index?userId=${encodeURIComponent(userId)}`;
    if (serviceRequestId) {
      url += `&serviceRequestId=${encodeURIComponent(serviceRequestId)}`;
    }
    wx.navigateTo({
      url,
      events: {
        evaluationSaved: () => {
          this.loadList();
        }
      }
    });
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({
      url: '/pages/user/health/evaluation-detail/index?id=' + encodeURIComponent(id)
    });
  }
});
