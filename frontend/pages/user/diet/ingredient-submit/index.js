const api = require('../../../../utils/api');

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

  submit() {
    if (this.data.submitting) return;
    const form = this.data.form;
    if (!form.name || !form.category) {
      wx.showToast({ title: '请填写食材名称和类别', icon: 'none' });
      return;
    }
    if (!form.calorie_100g || !form.protein || !form.carbohydrate || !form.fat) {
      wx.showToast({ title: '请完整填写营养信息', icon: 'none' });
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      calorie_100g: parseFloat(form.calorie_100g),
      nutrition_100g: {
        protein: parseFloat(form.protein),
        carbohydrate: parseFloat(form.carbohydrate),
        fat: parseFloat(form.fat)
      },
      unit: form.unit || 'g',
      gram_per_unit: parseFloat(form.gram_per_unit) || 100
    };
    this.setData({ submitting: true });
    const submitPromise = this.data.isResubmitMode
      ? api.ingredient.resubmitSubmission(this.data.resubmitSubmissionId, payload)
      : api.ingredient.submitIngredient(payload);

    submitPromise
      .then((res) => {
        if (res.code === 200) {
          wx.setStorageSync('ingredientSubmitRefreshFlag', {
            shouldRefresh: true,
            keyword: payload.name
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
  }
});
