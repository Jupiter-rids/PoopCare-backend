// uniCloud/cloudfunctions/addFeedback/index.js
'use strict';

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const { OPENID } = context;  // 获取当前用户ID
  
  console.log('📝 添加反馈，用户:', OPENID);
  console.log('📦 数据:', event);

  const { content, contact } = event;

  if (!content) {
    return {
      code: 1,
      msg: '反馈内容不能为空'
    };
  }

  try {
    // 保存到 feedback 集合（之前是 feedbacks）
    await db.collection('feedback').add({
      content,
      contact: contact || '',
      openid: OPENID,  // 🔑 关键：关联用户
      createTime: Date.now()
    });

    console.log('✅ 反馈保存成功，用户:', OPENID);

    return {
      code: 0,
      msg: '提交成功'
    };
    
  } catch (error) {
    console.error('❌ 保存失败:', error);
    return {
      code: 500,
      msg: '提交失败: ' + error.message
    };
  }
};