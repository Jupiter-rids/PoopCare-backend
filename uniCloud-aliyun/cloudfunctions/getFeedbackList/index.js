// uniCloud/cloudfunctions/getFeedbackList/index.js
'use strict';

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const { OPENID } = context;  // 获取当前用户ID
  
  console.log('📋 获取反馈列表，用户:', OPENID);

  if (!OPENID) {
    return {
      code: 401,
      message: '用户未登录',
      data: []
    };
  }

  try {
    // 🔑 关键：只查询当前用户的反馈
    const res = await db.collection('feedback')
      .where({
        openid: OPENID  // 🚀 用户隔离核心
      })
      .orderBy('createTime', 'desc')
      .limit(50)  // 限制数量
      .get();

    console.log(`📊 用户 ${OPENID} 的反馈数量:`, res.data.length);

    return {
      code: 0,
      message: '获取成功',
      data: res.data || []
    };

  } catch (error) {
    console.error('❌ 查询失败:', error);
    return {
      code: 500,
      message: '获取失败: ' + error.message,
      data: []
    };
  }
};