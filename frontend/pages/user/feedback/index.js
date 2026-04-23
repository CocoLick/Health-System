const api = require('../../../utils/api');

function safeDecode(s) {
  if (s == null || s === '') return '';
  try {
    return decodeURIComponent(String(s));
  } catch (e) {
    return String(s);
  }
}

const CATEGORIES = [
  { id: 'diet_plan', name: '膳食计划' },
  { id: 'dietitian_service', name: '规划服务' },
  { id: 'system', name: '系统功能' }
];

function formatDt(iso) {
  if (iso == null || iso === '') return '';
  const d = new Date(typeof iso === 'string' ? iso : iso);
  if (isNaN(d.getTime())) return String(iso);
  const M = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${M}月${day}日 ${h}:${m}`;
}

function replyPillFromStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'pending') {
    return { text: '未回复', cls: 'pill-pending' };
  }
  if (s === 'replied' || s === 'closed') {
    return { text: '已回复', cls: 'pill-done' };
  }
  return { text: '处理中', cls: 'pill-other' };
}

function tsFromRequestRow(r) {
  if (!r) return 0;
  const raw = r.update_time || r.updateTime || r.updated_at || r.create_time || r.createTime || r.created_at || 0;
  const t = new Date(raw).getTime();
  return isNaN(t) ? 0 : t;
}

Page({
  data: {
    isLoggedIn: false,
    scrollIntoView: '',
    myFeedbacksAll: [],
    displayedFeedbacks: [],
    myFeedbacksLoading: false,
    searchKeyword: '',
    primaryTypeFilter: 'all',
    sortOrder: 'desc',
    showAdvancedFilters: false,
    onlyCurrentPlan: false,
    onlyCurrentDietitian: false,
    onlyPending: false,
    filterContextPlanId: '',
    filterContextDietitianId: '',
    /** 本地无规划师 ID 时，用已通过的服务请求推断 */
    resolvedDietitianId: '',
    expandedFeedbackId: '',
    expandedLoading: false,
    expandedDetail: null,
    expandedReplyText: '',
    expandedReplySubmitting: false,
    categories: CATEGORIES,
    category: 'system',
    categoryLocked: false,
    planLocked: false,
    relatedPlanId: '',
    relatedPlanTitle: '',
    planOptions: [],
    planPickerLabels: [],
    planPickerIndex: 0,
    plansLoading: false,
    dietitianOptions: [],
    dietitianPickerLabels: [],
    dietitianIndex: 0,
    dietitiansLoading: false,
    title: '',
    content: '',
    rating: 0,
    submitting: false
  },

  onLoad(options) {
    const token = wx.getStorageSync('token');
    const wantReset =
      String(options.reset || '') === '1' ||
      options.reset === 1 ||
      String(options.reset || '') === 'true';
    const focusForm =
      String(options.focus_form || '') === '1' || options.focus_form === 1;

    let qCat = (options.category && String(options.category).trim().toLowerCase()) || '';
    let planId = (options.plan_id && String(options.plan_id).trim()) || '';
    let planTitle = safeDecode(options.plan_title || '');

    if (wantReset) {
      qCat = '';
      planId = '';
      planTitle = '';
    }

    const valid = ['diet_plan', 'dietitian_service', 'system'].indexOf(qCat) >= 0;
    let category = valid ? qCat : 'system';
    const planLocked = !!planId;

    if (planLocked) {
      category = 'diet_plan';
    }

    this._pendingScrollForm = !!(wantReset && focusForm);

    this.setData({
      isLoggedIn: !!token,
      searchKeyword: wantReset ? '' : this.data.searchKeyword,
      primaryTypeFilter: wantReset ? 'all' : this.data.primaryTypeFilter,
      sortOrder: wantReset ? 'desc' : this.data.sortOrder,
      showAdvancedFilters: wantReset ? false : this.data.showAdvancedFilters,
      onlyCurrentPlan: wantReset ? false : this.data.onlyCurrentPlan,
      onlyCurrentDietitian: wantReset ? false : this.data.onlyCurrentDietitian,
      onlyPending: wantReset ? false : this.data.onlyPending,
      category,
      categoryLocked: planLocked,
      planLocked,
      relatedPlanId: planId,
      relatedPlanTitle: planTitle || (planLocked ? '本膳食计划' : ''),
      title: '',
      content: '',
      rating: 0,
      expandedFeedbackId: wantReset ? '' : this.data.expandedFeedbackId,
      expandedDetail: wantReset ? null : this.data.expandedDetail,
      resolvedDietitianId: wantReset ? '' : this.data.resolvedDietitianId
    });

    if (category === 'diet_plan' && !planLocked) {
      this.loadPlans();
    }
    if (category === 'dietitian_service') {
      this.loadDietitians();
    }
    if (token) {
      this.loadMyFeedbacks();
    }
  },

  onReady() {
    if (this._pendingScrollForm) {
      this._pendingScrollForm = false;
      wx.nextTick(() => {
        this.setData({ scrollIntoView: 'anchor-new-form' });
        setTimeout(() => {
          this.setData({ scrollIntoView: '' });
        }, 900);
      });
    }
  },

  onShow() {
    const token = wx.getStorageSync('token');
    this.setData({ isLoggedIn: !!token });
    if (token) {
      this.loadMyFeedbacks();
    }
  },

  onUnload() {
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
      this._searchDebounceTimer = null;
    }
  },

  noop() {},

  goNewFeedback() {
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1];
    const route = (cur && cur.route) || '';
    const url = `/pages/user/feedback/index?reset=1&focus_form=1&t=${Date.now()}`;
    if (route.indexOf('user/feedback/index') >= 0) {
      wx.redirectTo({ url });
    } else {
      wx.navigateTo({ url });
    }
  },

  pickDietitianIdFromRecord(obj) {
    if (!obj || typeof obj !== 'object') return '';
    const candidates = [obj.dietitian_id, obj.dietitianId, obj.id, obj.dietitianID];
    for (let i = 0; i < candidates.length; i++) {
      const s = String(candidates[i] == null ? '' : candidates[i]).trim();
      if (s) return s;
    }
    return '';
  },

  getDietitianContextSync() {
    const plan = wx.getStorageSync('currentDietPlan') || {};
    const sel = wx.getStorageSync('selectedDietitian') || {};
    const planId = String(plan.id || plan.plan_id || '').trim();
    let dietitianId = this.pickDietitianIdFromRecord(plan);
    if (!dietitianId) {
      dietitianId = this.pickDietitianIdFromRecord(sel);
    }
    return { planId, dietitianId };
  },

  applyListFilter() {
    const all = this.data.myFeedbacksAll || [];
    const mode = this.data.primaryTypeFilter || 'all';
    const ctx = this.getDietitianContextSync();
    const planId = ctx.planId;
    const syncDid = String(ctx.dietitianId || '').trim();
    const resolved = String(this.data.resolvedDietitianId || '').trim();
    const did = syncDid || resolved;
    const kw = String(this.data.searchKeyword || '').trim().toLowerCase();

    let out = all.slice();
    if (mode !== 'all') {
      out = out.filter((x) => String(x.category || '').trim() === mode);
    }
    if (this.data.onlyPending) {
      out = out.filter((x) => String(x.status || '').trim() === 'pending');
    }
    if (this.data.onlyCurrentPlan) {
      out = planId ? out.filter((x) => String(x.related_plan_id || '').trim() === planId) : [];
    }
    if (this.data.onlyCurrentDietitian) {
      out = did ? out.filter((x) => {
        const target = String(x.target_dietitian_id || '').trim();
        if (target) return target === did;
        if (String(x.category || '').trim() === 'dietitian_service') return true;
        if (planId && String(x.related_plan_id || '').trim() === planId) return true;
        return false;
      }) : [];
    }
    if (kw) {
      out = out.filter((x) => {
        const haystack = String(
          (x.title || '') + ' ' +
          (x.content_preview || '') + ' ' +
          (x.last_reply_preview || '') + ' ' +
          (x.category_label || '')
        ).toLowerCase();
        return haystack.indexOf(kw) >= 0;
      });
    }
    out.sort((a, b) => {
      const ta = a && a._updated_ts ? a._updated_ts : 0;
      const tb = b && b._updated_ts ? b._updated_ts : 0;
      return this.data.sortOrder === 'asc' ? ta - tb : tb - ta;
    });

    if (this.data.onlyCurrentDietitian && !did) {
      this.resolveDietitianFromServiceIfNeeded();
    }

    this.setData({
      displayedFeedbacks: out,
      filterContextPlanId: planId,
      filterContextDietitianId: did
    });

    const id = this.data.expandedFeedbackId;
    const vis = out.some((x) => x.feedback_id === id);
    if (id && !vis) {
      this.setData({
        expandedFeedbackId: '',
        expandedDetail: null,
        expandedLoading: false
      });
    }
  },

  /** 当计划/选中规划师未带 dietitian_id 时，用最近一次「已通过」服务申请的规划师补全 */
  resolveDietitianFromServiceIfNeeded() {
    const ctx = this.getDietitianContextSync();
    if (ctx.dietitianId) {
      if (this.data.resolvedDietitianId) {
        this.setData({ resolvedDietitianId: '' }, () => this.applyListFilter());
      }
      return;
    }
    if (!wx.getStorageSync('token')) return;
    api.serviceRequest
      .getList()
      .then((res) => {
        if (res.code !== 200 || !Array.isArray(res.data)) return;
        let best = '';
        let bestTs = 0;
        res.data.forEach((r) => {
          if (!r || String(r.status || '').toLowerCase() !== 'approved') return;
          const id = String(r.dietitian_id || '').trim();
          if (!id) return;
          const ts = tsFromRequestRow(r);
          if (ts >= bestTs) {
            bestTs = ts;
            best = id;
          }
        });
        const next = best || '';
        if (next === String(this.data.resolvedDietitianId || '').trim()) return;
        this.setData({ resolvedDietitianId: next }, () => {
          this.applyListFilter();
        });
      })
      .catch(() => {});
  },

  onPrimaryTypeTap(e) {
    const f = e.currentTarget.dataset.f;
    if (!f || f === this.data.primaryTypeFilter) return;
    this.setData({ primaryTypeFilter: f });
    this.applyListFilter();
  },

  onSortTap() {
    this.setData({
      sortOrder: this.data.sortOrder === 'asc' ? 'desc' : 'asc'
    });
    this.applyListFilter();
  },

  onSearchInput(e) {
    const v = e.detail.value || '';
    this.setData({ searchKeyword: v });
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
    }
    this._searchDebounceTimer = setTimeout(() => {
      this.applyListFilter();
    }, 250);
  },

  toggleAdvancedFilters() {
    this.setData({ showAdvancedFilters: !this.data.showAdvancedFilters });
  },

  onToggleAdvancedFilter(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    if (key === 'plan') {
      this.setData({ onlyCurrentPlan: !this.data.onlyCurrentPlan });
    } else if (key === 'dietitian') {
      this.setData({ onlyCurrentDietitian: !this.data.onlyCurrentDietitian });
    } else if (key === 'pending') {
      this.setData({ onlyPending: !this.data.onlyPending });
    }
    this.applyListFilter();
  },

  onResetListFilters() {
    this.setData({
      searchKeyword: '',
      primaryTypeFilter: 'all',
      sortOrder: 'desc',
      showAdvancedFilters: false,
      onlyCurrentPlan: false,
      onlyCurrentDietitian: false,
      onlyPending: false
    });
    this.applyListFilter();
  },

  loadMyFeedbacks() {
    if (!wx.getStorageSync('token')) {
      this.setData({
        myFeedbacksAll: [],
        displayedFeedbacks: [],
        myFeedbacksLoading: false
      });
      return;
    }
    this.setData({ myFeedbacksLoading: true });
    api.feedback
      .listUser()
      .then((res) => {
        if (res.code !== 200) {
          wx.showToast({ title: res.message || '加载反馈列表失败', icon: 'none' });
          return;
        }
        const raw = res.data || [];
        const myFeedbacksAll = raw.map((item) => {
          const pill = replyPillFromStatus(item.status);
          const ts = new Date(item.updated_at || item.created_at || 0).getTime();
          return {
            ...item,
            updated_at_text: formatDt(item.updated_at),
            _updated_ts: isNaN(ts) ? 0 : ts,
            reply_pill_text: pill.text,
            reply_pill_class: pill.cls
          };
        });
        this.setData({ myFeedbacksAll });
        this.applyListFilter();
        this.resolveDietitianFromServiceIfNeeded();
        const exp = this.data.expandedFeedbackId;
        if (exp) {
          this.loadExpandedDetail(exp);
        }
      })
      .catch(() => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      })
      .finally(() => {
        this.setData({ myFeedbacksLoading: false });
      });
  },

  loadExpandedDetail(id) {
    if (!id || !wx.getStorageSync('token')) return;
    this.setData({ expandedLoading: true, expandedDetail: null });
    api.feedback
      .detailUser(id)
      .then((res) => {
        if (res.code !== 200 || !res.data) {
          wx.showToast({ title: (res && res.message) || '加载详情失败', icon: 'none' });
          this.setData({ expandedLoading: false });
          return;
        }
        const d = res.data;
        const rpill = replyPillFromStatus(d.status);
        const expandedDetail = {
          ...d,
          created_at_text: formatDt(d.created_at),
          reply_pill_text: rpill.text,
          reply_pill_class: rpill.cls,
          replies: (d.replies || []).map((rp) => ({
            ...rp,
            created_at_text: formatDt(rp.created_at)
          }))
        };
        this.setData({ expandedDetail, expandedLoading: false });
      })
      .catch(() => {
        wx.showToast({ title: '网络异常', icon: 'none' });
        this.setData({ expandedLoading: false });
      });
  },

  onToggleFeedback(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    if (this.data.expandedFeedbackId === id) {
      this.setData({
        expandedFeedbackId: '',
        expandedDetail: null,
        expandedLoading: false,
        expandedReplyText: '',
        expandedReplySubmitting: false
      });
      return;
    }
    this.setData({
      expandedFeedbackId: id,
      expandedReplyText: '',
      expandedReplySubmitting: false
    });
    this.loadExpandedDetail(id);
  },

  onExpandedReplyInput(e) {
    this.setData({ expandedReplyText: e.detail.value || '' });
  },

  submitExpandedReply() {
    const feedbackId = this.data.expandedFeedbackId;
    if (!feedbackId || this.data.expandedReplySubmitting) return;
    const body = String(this.data.expandedReplyText || '').trim();
    if (!body) {
      wx.showToast({ title: '请输入回复内容', icon: 'none' });
      return;
    }
    this.setData({ expandedReplySubmitting: true });
    api.feedback
      .replyUser(feedbackId, { body })
      .then((res) => {
        if (res.code !== 200) {
          wx.showToast({ title: res.message || '发送失败', icon: 'none' });
          return;
        }
        this.setData({ expandedReplyText: '' });
        wx.showToast({ title: '已发送', icon: 'success' });
        this.loadExpandedDetail(feedbackId);
        this.loadMyFeedbacks();
      })
      .catch((err) => {
        const msg =
          (err && err.data && err.data.message) ||
          (err && err.errMsg) ||
          '网络异常，请重试';
        wx.showToast({ title: String(msg), icon: 'none', duration: 2600 });
      })
      .finally(() => {
        this.setData({ expandedReplySubmitting: false });
      });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/auth/login/login' });
  },

  onPickCategory(e) {
    if (this.data.categoryLocked) return;
    const cat = e.currentTarget.dataset.cat;
    if (!cat || cat === this.data.category) return;
    this.setData({ category: cat });
    if (cat === 'diet_plan' && !this.data.planLocked && !this.data.planOptions.length && !this.data.plansLoading) {
      this.loadPlans();
    }
    if (cat === 'dietitian_service' && !this.data.dietitianOptions.length && !this.data.dietitiansLoading) {
      this.loadDietitians();
    }
  },

  loadPlans() {
    if (!wx.getStorageSync('token')) return;
    this.setData({ plansLoading: true });
    api.dietPlan
      .getUserPlans()
      .then((res) => {
        if (res.code !== 200) {
          wx.showToast({ title: res.message || '加载计划失败', icon: 'none' });
          return;
        }
        const raw = res.data || [];
        const published = raw.filter((p) => p && String(p.status).toLowerCase() === 'published');
        const planOptions = published.map((p) => ({
          id: p.id || p.plan_id,
          title: (p.title && String(p.title).trim()) || '未命名计划'
        }));
        const planPickerLabels = planOptions.map((p) => p.title);
        let planPickerIndex = 0;
        if (this.data.relatedPlanId) {
          const idx = planOptions.findIndex((p) => p.id === this.data.relatedPlanId);
          if (idx >= 0) planPickerIndex = idx;
        }
        this.setData({
          planOptions,
          planPickerLabels,
          planPickerIndex: planPickerLabels.length ? planPickerIndex : 0
        });
      })
      .catch(() => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      })
      .finally(() => {
        this.setData({ plansLoading: false });
      });
  },

  loadDietitians() {
    if (!wx.getStorageSync('token')) return;
    this.setData({ dietitiansLoading: true });
    api.serviceRequest
      .getList()
      .then((res) => {
        if (res.code !== 200) {
          wx.showToast({ title: res.message || '加载失败', icon: 'none' });
          return;
        }
        const list = res.data || [];
        const map = {};
        list.forEach((r) => {
          if (!r || String(r.status).toLowerCase() !== 'approved') return;
          const did = r.dietitian_id;
          if (!did || map[did]) return;
          const name = (r.dietitian_name && String(r.dietitian_name).trim()) || did;
          map[did] = { dietitian_id: did, name };
        });
        const dietitianOptions = Object.keys(map).map((k) => map[k]);
        const dietitianPickerLabels = dietitianOptions.map((d) => d.name);
        this.setData({
          dietitianOptions,
          dietitianPickerLabels,
          dietitianIndex: dietitianOptions.length ? 0 : 0
        });
      })
      .catch(() => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      })
      .finally(() => {
        this.setData({ dietitiansLoading: false });
      });
  },

  onPlanPickerChange(e) {
    const v = parseInt(e.detail.value, 10);
    if (!isNaN(v)) this.setData({ planPickerIndex: v });
  },

  onDietitianPickerChange(e) {
    const v = parseInt(e.detail.value, 10);
    if (!isNaN(v)) this.setData({ dietitianIndex: v });
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  onStarTap(e) {
    const n = parseInt(e.currentTarget.dataset.n, 10);
    if (!isNaN(n)) this.setData({ rating: n });
  },

  clearRating() {
    this.setData({ rating: 0 });
  },

  onSubmit() {
    if (this.data.submitting) return;
    if (!wx.getStorageSync('token')) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    const title = String(this.data.title || '').trim();
    const content = String(this.data.content || '').trim();
    if (!title) {
      wx.showToast({ title: '请填写标题', icon: 'none' });
      return;
    }
    if (!content) {
      wx.showToast({ title: '请填写正文', icon: 'none' });
      return;
    }

    const cat = this.data.category;
    const payload = { category: cat, title, content };

    if (this.data.rating > 0) {
      payload.rating = this.data.rating;
    }

    if (cat === 'diet_plan') {
      let pid = '';
      if (this.data.planLocked) {
        pid = this.data.relatedPlanId;
      } else {
        const opt = this.data.planOptions[this.data.planPickerIndex];
        pid = opt && opt.id ? opt.id : '';
      }
      if (!pid) {
        wx.showToast({ title: '请选择膳食计划', icon: 'none' });
        return;
      }
      payload.related_plan_id = pid;
    } else if (cat === 'dietitian_service') {
      const d = this.data.dietitianOptions[this.data.dietitianIndex];
      if (!d || !d.dietitian_id) {
        wx.showToast({ title: '请选择规划师', icon: 'none' });
        return;
      }
      payload.target_dietitian_id = d.dietitian_id;
    }

    this.setData({ submitting: true });
    api.feedback
      .submit(payload)
      .then((res) => {
        if (res.code === 200) {
          this.setData({
            title: '',
            content: '',
            rating: 0,
            expandedFeedbackId: '',
            expandedDetail: null
          });
          this.loadMyFeedbacks();
          wx.showToast({ title: '已提交', icon: 'success' });
        } else {
          wx.showToast({ title: res.message || '提交失败', icon: 'none', duration: 2800 });
        }
      })
      .catch((err) => {
        const msg =
          (err && err.data && err.data.message) ||
          (err && err.errMsg) ||
          '网络异常，请重试';
        wx.showToast({ title: String(msg), icon: 'none', duration: 2800 });
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  }
});
