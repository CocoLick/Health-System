const api = require('../../../../utils/api');

const NAME_MAX_LEN = 64;
const UNIT_MAX_LEN = 16;
const CALORIE_MAX = 1000;
const MACRO_MAX = 100;
const GRAM_PER_UNIT_MAX = 50000;

function parseNutNumber(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

Page({
  data: {
    categoryOptions: ['主食', '蛋白质', '蔬菜', '水果', '乳制品', '豆制品', '坚果', '其他'],
    categoryIndex: -1,
    form: {
      name: '',
      category: '',
      calorie_100g: '',
      protein: '',
      carbohydrate: '',
      fat: '',
      unit: 'g',
      gram_per_unit: '100'
    },
    autoCalcCalories: 0,
    deltaRatio: 0,
    autoCalcCaloriesText: '0.0',
    deltaRatioText: '0.0',
    checkResult: '',
    checkResultClass: '',
    submitting: false,
    isResubmitMode: false,
    resubmitSubmissionId: '',
    returnReason: ''
  },

  onLoad(options) {
    if (options && options.name) {
      this.setData({ 'form.name': decodeURIComponent(options.name) });
    }
    if (options && options.mode === 'resubmit' && options.submission_id) {
      const draft = wx.getStorageSync('ingredientResubmitDraft');
      if (draft && draft.submission_id === options.submission_id) {
        const categoryIndex = this.data.categoryOptions.indexOf(draft.submitted_category);
        this.setData({
          isResubmitMode: true,
          resubmitSubmissionId: draft.submission_id || '',
          returnReason: draft.review_note || '',
          categoryIndex: categoryIndex >= 0 ? categoryIndex : -1,
          form: {
            name: draft.submitted_name || '',
            category: draft.submitted_category || '',
            calorie_100g: String(draft.submitted_calories_per_100g || ''),
            protein: String((draft.submitted_nutrition_100g && draft.submitted_nutrition_100g.protein) || ''),
            carbohydrate: String((draft.submitted_nutrition_100g && draft.submitted_nutrition_100g.carbohydrate) || ''),
            fat: String((draft.submitted_nutrition_100g && draft.submitted_nutrition_100g.fat) || ''),
            unit: draft.submitted_unit || 'g',
            gram_per_unit: String(draft.submitted_gram_per_unit || 100)
          }
        }, () => this.updateAutoCheck());
      }
    }
  },

  onCategoryChange(e) {
    const categoryIndex = Number(e.detail.value);
    const category = this.data.categoryOptions[categoryIndex] || '';
    this.setData({
      categoryIndex,
      'form.category': category
    });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value }, () => this.updateAutoCheck());
  },

  updateAutoCheck() {
    const form = this.data.form;
    const protein = parseFloat(form.protein) || 0;
    const carbohydrate = parseFloat(form.carbohydrate) || 0;
    const fat = parseFloat(form.fat) || 0;
    const calorie = parseFloat(form.calorie_100g) || 0;
    const autoCalcCalories = protein * 4 + carbohydrate * 4 + fat * 9;
    if (!calorie) {
      this.setData({
        autoCalcCalories,
        deltaRatio: 0,
        autoCalcCaloriesText: autoCalcCalories.toFixed(1),
        deltaRatioText: '0.0',
        checkResult: '',
        checkResultClass: ''
      });
      return;
    }
    const deltaRatio = Math.abs(calorie - autoCalcCalories) / calorie;
    let checkResult = '正常';
    if (deltaRatio > 0.2) {
      checkResult = '异常';
    }
    this.setData({
      autoCalcCalories,
      deltaRatio,
      autoCalcCaloriesText: autoCalcCalories.toFixed(1),
      deltaRatioText: (deltaRatio * 100).toFixed(1),
      checkResult,
      checkResultClass: checkResult === '异常' ? 'warn' : ''
    });
  },

  validateForm(form) {
    const name = (form.name || '').trim();
    if (!name) {
      return { ok: false, message: '请填写食材名称' };
    }
    if (name.length > NAME_MAX_LEN) {
      return { ok: false, message: `食材名称请控制在${NAME_MAX_LEN}字以内` };
    }
    if (!form.category) {
      return { ok: false, message: '请选择食材类别' };
    }

    const calorie = parseNutNumber(form.calorie_100g);
    if (calorie === null) {
      return { ok: false, message: '请填写有效的热量数值' };
    }
    if (calorie < 0 || calorie > CALORIE_MAX) {
      return { ok: false, message: `热量需在 0～${CALORIE_MAX} kcal/100g 之间` };
    }

    const protein = parseNutNumber(form.protein);
    const carbohydrate = parseNutNumber(form.carbohydrate);
    const fat = parseNutNumber(form.fat);
    if (protein === null || carbohydrate === null || fat === null) {
      return { ok: false, message: '请填写有效的蛋白质、碳水、脂肪数值' };
    }
    if (protein < 0 || protein > MACRO_MAX) {
      return { ok: false, message: `蛋白质需在 0～${MACRO_MAX} g/100g 之间` };
    }
    if (carbohydrate < 0 || carbohydrate > MACRO_MAX) {
      return { ok: false, message: `碳水需在 0～${MACRO_MAX} g/100g 之间` };
    }
    if (fat < 0 || fat > MACRO_MAX) {
      return { ok: false, message: `脂肪需在 0～${MACRO_MAX} g/100g 之间` };
    }

    const macroSum = protein + carbohydrate + fat;
    if (macroSum > MACRO_MAX + 0.01) {
      return { ok: false, message: '蛋白质+碳水+脂肪合计不应超过每100g可食部重量' };
    }

    const unit = (form.unit || '').trim();
    if (!unit) {
      return { ok: false, message: '请填写计量单位' };
    }
    if (unit.length > UNIT_MAX_LEN) {
      return { ok: false, message: `计量单位请控制在${UNIT_MAX_LEN}字以内` };
    }

    const gpu = parseNutNumber(form.gram_per_unit);
    if (gpu === null || gpu <= 0) {
      return { ok: false, message: '每单位克数需为大于 0 的数字' };
    }
    if (gpu > GRAM_PER_UNIT_MAX) {
      return { ok: false, message: `每单位克数请勿超过 ${GRAM_PER_UNIT_MAX}` };
    }

    return {
      ok: true,
      payload: {
        name,
        category: form.category.trim(),
        calorie_100g: calorie,
        nutrition_100g: {
          protein,
          carbohydrate,
          fat
        },
        unit,
        gram_per_unit: gpu
      }
    };
  },

  runSubmitRequest(payload) {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    const submitPromise = this.data.isResubmitMode
      ? api.ingredient.resubmitSubmission(this.data.resubmitSubmissionId, payload)
      : api.ingredient.submitIngredient(payload);

    submitPromise
      .then((res) => {
        if (res.code === 200) {
          wx.setStorageSync('ingredientSubmitRefreshFlag', {
            shouldRefresh: true,
            pendingAudit: true
          });
          wx.removeStorageSync('ingredientResubmitDraft');
          wx.showToast({ title: this.data.isResubmitMode ? '重提成功' : '提交成功', icon: 'success' });
          setTimeout(() => {
            wx.navigateBack();
          }, 700);
          return;
        }
        wx.showToast({ title: res.message || '提交失败', icon: 'none' });
      })
      .catch(() => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  },

  submit() {
    if (this.data.submitting) return;
    const form = this.data.form;
    const v = this.validateForm(form);
    if (!v.ok) {
      wx.showToast({ title: v.message, icon: 'none' });
      return;
    }
    if (this.data.checkResult === '异常') {
      wx.showModal({
        title: '请核对',
        content: '热量与根据蛋白质、碳水、脂肪推算的热量偏差较大，请确认是否填写正确。',
        confirmText: '仍要提交',
        cancelText: '返回修改',
        success: (res) => {
          if (res.confirm) {
            this.runSubmitRequest(v.payload);
          }
        }
      });
      return;
    }
    this.runSubmitRequest(v.payload);
  }
});
