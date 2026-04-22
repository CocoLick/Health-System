const api = require('../../../../utils/api');

function formatDateTime(iso) {
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
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nutritionStatusLabel(code) {
  const map = {
    normal: '总体正常',
    excess_energy: '能量过剩倾向',
    low_energy: '能量不足倾向',
    imbalanced: '膳食结构不均衡',
    unclear_data: '依据有限待复评'
  };
  return map[code] || code || '';
}

Page({
  data: {
    loading: true,
    errorMsg: '',
    detail: {}
  },

  onLoad(options) {
    const id = options.id ? decodeURIComponent(options.id) : '';
    if (!id) {
      this.setData({ loading: false, errorMsg: '缺少评估编号' });
      return;
    }
    this.loadDetail(id);
  },

  loadDetail(id) {
    this.setData({ loading: true, errorMsg: '' });
    api.evaluation
      .getDetail(id)
      .then((res) => {
        if (res.code !== 200 && res.code !== '200') {
          this.setData({ loading: false, errorMsg: res.message || '加载失败' });
          return;
        }
        const d = res.data || {};
        let expired = false;
        if (d.valid_until) {
          const end = new Date(d.valid_until);
          const today = new Date();
          end.setHours(23, 59, 59, 999);
          today.setHours(0, 0, 0, 0);
          expired = end < today;
        }
        const bmiVal = d.bmi != null ? d.bmi : '';
        this.setData({
          loading: false,
          detail: {
            evaluation_id: d.evaluation_id || '',
            createdAtText: formatDateTime(d.created_at),
            validUntilText: d.valid_until ? formatDateOnly(d.valid_until) : '',
            expired,
            bmi: bmiVal,
            nutritionStatusText: nutritionStatusLabel(d.nutrition_status),
            energyNeedKcal: d.energy_need_kcal || '',
            priorityIssues: Array.isArray(d.priority_issues) ? d.priority_issues : [],
            body_composition_text: d.body_composition_text || '',
            dietary_pattern_text: d.dietary_pattern_text || '',
            micronutrient_text: d.micronutrient_text || '',
            risks_text: d.risks_text || '',
            professional_conclusion: d.professional_conclusion || '—',
            plan_recommendations: d.plan_recommendations || ''
          }
        });
      })
      .catch(() => {
        this.setData({ loading: false, errorMsg: '网络异常，请稍后重试' });
      });
  }
});
