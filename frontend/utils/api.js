// utils/api.js

const baseUrl = 'http://localhost:8000';

// 获取token
function getToken() {
  return wx.getStorageSync('token');
}

// 通用请求方法
function request(options) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.header
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header: headers,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(res);
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

// GET请求
function get(url, data = {}, header = {}) {
  return request({
    url,
    method: 'GET',
    data,
    header
  });
}

// POST请求
function post(url, data = {}, header = {}) {
  return request({
    url,
    method: 'POST',
    data,
    header
  });
}

// PUT请求
function put(url, data = {}, header = {}) {
  return request({
    url,
    method: 'PUT',
    data,
    header
  });
}

// DELETE请求
function del(url, data = {}, header = {}) {
  return request({
    url,
    method: 'DELETE',
    data,
    header
  });
}

// 认证相关API
const auth = {
  // 用户注册
  register: function(data) {
    return post('/api/auth/register', data);
  },
  // 用户登录
  login: function(data) {
    return post('/api/auth/login', data);
  },
  // 规划师登录
  dietitianLogin: function(data) {
    return post('/api/auth/dietitian/login', data);
  },
  // 管理员登录
  adminLogin: function(data) {
    return post('/api/auth/admin/login', data);
  }
};

// 管理员相关API
const admin = {
  // 创建规划师
  createDietitian: function(data) {
    return post('/api/auth/admin/dietitian', data);
  },
  // 获取所有规划师
  getAllDietitians: function() {
    return get('/api/auth/admin/dietitians');
  },
  // 更新规划师状态
  updateDietitianStatus: function(userId, status) {
    return put(`/api/auth/admin/dietitian/${userId}/status`, { status });
  },
  // 删除规划师
  deleteDietitian: function(userId) {
    return del(`/api/auth/admin/dietitian/${userId}`);
  }
};

// 规划师相关API
const dietitian = {
  // 获取规划师信息
  getInfo: function() {
    return get('/api/dietitian/info');
  },
  // 获取服务列表
  getServices: function() {
    return get('/api/dietitian/services');
  },
  // 获取规划师列表（用户端）
  getList: function(params) {
    return get('/api/dietitians', params);
  },
  // 获取规划师详情
  getDetail: function(id) {
    return get(`/api/dietitians/${id}`);
  },
  // 响应服务请求
  respondRequest: function(requestId, data) {
    return put(`/api/dietitian/service-request/${requestId}/respond`, data);
  }
};

// 用户相关API
const user = {
  // 获取用户信息
  getInfo: function() {
    return get('/api/user/info');
  },
  // 更新用户信息
  updateInfo: function(data) {
    return put('/api/user/info', data);
  },
  // 获取膳食计划
  getDietPlans: function() {
    return get('/api/user/diet-plans');
  },
  // 获取营养分析
  getNutritionAnalysis: function() {
    return get('/api/user/nutrition-analysis');
  }
};

// 健康数据相关API
const healthData = {
  // 提交健康数据
  submit: function(data) {
    return post('/api/health-data', data);
  },
  // 获取健康数据列表
  getList: function() {
    return get('/api/health-data');
  },
  // 获取最新健康数据
  getLatest: function() {
    return get('/api/health-data/latest');
  },
  // 更新健康数据
  update: function(id, data) {
    return put(`/api/health-data/${id}`, data);
  }
};

// 服务请求相关API
const serviceRequest = {
  // 提交服务请求
  submit: function(data) {
    return post('/api/service-request', data);
  },
  // 获取用户的服务请求列表
  getUserRequests: function() {
    return get('/api/service-request/user');
  },
  // 获取服务请求详情
  getDetail: function(id) {
    return get(`/api/service-request/${id}`);
  },
  // 取消服务请求
  cancel: function(id) {
    return put(`/api/service-request/${id}/cancel`);
  }
};

// 评估相关API
const evaluation = {
  // 提交评估
  submit: function(data) {
    return post('/api/evaluation', data);
  },
  // 获取用户的评估记录
  getUserEvaluations: function() {
    return get('/api/evaluation/user');
  },
  // 获取评估详情
  getDetail: function(id) {
    return get(`/api/evaluation/${id}`);
  }
};

// 食材相关API
const ingredient = {
  // 获取食材列表
  getList: function(params) {
    return get('/api/ingredients', params);
  },
  // 获取食材详情
  getDetail: function(id) {
    return get(`/api/ingredients/${id}`);
  },
  // 获取食材清单
  getShoppingList: function(planId) {
    return get(`/api/ingredients/shopping-list`, { plan_id: planId });
  }
};

// 膳食计划相关API
const dietPlan = {
  // 创建膳食计划
  create: function(data) {
    return post('/api/diet-plans', data);
  },
  // 获取膳食计划详情
  getDetail: function(id) {
    return get(`/api/diet-plans/${id}`);
  },
  // 更新膳食计划
  update: function(id, data) {
    return put(`/api/diet-plans/${id}`, data);
  },
  // 删除膳食计划
  remove: function(id) {
    return del(`/api/diet-plans/${id}`);
  },
  // 获取用户的膳食计划
  getUserPlans: function() {
    return get('/api/diet-plans/user');
  },
  // 更新执行状态
  updateExecuteStatus: function(id, data) {
    return put(`/api/diet-plans/${id}/execute-status`, data);
  },
  // 申请优化
  requestOptimization: function(id, data) {
    return put(`/api/diet-plans/${id}/optimization`, data);
  }
};

// 营养分析相关API
const nutrition = {
  // 获取营养分析数据
  getAnalysis: function(params) {
    return get('/api/nutrition/analysis', params);
  },
  // 获取营养建议
  getSuggestions: function() {
    return get('/api/nutrition/suggestions');
  },
  // 添加饮食记录
  addRecord: function(data) {
    return post('/api/nutrition/record', data);
  },
  // 获取饮食记录
  getRecords: function(params) {
    return get('/api/nutrition/records', params);
  }
};

// 导出API对象
module.exports = {
  auth,
  admin,
  dietitian,
  user,
  healthData,
  serviceRequest,
  evaluation,
  ingredient,
  dietPlan,
  nutrition
};