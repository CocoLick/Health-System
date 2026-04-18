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
    headers['Authorization'] = token;
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
  }
};

// 用户相关API
const user = {
  // 获取用户信息
  getInfo: function() {
    return get('/api/user/info');
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

// 食材相关API
const ingredient = {
  // 获取食材列表
  getList: function(params) {
    return get('/api/ingredients', params);
  },
  // 获取食材详情
  getDetail: function(id) {
    return get(`/api/ingredients/${id}`);
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
  }
};

// 导出API对象
module.exports = {
  auth,
  admin,
  dietitian,
  user,
  ingredient,
  dietPlan,
  nutrition
};