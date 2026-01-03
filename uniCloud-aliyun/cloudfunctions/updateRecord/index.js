// uniCloud/cloudfunctions/updateRecord/index.js
'use strict';

exports.main = async (event, context) => {
  console.log('✏️ updateRecord被调用', event);
  
  // 1. 获取用户openid
  const openid = context.OPENID;
  
  if (!openid) {
    return {
      code: 401,
      msg: '未登录，请先登录'
    };
  }
  
  const { recordId, updateData } = event;
  
  if (!recordId || !updateData) {
    return {
      code: 400,
      msg: '缺少必要参数'
    };
  }
  
  try {
    // 2. 获取数据库引用
    const db = uniCloud.database();
    const recordsCollection = db.collection('records');
    
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
      console.error('🚫 权限拒绝：用户', openid, '尝试修改他人记录', record.openid);
      return {
        code: 403,
        msg: '无权修改此记录'
      };
    }
    
    // 5. 构建更新数据
    const newUpdateData = {
      ...updateData,
      updateTime: Date.now()
    };
    
    // 6. 更新记录
    await recordsCollection.doc(recordId).update(newUpdateData);
    
    console.log('✅ 记录更新成功:', recordId);
    
    return {
      code: 0,
      msg: '更新成功'
    };
    
  } catch (error) {
    console.error('❌ 更新记录失败:', error);
    return {
      code: 500,
      msg: '更新失败: ' + error.message
    };
  }
};