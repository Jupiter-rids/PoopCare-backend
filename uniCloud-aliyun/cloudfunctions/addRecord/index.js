// uniCloud/cloudfunctions/addRecord/index.js
'use strict';

exports.main = async (event, context) => {
  console.log('📝 addRecord被调用', event);
  
  // 1. 获取用户openid（从context中）
  const openid = context.OPENID;
  const appid = context.APPID;
  
  console.log('👤 用户信息:', { openid, appid });
  
  if (!openid) {
    return {
      code: 401,
      msg: '未登录，请先登录'
    };
  }
  
  // 2. 验证必要参数
  const requiredFields = ['time', 'typeIndex', 'duration', 'moodIndex'];
  for (const field of requiredFields) {
    if (event[field] === undefined || event[field] === null) {
      return {
        code: 400,
        msg: `缺少必要字段: ${field}`
      };
    }
  }
  
  try {
    // 3. 获取数据库引用
    const db = uniCloud.database();
    const recordsCollection = db.collection('records');
    const usersCollection = db.collection('users');
    
    // 4. 构建记录数据（包含用户openid）
    const recordData = {
      openid: openid,  // 关键：关联用户
      appid: appid,
      time: event.time,
      typeIndex: event.typeIndex,
      typeText: event.typeText || '',
      duration: event.duration,
      moodIndex: event.moodIndex,
      moodText: event.moodText || '',
      symptoms: event.symptoms || [],
      otherSymptom: event.otherSymptom || '',
      note: event.note || '',
      habits: event.habits || [],
      createTime: Date.now(),
      updateTime: Date.now()
    };
    
    console.log('📤 准备保存记录:', recordData);
    
    // 5. 保存到数据库
    const addResult = await recordsCollection.add(recordData);
    
    // 6. 更新用户的记录计数
    await usersCollection.where({
      openid: openid
    }).update({
      lastRecordTime: Date.now(),
      recordCount: db.command.inc(1)
    });
    
    console.log('✅ 记录保存成功，ID:', addResult.id);
    
    return {
      code: 0,
      msg: '保存成功',
      data: {
        recordId: addResult.id,
        time: recordData.time
      }
    };
    
  } catch (error) {
    console.error('❌ 保存记录失败:', error);
    return {
      code: 500,
      msg: '保存失败: ' + error.message
    };
  }
};