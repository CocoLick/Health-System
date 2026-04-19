const api = require('../../../utils/api');

Page({
  data: {
    searchKeyword: '',
    filterType: 'all',
    dietitians: []
  },

  mockDietitians: [
    {
      id: 'D001',
      name: '张医生',
      nameInitial: '张',
      title: '高级营养师',
      specialty: '减脂塑形,慢病调理',
      specialtyArr: ['减脂塑形', '慢病调理'],
      rating: 4.9,
      serviceCount: 128,
      experience: '10年',
      introduction: '毕业于北京协和医学院，曾就职于三甲医院临床营养科，专注于肥胖症、糖尿病等慢性疾病的营养干预。',
      cases: [
        { title: '3个月减重20斤', description: '通过个性化膳食计划帮助用户健康减重' },
        { title: '血糖稳定控制', description: '帮助糖尿病患者将血糖控制在正常范围' }
      ],
      reviews: [
        { user: '李女士', content: '张医生非常专业，制定的计划很适合我', rating: 5 },
        { user: '王先生', content: '服务态度很好，会根据我的反馈及时调整计划', rating: 5 }
      ]
    },
    {
      id: 'D002',
      name: '李医生',
      nameInitial: '李',
      title: '注册营养师',
      specialty: '孕期营养,儿童营养',
      specialtyArr: ['孕期营养', '儿童营养'],
      rating: 4.8,
      serviceCount: 86,
      experience: '8年',
      introduction: '专注孕期营养指导和儿童生长发育营养干预，帮助众多准妈妈和宝宝实现科学喂养。',
      cases: [
        { title: '孕期营养均衡', description: '帮助准妈妈整个孕期体重合理增长' },
        { title: '儿童增高指导', description: '通过营养干预帮助儿童健康成长' }
      ],
      reviews: [
        { user: '陈妈妈', content: '李医生帮我解决了孕期的饮食困扰', rating: 5 },
        { user: '刘女士', content: '孩子的辅食添加指导非常专业', rating: 5 }
      ]
    },
    {
      id: 'D003',
      name: '王医生',
      nameInitial: '王',
      title: '运动营养师',
      specialty: '增肌塑形,运动营养',
      specialtyArr: ['增肌塑形', '运动营养'],
      rating: 4.7,
      serviceCount: 65,
      experience: '6年',
      introduction: '国家职业运动员营养顾问，擅长运动营养搭配和增肌减脂方案设计。',
      cases: [
        { title: '健身增肌', description: '帮助健身爱好者科学增肌' },
        { title: '马拉松跑者营养', description: '为马拉松选手制定赛前赛后营养方案' }
      ],
      reviews: [
        { user: '赵先生', content: '王医生对运动营养非常了解', rating: 5 },
        { user: '孙先生', content: '增肌效果明显，会继续合作', rating: 4 }
      ]
    },
    {
      id: 'D004',
      name: '陈医生',
      nameInitial: '陈',
      title: '中医营养师',
      specialty: '中医食疗,体质调理',
      specialtyArr: ['中医食疗', '体质调理'],
      rating: 4.9,
      serviceCount: 92,
      experience: '12年',
      introduction: '中医世家出身，将传统中医理论与现代营养学结合，擅长体质调理和食疗方案。',
      cases: [
        { title: '湿热体质调理', description: '通过中医食疗改善湿热体质' },
        { title: '气血不足调养', description: '帮助女性调理气血不足问题' }
      ],
      reviews: [
        { user: '周女士', content: '陈医生的食疗方案效果很好', rating: 5 },
        { user: '吴女士', content: '体质明显改善，感谢陈医生', rating: 5 }
      ]
    }
  ],

  onLoad() {
    this.loadDietitians();
  },

  onPullDownRefresh() {
    this.loadDietitians();
    wx.stopPullDownRefresh();
  },

  loadDietitians() {
    let dietitians = this.mockDietitians;

    if (this.data.filterType !== 'all') {
      const filterMap = {
        'weight_loss': '减脂',
        'diabetes': '控糖',
        'nutrition': '营养'
      };
      const filterText = filterMap[this.data.filterType];
      dietitians = dietitians.filter(item =>
        item.specialty.includes(filterText)
      );
    }

    if (this.data.searchKeyword) {
      const keyword = this.data.searchKeyword.toLowerCase();
      dietitians = dietitians.filter(item =>
        item.name.toLowerCase().includes(keyword) ||
        item.specialty.toLowerCase().includes(keyword)
      );
    }

    this.setData({ dietitians });
  },

  onSearch(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
    this.loadDietitians();
  },

  switchFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({
      filterType: filter
    });
    this.loadDietitians();
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    const dietitian = this.mockDietitians.find(item => item.id === id);
    if (dietitian) {
      wx.navigateTo({
        url: '/pages/user/dietitian-detail/index?id=' + id + '&data=' + encodeURIComponent(JSON.stringify(dietitian))
      });
    }
  }
});