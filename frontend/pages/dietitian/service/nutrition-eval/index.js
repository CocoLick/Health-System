const api = require('../../../../utils/api');

function activityText(level) {
  const m = {
    sedentary: '久坐少动',
    lightly_active: '轻度活动',
    moderately_active: '中度活动',
    very_active: '高强度活动'
  };
  return m[level] || level || '—';
}

function dietGoalText(goal, other) {
  if (goal === 'other' && other) {
    return other;
  }
  const map = {
    weight_loss: '减脂',
    weight_gain: '增重',
    diabetes_control: '控糖',
    health_maintain: '养生',
    sports_nutrition: '运动营养',
    pregnancy: '孕期营养'
  };
  return map[goal] || goal || '—';
}

function computeBMI(heightCm, weightKg) {
  if (!heightCm || !weightKg) {
    return '';
  }
  const m = heightCm / 100;
  if (m <= 0) {
    return '';
  }
  const v = weightKg / (m * m);
  return (Math.round(v * 10) / 10).toFixed(1);
}

/** 从规划师服务申请列表中选取与当前用户最相关的一条（与面板逻辑一致并放宽匹配） */
function pickServiceRequestForUser(rows, userId, preferredRequestId) {
  const uid = String(userId || '').trim();
  const list = Array.isArray(rows) ? rows : [];
  if (!uid) {
    return null;
  }
  if (preferredRequestId) {
    const byId = list.find((x) => String(x.request_id) === String(preferredRequestId));
    if (byId) {
      return byId;
    }
  }
  const mine = list.filter((x) => String(x.user_id) === uid);
  if (!mine.length) {
    return null;
  }
  const rank = (s) => {
    if (s === 'pending' || s === 'approved') {
      return 2;
    }
    if (s === 'completed') {
      return 1;
    }
    return 0;
  };
  mine.sort((a, b) => {
    const d = rank(b.status) - rank(a.status);
    if (d !== 0) {
      return d;
    }
    const ta = new Date(a.create_time || a.update_time || 0).getTime();
    const tb = new Date(b.create_time || b.update_time || 0).getTime();
    return tb - ta;
  });
  return mine[0];
}

Page({
  data: {
    userId: '',
    serviceRequestId: '',
    context: {
      bmi: '',
      activityText: '',
      dietGoalText: '—',
      otherGoal: ''
    },
    statusLabels: ['（未选）', '总体正常', '能量过剩倾向', '能量不足倾向', '膳食结构不均衡', '依据有限待复评'],
    statusValues: ['', 'normal', 'excess_energy', 'low_energy', 'imbalanced', 'unclear_data'],
    statusIndex: 0,
    form: {
      body_composition_text: '',
      dietary_pattern_text: '',
      micronutrient_text: '',
      risks_text: '',
      priority_lines: '',
      professional_conclusion: '',
      plan_recommendations: '',
      energy_need_kcal: '',
      valid_until: ''
    }
  },

  onLoad(options) {
    const userId = options.userId || '';
    const serviceRequestId = options.serviceRequestId || '';
    if (!userId) {
      wx.showToast({ title: '缺少用户', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ userId, serviceRequestId });
    this.loadContext();
  },

  loadContext() {
    const { userId, serviceRequestId } = this.data;
    wx.showLoading({ title: '加载中...' });
    const p1 = api.healthData.getUserHealthData(userId).catch(() => ({ code: 0 }));
    const p2 = api.serviceRequest.getDietitianList().catch(() => ({ code: 0 }));
    Promise.all([p1, p2])
      .then(([hRes, rRes]) => {
        wx.hideLoading();
        let bmiStr = '';
        let activityStr = '';
        if (hRes && (hRes.code === 200 || hRes.code === '200') && hRes.data) {
          const d = hRes.data;
          bmiStr = computeBMI(d.height, d.weight);
          activityStr = activityText(d.activity_level);
        }
        const list = rRes && rRes.data != null ? rRes.data : [];
        const req =
          rRes && (rRes.code === 200 || rRes.code === '200')
            ? pickServiceRequestForUser(list, userId, serviceRequestId)
            : null;
        let dietStr = '—';
        let other = '';
        let srId = String(serviceRequestId || '').trim();
        if (req) {
          srId = srId || String(req.request_id || '');
          dietStr = dietGoalText(req.diet_goal, req.other_goal);
          other = req.other_goal ? String(req.other_goal) : '';
        }
        const upd = {
          'context.bmi': bmiStr,
          'context.activityText': activityStr,
          'context.dietGoalText': dietStr,
          'context.otherGoal': other,
          serviceRequestId: srId || this.data.serviceRequestId
        };
        this.setData(upd);
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`form.${field}`]: value
    });
  },

  onStatusChange(e) {
    const idx = parseInt(e.detail.value, 10);
    this.setData({ statusIndex: idx });
  },

  onValidUntilChange(e) {
    this.setData({ 'form.valid_until': e.detail.value });
  },

  submit() {
    const { userId, serviceRequestId, statusValues, statusIndex, form } = this.data;
    const conclusion = (form.professional_conclusion || '').trim();
    if (!conclusion) {
      wx.showToast({ title: '请填写专业评估结论', icon: 'none' });
      return;
    }
    const priorities = (form.priority_lines || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    let energy = null;
    if (form.energy_need_kcal !== '' && form.energy_need_kcal != null) {
      const n = parseInt(String(form.energy_need_kcal), 10);
      if (!isNaN(n)) {
        energy = n;
      }
    }
    const payload = {
      user_id: userId,
      nutrition_status: statusValues[statusIndex] || '',
      body_composition_text: form.body_composition_text,
      dietary_pattern_text: form.dietary_pattern_text,
      micronutrient_text: form.micronutrient_text,
      risks_text: form.risks_text,
      priority_issues: priorities,
      professional_conclusion: conclusion,
      plan_recommendations: form.plan_recommendations
    };
    if (energy != null) {
      payload.energy_need_kcal = energy;
    }
    if (serviceRequestId) {
      payload.service_request_id = serviceRequestId;
    }
    if (form.valid_until) {
      payload.valid_until = form.valid_until;
    }
    wx.showLoading({ title: '提交中...' });
    api.evaluation
      .submit(payload)
      .then((res) => {
        wx.hideLoading();
        if (res.code === 200) {
          wx.showToast({ title: '已保存', icon: 'success' });
          try {
            const ec = this.getOpenerEventChannel();
            if (ec && ec.emit) {
              ec.emit('evaluationSaved', {});
            }
          } catch (e) {
            /* no opener */
          }
          setTimeout(() => wx.navigateBack(), 800);
        } else {
          wx.showToast({ title: res.message || '提交失败', icon: 'none' });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        const msg = (err && err.data && err.data.message) || '网络错误';
        wx.showToast({ title: msg, icon: 'none' });
      });
  }
});
