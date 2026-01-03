// uniCloud/cloudfunctions/getFeedbackList/index.js
'use strict';

exports.main = async (event, context) => {
  try {
    const db = uniCloud.database();
    
    console.log('🎯 云函数 getFeedbackList 被调用');
    console.log('用户上下文:', context);
    console.log('事件参数:', event);
    
    // 方式1：查询所有反馈（不需要用户登录）
    const res = await db.collection('feedback')
      .orderBy('createTime', 'desc')  // 按创建时间倒序
      .limit(100)                     // 限制100条，防止数据过多
      .get();
    
    console.log('📊 查询结果:', res);
    
    return {
      code: 0,
      message: '获取反馈列表成功',
      data: res.data || []
    };
    
  } catch (error) {
    console.error('❌ 云函数错误:', error);
    return {
      code: -1,
      message: '获取失败: ' + error.message,
      data: []
    };
  }
};