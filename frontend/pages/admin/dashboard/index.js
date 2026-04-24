// admin/dashboard/index.js
const api = require('../../../utils/api');

function displayStatusFromDB(st) {
  const s = st == null ? '' : String(st).trim();
  return s === '禁用' ? '已禁用' : '正常';
}

const ROLE_LABEL = { user: '普通用户', dietitian: '规划师', admin: '管理员' };

function mapAdminUserRow(u) {
  return {
    user_id: u.user_id,
    username: u.username || '—',
    usernameInitial: (u.username || '?').charAt(0),
    role: ROLE_LABEL[u.role_type] || u.role_type || '—',
    roleType: u.role_type,
    status: displayStatusFromDB(u.status),
    canToggle: u.role_type !== 'admin'
  };
}

Page({
  data: {
    activeTab: 'home',
    auditSubTab: 'plans',
    manageSubTab: 'users',
    showAddDietitianModal: false,
    showAddNutritionModal: false,
    showPersonalCenterModal: false,
    statusOptions: ['启用', '禁用'],
    statusIndex: 0,
    formError: '',
    newDietitian: {
      username: '',
      name: '',
      title: '',
      specialty: '',
      contact: '',
      password: ''
    },
    newNutrition: {
      name: '',
      category: '其他',
      protein: '',
      carbohydrate: '',
      fat: '',
      unit: 'g',
      gramPerUnit: '100',
      calories: '0'
    },
    dietitians: [],
    nutritionItems: [],
    categories: ['全部', '主食', '蛋白质', '水果', '蔬菜', '其他'],
    selectedCategory: '全部',
    currentPage: 1,
    pageSize: 10,
    pageSizeOptions: [10, 20, 50, 100],
    pageSizeIndex: 0,
    total: 0,
    totalPages: 1,
    showTabHint: false,
    hasMoreTabs: true,
    stats: {
      userCount: 0,
      dietitianCount: 15,
      pendingPlans: 3,
      pendingArticles: 2,
      todayUsers: 12,
      activeUsers: 86,
      completedPlans: 45,
      likedArticles: 230
    },
    recentActivities: [
      {
        icon: '👤',
        text: '新用户注册：张三',
        time: '2小时前'
      },
      {
        icon: '📋',
        text: '规划师提交新膳食计划',
        time: '4小时前'
      },
      {
        icon: '📄',
        text: '规划师发布健康文章',
        time: '6小时前'
      },
      {
        icon: '💬',
        text: '用户提交反馈：系统功能建议',
        time: '1天前'
      }
    ],
    notices: [
      {
        title: '系统更新通知',
        content: '系统将于明天凌晨2点进行维护更新，预计持续1小时',
        time: '今天 09:30'
      },
      {
        title: '安全提醒',
        content: '请及时更新管理员密码，确保系统安全',
        time: '昨天 15:45'
      }
    ],
    pendingPlans: [
      {
        id: 1,
        title: '减脂膳食计划',
        user: '张三',
        dietitian: '张医生',
        submitTime: '2026-04-18 09:30'
      },
      {
        id: 2,
        title: '控糖膳食计划',
        user: '李四',
        dietitian: '王医生',
        submitTime: '2026-04-18 10:15'
      }
    ],
    pendingArticles: [
      {
        id: 1,
        title: '科学饮食与健康生活',
        dietitian: '张医生',
        category: '饮食健康',
        preview: '本文将介绍科学饮食的重要性...'
      },
      {
        id: 2,
        title: '营养素的重要作用',
        dietitian: '王医生',
        category: '营养知识',
        preview: '营养素是人体必需的物质...'
      }
    ],
    pendingPlansCount: 2,
    pendingArticlesCount: 2,
    auditHistory: [
      {
        id: 1,
        title: '高血压患者膳食计划',
        type: '膳食计划',
        status: '通过',
        auditTime: '2026-04-17 16:30'
      },
      {
        id: 2,
        title: '如何正确补充蛋白质',
        type: '健康文章',
        status: '驳回',
        auditTime: '2026-04-17 15:45'
      }
    ],
    users: [],
    feedbacks: [
      {
        id: 1,
        title: '建议增加更多食谱',
        content: '希望能增加更多的健康食谱供用户选择...',
        status: '待处理',
        time: '2026-04-18 10:00'
      }
    ]
  },

  onLoad() {
    this.loadSystemStats();
    this.loadDietitians();
    this.loadUsers();
    this.loadNutritionItems();

    // 检查是否首次访问管理中心
    this.checkFirstVisit();
  },

  onShow() {
    this.loadUsers();
  },

  checkFirstVisit() {
    const hasVisitedManage = wx.getStorageSync('has_visited_manage');
    if (!hasVisitedManage) {
      // 首次访问，显示提示
      this.setData({
        showTabHint: true
      });
    }
  },

  hideTabHint() {
    // 隐藏提示并标记已访问
    this.setData({
      showTabHint: false
    });
    wx.setStorageSync('has_visited_manage', true);
  },

  onTabsScroll(e) {
    const { scrollLeft, scrollWidth, clientWidth } = e.detail;
    // 当滚动到接近右侧时，隐藏滚动指示器
    if (scrollWidth - scrollLeft - clientWidth < 50) {
      this.setData({
        hasMoreTabs: false
      });
    } else {
      this.setData({
        hasMoreTabs: true
      });
    }
  },

  loadSystemStats() {
    console.log('加载系统统计数据');
  },

  loadUsers() {
    api.admin
      .getAllUsers()
      .then((res) => {
        if (res.code === 200 || res.code === '200') {
          const raw = Array.isArray(res.data) ? res.data : [];
          const users = raw.map(mapAdminUserRow);
          this.setData({
            users,
            'stats.userCount': users.length
          });
        }
      })
      .catch((err) => {
        this.setData({ users: [] });
        const code = err && (err.statusCode != null ? err.statusCode : err.status);
        if (code === 404) {
          wx.showToast({
            title: '用户列表接口 404：请先停止并重新 go run 后端，再打开本页',
            icon: 'none',
            duration: 3500
          });
        }
      });
  },

  loadDietitians() {
    api.admin.getAllDietitians()
      .then(res => {
        if (res.code === 200 || res.code === '200') {
          const list = res.data || [];
          const dietitians = list.map(item => ({
            ...item,
            nameInitial: (item.name || item.username || '?').charAt(0),
            dietitian_id: item.user_id,
            displayName: item.name || item.username
          }));
          this.setData({
            dietitians: dietitians,
            'stats.dietitianCount': dietitians.length
          });
        }
      })
      .catch(() => {
        this.setData({
          dietitians: [{
            dietitian_id: 'D20260325001',
            username: 'D20260325001',
            name: '张医生',
            displayName: '张医生',
            nameInitial: '张',
            title: '营养师',
            specialty: '临床营养',
            contact: '13800138002',
            status: '启用'
          }]
        });
      });
  },

  loadNutritionItems() {
    console.log('加载食材数据');
    const { selectedCategory, currentPage, pageSize } = this.data;
    const category = selectedCategory === '全部' ? '' : selectedCategory;

    api.ingredient.getList({ category, page: currentPage, page_size: pageSize })
      .then(res => {
        if (res.code === 200) {
          const ingredients = res.data.ingredients || [];
          const nutritionItems = ingredients.map(item => ({
            id: item.ingredient_id,
            name: item.name,
            category: item.category,
            protein: item.nutrition_100g.protein,
            carbohydrate: item.nutrition_100g.carbohydrate,
            fat: item.nutrition_100g.fat,
            unit: item.unit,
            gramPerUnit: item.gram_per_unit,
            calories: item.calorie_100g
          }));
          const total = res.data.total || 0;
          const totalPages = Math.ceil(total / pageSize);
          this.setData({
            nutritionItems: nutritionItems,
            total: total,
            totalPages: totalPages
          });
        }
      })
      .catch(() => {
        console.log('加载食材数据失败，使用默认数据');
      });
  },

  showAddDietitianForm() {
    this.setData({
      showAddDietitianModal: true,
      formError: '',
      newDietitian: {
        username: '',
        name: '',
        title: '',
        specialty: '',
        contact: '',
        password: ''
      },
      statusIndex: 0
    });
  },

  hideAddDietitianForm() {
    this.setData({
      showAddDietitianModal: false,
      formError: ''
    });
  },

  showPersonalCenter() {
    this.setData({
      showPersonalCenterModal: true
    });
  },

  hidePersonalCenter() {
    this.setData({
      showPersonalCenterModal: false
    });
  },

  stopPropagation() { },

  bindDietitianUsername(e) {
    this.setData({
      'newDietitian.username': e.detail.value
    });
  },

  bindDietitianName(e) {
    this.setData({
      'newDietitian.name': e.detail.value
    });
  },

  bindDietitianTitle(e) {
    this.setData({
      'newDietitian.title': e.detail.value
    });
  },

  bindDietitianSpecialty(e) {
    this.setData({
      'newDietitian.specialty': e.detail.value
    });
  },

  bindDietitianContact(e) {
    this.setData({
      'newDietitian.contact': e.detail.value
    });
  },

  bindDietitianPassword(e) {
    this.setData({
      'newDietitian.password': e.detail.value
    });
  },

  bindDietitianStatusChange(e) {
    this.setData({
      statusIndex: e.detail.value
    });
  },

  confirmAddDietitian() {
    const { username, name, title, specialty, contact, password } = this.data.newDietitian;
    const status = this.data.statusOptions[this.data.statusIndex];

    if (!username) {
      this.setData({ formError: '请输入用户名' });
      return;
    }
    if (!name) {
      this.setData({ formError: '请输入真实姓名' });
      return;
    }
    if (!title) {
      this.setData({ formError: '请输入职称' });
      return;
    }
    if (!specialty) {
      this.setData({ formError: '请输入专业领域' });
      return;
    }
    if (!contact) {
      this.setData({ formError: '请输入联系方式' });
      return;
    }
    if (!password || password.length < 6) {
      this.setData({ formError: '密码至少6位' });
      return;
    }

    api.admin.createDietitian({
      username: username,
      name: name,
      title: title,
      specialty: specialty,
      contact: contact,
      password: password,
      status: status
    })
      .then(res => {
        if (res.code === 200) {
          wx.showToast({
            title: '添加成功',
            icon: 'success'
          });
          this.hideAddDietitianForm();
          this.loadDietitians();
        } else {
          this.setData({ formError: res.message || '添加失败' });
        }
      })
      .catch(() => {
        const newDietitian = {
          dietitian_id: 'D' + Date.now(),
          username: username,
          name: name,
          displayName: name,
          nameInitial: name.charAt(0),
          title: title,
          specialty: specialty,
          contact: contact,
          status: status
        };
        this.setData({
          dietitians: [...this.data.dietitians, newDietitian]
        });
        wx.showToast({
          title: '添加成功（模拟）',
          icon: 'success'
        });
        this.hideAddDietitianForm();
      });
  },

  toggleDietitianStatus(e) {
    const index = e.currentTarget.dataset.index;
    const dietitians = [...this.data.dietitians];
    const dietitian = dietitians[index];
    const newStatus = dietitian.status === '启用' ? '禁用' : '启用';

    api.admin.updateDietitianStatus(dietitian.dietitian_id, newStatus)
      .then((res) => {
        if (res.code === 200 || res.code === '200') {
          this.loadDietitians();
          wx.showToast({
            title: newStatus === '启用' ? '已启用' : '已禁用',
            icon: 'success'
          });
        } else {
          wx.showToast({ title: res.message || '操作失败', icon: 'none' });
        }
      })
      .catch(() => {
        dietitian.status = newStatus;
        this.setData({ dietitians: dietitians });
        wx.showToast({
          title: newStatus === '启用' ? '已启用（本地）' : '已禁用（本地）',
          icon: 'none'
        });
      });
  },

  deleteDietitian(e) {
    const index = e.currentTarget.dataset.index;
    const dietitians = [...this.data.dietitians];
    const dietitian = dietitians[index];

    wx.showModal({
      title: '确认删除',
      content: '确定要删除该规划师吗？',
      success: (res) => {
        if (res.confirm) {
          api.admin.deleteDietitian(dietitian.dietitian_id)
            .then(res => {
              if (res.code === 200) {
                dietitians.splice(index, 1);
                this.setData({
                  dietitians: dietitians,
                  'stats.dietitianCount': dietitians.length
                });
                wx.showToast({
                  title: '已删除',
                  icon: 'success'
                });
              }
            })
            .catch(() => {
              dietitians.splice(index, 1);
              this.setData({
                dietitians: dietitians,
                'stats.dietitianCount': dietitians.length
              });
              wx.showToast({
                title: '已删除（模拟）',
                icon: 'success'
              });
            });
        }
      }
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
  },

  switchAuditSubTab(e) {
    const subtab = e.currentTarget.dataset.subtab;
    this.setData({
      auditSubTab: subtab
    });
  },

  switchManageSubTab(e) {
    const subtab = e.currentTarget.dataset.subtab;
    this.setData({
      manageSubTab: subtab
    });
  },

  approvePlan(e) {
    const index = e.currentTarget.dataset.index;
    const plans = [...this.data.pendingPlans];
    plans.splice(index, 1);
    this.setData({
      pendingPlans: plans,
      pendingPlansCount: plans.length
    });
    wx.showToast({
      title: '审核通过',
      icon: 'success'
    });
  },

  rejectPlan(e) {
    const index = e.currentTarget.dataset.index;
    const plans = [...this.data.pendingPlans];
    plans.splice(index, 1);
    this.setData({
      pendingPlans: plans,
      pendingPlansCount: plans.length
    });
    wx.showToast({
      title: '审核驳回',
      icon: 'success'
    });
  },

  approveArticle(e) {
    const index = e.currentTarget.dataset.index;
    const articles = [...this.data.pendingArticles];
    articles.splice(index, 1);
    this.setData({
      pendingArticles: articles,
      pendingArticlesCount: articles.length
    });
    wx.showToast({
      title: '审核通过',
      icon: 'success'
    });
  },

  rejectArticle(e) {
    const index = e.currentTarget.dataset.index;
    const articles = [...this.data.pendingArticles];
    articles.splice(index, 1);
    this.setData({
      pendingArticles: articles,
      pendingArticlesCount: articles.length
    });
    wx.showToast({
      title: '审核驳回',
      icon: 'success'
    });
  },

  editUser(e) {
    const index = e.currentTarget.dataset.index;
    const user = this.data.users[index];
    console.log('编辑用户:', user);
    wx.showToast({
      title: '编辑功能开发中',
      icon: 'none'
    });
  },

  toggleUserStatus(e) {
    const index = e.currentTarget.dataset.index;
    const users = [...this.data.users];
    const user = users[index];
    if (!user || !user.user_id) {
      return;
    }
    if (!user.canToggle) {
      wx.showToast({ title: '不能通过此处修改管理员账号', icon: 'none' });
      return;
    }
    const toApi = user.status === '正常' ? '禁用' : '启用';
    api.admin
      .updateUserStatus(user.user_id, toApi)
      .then((res) => {
        if (res.code === 200 || res.code === '200') {
          this.loadUsers();
          wx.showToast({ title: toApi === '启用' ? '已启用' : '已禁用', icon: 'success' });
        } else {
          wx.showToast({ title: res.message || '操作失败', icon: 'none' });
        }
      })
      .catch(() => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  replyFeedback(e) {
    const index = e.currentTarget.dataset.index;
    const feedback = this.data.feedbacks[index];
    console.log('回复反馈:', feedback);
    wx.showToast({
      title: '回复功能开发中',
      icon: 'none'
    });
  },

  markFeedback(e) {
    const index = e.currentTarget.dataset.index;
    const feedbacks = [...this.data.feedbacks];
    feedbacks[index].status = '已处理';
    this.setData({
      feedbacks: feedbacks
    });
    wx.showToast({
      title: '已标记为已处理',
      icon: 'success'
    });
  },

  navigateToSettings() {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none'
    });
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.redirectTo({
            url: '/pages/auth/login/login'
          });
        }
      }
    });
  },

  // 类别选择
  selectCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      selectedCategory: category,
      currentPage: 1 // 切换类别时重置到第一页
    });
    this.loadNutritionItems();
  },

  // 上一页
  prevPage() {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1
      });
      this.loadNutritionItems();
    }
  },

  // 下一页
  nextPage() {
    const { currentPage, totalPages } = this.data;
    if (currentPage < totalPages) {
      this.setData({
        currentPage: currentPage + 1
      });
      this.loadNutritionItems();
    }
  },

  // 页面大小改变
  changePageSize(e) {
    const pageSizeIndex = parseInt(e.detail.value);
    const pageSize = this.data.pageSizeOptions[pageSizeIndex];
    this.setData({
      pageSize: pageSize,
      pageSizeIndex: pageSizeIndex,
      currentPage: 1 // 改变页面大小时重置到第一页
    });
    this.loadNutritionItems();
  },

  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        wx.showToast({
          title: '头像已更新',
          icon: 'success'
        });
      }
    });
  },

  changePassword() {
    wx.showModal({
      title: '修改密码',
      content: '修改密码功能开发中',
      showCancel: false
    });
  },

  // 营养库管理相关函数
  showAddNutritionForm() {
    this.setData({
      showAddNutritionModal: true,
      formError: '',
      newNutrition: {
        name: '',
        calories: '',
        protein: '',
        carbohydrate: '',
        fat: ''
      }
    });
  },

  hideAddNutritionForm() {
    this.setData({
      showAddNutritionModal: false,
      formError: '',
      editingNutritionIndex: -1
    });
  },

  bindNutritionName(e) {
    this.setData({
      'newNutrition.name': e.detail.value
    });
  },

  bindNutritionCalories(e) {
    this.setData({
      'newNutrition.calories': e.detail.value
    });
  },

  bindNutritionProtein(e) {
    this.setData({
      'newNutrition.protein': e.detail.value
    });
    this.calculateCalories();
  },

  bindNutritionCarbohydrate(e) {
    this.setData({
      'newNutrition.carbohydrate': e.detail.value
    });
    this.calculateCalories();
  },

  bindNutritionFat(e) {
    this.setData({
      'newNutrition.fat': e.detail.value
    });
    this.calculateCalories();
  },

  bindNutritionCategory(e) {
    this.setData({
      'newNutrition.category': e.detail.value
    });
  },

  bindNutritionUnit(e) {
    this.setData({
      'newNutrition.unit': e.detail.value
    });
  },

  bindNutritionGramPerUnit(e) {
    this.setData({
      'newNutrition.gramPerUnit': e.detail.value
    });
  },

  calculateCalories() {
    const { protein, carbohydrate, fat } = this.data.newNutrition;
    if (protein && carbohydrate && fat && !isNaN(protein) && !isNaN(carbohydrate) && !isNaN(fat)) {
      const calories = parseFloat(protein) * 4 + parseFloat(carbohydrate) * 4 + parseFloat(fat) * 9;
      this.setData({
        'newNutrition.calories': calories.toFixed(1)
      });
    }
  },

  confirmAddNutrition() {
    const { name, category, protein, carbohydrate, fat, unit, gramPerUnit } = this.data.newNutrition;
    const editingIndex = this.data.editingNutritionIndex;

    if (!name) {
      this.setData({ formError: '请输入食物名称' });
      return;
    }
    if (!category) {
      this.setData({ formError: '请输入食材类别' });
      return;
    }
    if (!protein || isNaN(protein)) {
      this.setData({ formError: '请输入有效蛋白质' });
      return;
    }
    if (!carbohydrate || isNaN(carbohydrate)) {
      this.setData({ formError: '请输入有效碳水化合物' });
      return;
    }
    if (!fat || isNaN(fat)) {
      this.setData({ formError: '请输入有效脂肪' });
      return;
    }
    if (!unit) {
      this.setData({ formError: '请输入计量单位' });
      return;
    }

    const ingredientData = {
      name: name,
      category: category,
      nutrition_100g: {
        protein: parseFloat(protein),
        carbohydrate: parseFloat(carbohydrate),
        fat: parseFloat(fat)
      },
      unit: unit,
      gram_per_unit: parseFloat(gramPerUnit) || 100
    };

    if (editingIndex !== undefined && editingIndex >= 0) {
      // 编辑模式：更新现有食材
      const item = this.data.nutritionItems[editingIndex];

      wx.request({
        url: `http://localhost:8000/api/ingredients/${item.id}`,
        method: 'PUT',
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + wx.getStorageSync('token')
        },
        data: ingredientData,
        success: (res) => {
          if (res.statusCode === 200 && res.data.code === 200) {
            wx.showToast({
              title: '更新成功',
              icon: 'success'
            });
            this.hideAddNutritionForm();
            this.loadNutritionItems();
          } else {
            wx.showToast({
              title: '更新失败: ' + (res.data.message || '未知错误'),
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('更新食材失败:', err);
          wx.showToast({
            title: '网络错误，请稍后重试',
            icon: 'none'
          });
        }
      });
    } else {
      // 添加模式：创建新食材
      wx.request({
        url: 'http://localhost:8000/api/ingredients',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + wx.getStorageSync('token')
        },
        data: ingredientData,
        success: (res) => {
          if (res.statusCode === 200 && res.data.code === 200) {
            wx.showToast({
              title: '添加成功',
              icon: 'success'
            });
            this.hideAddNutritionForm();
            this.loadNutritionItems();
          } else {
            wx.showToast({
              title: '添加失败: ' + (res.data.message || '未知错误'),
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('添加食材失败:', err);
          wx.showToast({
            title: '网络错误，请稍后重试',
            icon: 'none'
          });
        }
      });
    }
  },

  editNutritionItem(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.nutritionItems[index];

    this.setData({
      showAddNutritionModal: true,
      formError: '',
      newNutrition: {
        name: item.name,
        category: item.category || '其他',
        protein: item.protein.toString(),
        carbohydrate: item.carbohydrate.toString(),
        fat: item.fat.toString(),
        unit: item.unit || 'g',
        gramPerUnit: (item.gramPerUnit || 100).toString(),
        calories: item.calories.toString()
      },
      editingNutritionIndex: index
    });
  },

  deleteNutritionItem(e) {
    const index = e.currentTarget.dataset.index;
    const nutritionItems = [...this.data.nutritionItems];
    const item = nutritionItems[index];

    wx.showModal({
      title: '确认删除',
      content: '确定要删除该食物营养数据吗？',
      success: (res) => {
        if (res.confirm) {
          // 调用API删除食材
          wx.request({
            url: `http://localhost:8000/api/ingredients/${item.id}`,
            method: 'DELETE',
            header: {
              'Authorization': 'Bearer ' + wx.getStorageSync('token')
            },
            success: (res) => {
              if (res.statusCode === 200 && res.data.code === 200) {
                nutritionItems.splice(index, 1);
                this.setData({
                  nutritionItems: nutritionItems
                });
                wx.showToast({
                  title: '已删除',
                  icon: 'success'
                });
              } else {
                wx.showToast({
                  title: '删除失败: ' + (res.data.message || '未知错误'),
                  icon: 'none'
                });
              }
            },
            fail: (err) => {
              console.error('删除食材失败:', err);
              wx.showToast({
                title: '网络错误，请稍后重试',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  }
})