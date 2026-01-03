// uniCloud/cloudfunctions/getRecords/index.js
'use strict';

exports.main = async (event, context) => {
  console.log('📋 getRecords被调用', event);
  
  // 1. 获取用户openid
  const openid = context.OPENID;
  console.log('👤 当前用户openid:', openid);
  
  if (!openid) {
    return {
      code: 401,
      msg: '未登录，请先登录'
    };
  }
  
  try {
    // 2. 获取数据库引用
    const db = uniCloud.database();
    const recordsCollection = db.collection('records');
    
    // 3. 查询当前用户的所有记录（按时间倒序）
    const queryResult = await recordsCollection
      .where({
        openid: openid  // 关键：只查询当前用户的记录
      })
      .orderBy('createTime', 'desc')
      .get();
    
    const records = queryResult.data || [];
    console.log(`📊 用户 ${openid.substring(0, 8)}... 的记录数:`, records.length);
    
    return {
      code: 0,
      msg: '获取成功',
      data: records
    };
    
  } catch (error) {
    console.error('❌ 获取记录失败:', error);
    return {
      code: 500,
      msg: '获取失败: ' + error.message
    };
  }
};