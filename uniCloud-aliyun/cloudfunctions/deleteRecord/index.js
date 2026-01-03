// uniCloud/cloudfunctions/deleteRecord/index.js
'use strict';

exports.main = async (event, context) => {
  console.log('🗑️ deleteRecord被调用', event);
  
  // 1. 获取用户openid
  const openid = context.OPENID;
  
  if (!openid) {
    return {
      code: 401,
      msg: '未登录，请先登录'
    };
  }
  
  const { recordId } = event;
  
  if (!recordId) {
    return {
      code: 400,
      msg: '缺少记录ID'
    };
  }
  
  try {
    // 2. 获取数据库引用
    const db = uniCloud.database();
    const recordsCollection = db.collection('records');
    const usersCollection = db.collection('users');
    
    // 3. 先验证记录是否存在且属于当前用户
    const recordQuery = await recordsCollection.doc(recordId).get();
    const record = recordQuery.data[0];
    
    if (!record) {
      return {
        code: 404,
        msg: '记录不存在'
      };
    }
    
    // 4. 验证记录所属权（关键！）
    if (record.openid !== openid) {
      console.error('🚫 权限拒绝：用户', openid, '尝试删除他人记录', record.openid);
      return {
        code: 403,
        msg: '无权删除此记录'
      };
    }
    
    // 5. 删除记录
    await recordsCollection.doc(recordId).remove();
    
    // 6. 更新用户的记录计数
    await usersCollection.where({
      openid: openid
    }).update({
      recordCount: db.command.inc(-1)
    });
    
    console.log('✅ 记录删除成功:', recordId);
    
    return {
      code: 0,
      msg: '删除成功'
    };
    
  } catch (error) {
    console.error('❌ 删除记录失败:', error);
    return {
      code: 500,
      msg: '删除失败: ' + error.message
    };
  }
};