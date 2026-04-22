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
    const method = (options.method || 'GET').toUpperCase();
    let data = options.data;
    // 小程序在 Content-Type: application/json 时，需将 data 序列化为 JSON 字符串，否则嵌套结构可能无法被后端正确解析
    if (
      method !== 'GET' && method !== 'HEAD' &&
      data != null && typeof data === 'object' &&
      !Array.isArray(data) && !(data instanceof ArrayBuffer) &&
      (headers['Content-Type'] || headers['content-type'] || '')
        .toLowerCase()
        .indexOf('application/json') !== -1
    ) {
      data = JSON.stringify(data);
    }
    wx.request({
      url: `${baseUrl}${options.url}`,
      method: options.method || 'GET',
      data,
      header: headers,
      success: (res) => {
        // 兼容 RESTful 常见返回码：201(created), 204(no content) 等
        if (res.statusCode >= 200 && res.statusCode < 300) {
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
  },
  // 根据ID获取用户信息
  getUserByID: function(userID) {
    return get(`/api/auth/user/${userID}`);
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
    return get('/api/auth/dietitians', params);
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
  // 根据用户ID获取健康数据（规划师使用）
  getUserHealthData: function(userId) {
    return get(`/api/health-data/user/${userId}`);
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
    return post('/api/service-request/', data);
  },
  // 获取用户的服务请求列表
  getList: function() {
    return get('/api/service-request/');
  },
  // 获取服务请求详情
  getDetail: function(id) {
    return get(`/api/service-request/${id}`);
  },
  // 取消服务请求
  cancel: function(id) {
    return put(`/api/service-request/${id}/cancel`);
  },
  // 获取规划师的服务请求列表
  getDietitianList: function() {
    return get('/api/service-request/dietitian/list');
  },
  // 批准服务请求
  approve: function(id) {
    return put(`/api/service-request/${id}/approve`);
  },
  // 拒绝服务请求
  reject: function(id) {
    return put(`/api/service-request/${id}/reject`);
  },
  // 获取规划师的服务用户列表
  getDietitianUsers: function() {
    return get('/api/service-request/dietitian/users');
  }
};

// 健康教育（规划师，与文章合并）
const healthEducation = {
  list: function(params) {
    const q = params && typeof params === 'object' ? params : {};
    const parts = [];
    if (q.content_status && q.content_status !== 'all') {
      parts.push(`content_status=${encodeURIComponent(q.content_status)}`);
    }
    if (q.visibility && q.visibility !== 'all') {
      parts.push(`visibility=${encodeURIComponent(q.visibility)}`);
    }
    const s = parts.length ? `?${parts.join('&')}` : '';
    return get('/api/health-education' + s);
  },
  create: function(data) {
    return post('/api/health-education', data);
  },
  getDetail: function(id) {
    return get(`/api/health-education/${encodeURIComponent(id)}`);
  },
  update: function(id, data) {
    return put(`/api/health-education/${encodeURIComponent(id)}`, data);
  },
  publish: function(id, data) {
    return post(`/api/health-education/${encodeURIComponent(id)}/publish`, data);
  },
  // 用户端阅读（普通用户）
  readerList: function(params) {
    const q = params && typeof params === 'object' ? params : {};
    const v = q.visibility && q.visibility !== 'all' ? `visibility=${encodeURIComponent(q.visibility)}` : '';
    const s = v ? `?${v}` : '';
    return get('/api/health-education/reader' + s);
  },
  readerDetail: function(id) {
    return get(`/api/health-education/reader/${encodeURIComponent(id)}`);
  }
};

// 评估相关API
const evaluation = {
  // 提交评估（规划师）
  submit: function(data) {
    return post('/api/evaluation', data);
  },
  // 当前登录用户自己的评估列表
  getUserEvaluations: function(limit) {
    const q = limit ? `?limit=${limit}` : '';
    return get('/api/evaluation/user' + q);
  },
  // 规划师按用户查询评估列表
  listByUser: function(userId, limit) {
    let q = `?user_id=${encodeURIComponent(userId)}`;
    if (limit) {
      q += `&limit=${limit}`;
    }
    return get('/api/evaluation/by-user' + q);
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
  // 获取饮食记录列表
  getRecords: function(params) {
    return get('/api/nutrition/record', params);
  },
  // 获取今日饮食记录
  getTodayRecords: function() {
    return get('/api/nutrition/record/today');
  },
  // 获取营养推荐标准
  getRecommendation: function(params) {
    return get('/api/nutrition/recommendation', params);
  },
  // 获取指定日期的饮食记录
  getRecordsByDate: function(date) {
    return get('/api/nutrition/record/date', { date });
  },
  // 获取营养摄入趋势数据
  getTrendData: function(days) {
    return get('/api/nutrition/record/trend', { days });
  }
};

// 膳食计划相关API
const dietPlan = {
  // 创建膳食计划
  create: function(data) {
    return post('/api/diet-plans', data);
  },
  // 获取膳食计划详情
  getDetail: function(id, params) {
    let user_id = '';
    if (typeof params === 'string') {
      user_id = params;
    } else if (typeof params === 'object' && params.user_id) {
      user_id = params.user_id;
    }
    const url = user_id ? `/api/diet-plans/${id}?user_id=${user_id}` : `/api/diet-plans/${id}`;
    return get(url);
  },
  // 更新膳食计划
  update: function(id, data, userId) {
    return put(`/api/diet-plans/${id}?user_id=${userId}`, data);
  },
  // 删除膳食计划
  remove: function(id) {
    return del(`/api/diet-plans/${id}`);
  },
  // 获取用户的膳食计划
  getUserPlans: function(params) {
    // 兼容两种调用：
    // 1) getUserPlans() -> 当前登录用户
    // 2) getUserPlans(userId) -> 指定用户（规划师）
    // 3) getUserPlans({ user_id }) -> 指定用户（推荐）
    if (!params) return get('/api/diet-plans/user');
    if (typeof params === 'string') return get(`/api/diet-plans/user?user_id=${params}`);
    if (typeof params === 'object' && params.user_id) return get('/api/diet-plans/user', params);
    return get('/api/diet-plans/user', params);
  },
  // 更新执行状态
  updateExecuteStatus: function(id, data) {
    return put(`/api/diet-plans/${id}/execute-status`, data);
  },
  // 申请优化
  requestOptimization: function(id, data) {
    return put(`/api/diet-plans/${id}/optimization`, data);
  },
  // 发布膳食计划
  publish: function(id, userId) {
    return put(`/api/diet-plans/${id}/publish?user_id=${userId}`);
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
  healthEducation,
  evaluation,
  ingredient,
  dietPlan,
  nutrition
};