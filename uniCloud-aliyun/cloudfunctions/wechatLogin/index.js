
'use strict';

// ==================== 配置区（在这里设置）====================
// 注意：先重置AppSecret，然后用新的密钥替换下面的值
const WEAPP_CONFIG = {
  APP_ID: "wxdf04c9552ed9f5d3",           // 你的小程序AppID
  APP_SECRET: "e39fd7e32935d2b47ac5c60d115f5105"  // 重置后的新AppSecret（32位）
};
// ==================== 配置区结束 ====================

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('========== 微信登录云函数开始执行 ==========');
  console.log('接收到的参数:', event);
  
  // 验证配置
  if (!WEAPP_CONFIG.APP_ID || !WEAPP_CONFIG.APP_SECRET) {
    console.error('❌ 配置错误：请检查APP_ID和APP_SECRET配置');
    return {
      code: 500,
      msg: '服务器配置错误',
      tip: '请检查云函数中的APP_ID和APP_SECRET配置'
    };
  }
  
  console.log('配置检查 - APP_ID:', WEAPP_CONFIG.APP_ID);
  console.log('配置检查 - APP_SECRET长度:', WEAPP_CONFIG.APP_SECRET.length);
  
  const { code } = event;
  
  // 1. 参数验证
  if (!code) {
    console.error('❌ 缺少code参数');
    return {
      code: 400,
      msg: '缺少登录凭证code'
    };
  }
  
  console.log('接收到的code，长度:', code.length);
  
  try {
    // 2. 调用微信 auth.code2Session 接口
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WEAPP_CONFIG.APP_ID}&secret=${WEAPP_CONFIG.APP_SECRET}&js_code=${code}&grant_type=authorization_code`;
    
    console.log('调用微信接口（隐藏密钥）:', wxUrl.replace(WEAPP_CONFIG.APP_SECRET, '***'));
    
    const startTime = Date.now();
    const wxResponse = await uniCloud.httpclient.request(wxUrl, {
      method: 'GET',
      dataType: 'json',
      timeout: 10000
    });
    const endTime = Date.now();
    
    console.log(`微信接口响应时间: ${endTime - startTime}ms`);
    console.log('微信接口响应状态码:', wxResponse.status);
    console.log('微信接口返回数据:', wxResponse.data);
    
    // 3. 处理微信接口返回
    const wxData = wxResponse.data;
    
    if (wxData.errcode) {
      console.error('❌ 微信接口返回错误:', wxData);
      
      let errorMsg = '微信登录失败';
      switch(wxData.errcode) {
        case 40029:
          errorMsg = '登录code无效或已过期';
          break;
        case 45011:
          errorMsg = '登录频率限制，请稍后重试';
          break;
        case 40163:
          errorMsg = '登录code已被使用';
          break;
        case -1:
          errorMsg = '微信系统繁忙，请稍后重试';
          break;
        default:
          errorMsg = `微信登录失败 (${wxData.errcode}): ${wxData.errmsg || '未知错误'}`;
      }
      
      return {
        code: 401,
        msg: errorMsg,
        wxError: wxData
      };
    }
    
    // 4. 获取openid和session_key
    const { openid, session_key, unionid } = wxData;
    
    if (!openid) {
      console.error('❌ 未获取到openid');
      return {
        code: 500,
        msg: '用户标识获取失败'
      };
    }
    
    console.log('✅ 获取到openid:', openid.substring(0, 8) + '...');
    console.log('session_key长度:', session_key ? session_key.length : 0);
    if (unionid) {
      console.log('unionid:', unionid.substring(0, 8) + '...');
    }
    
    // 5. 数据库操作
    const db = uniCloud.database();
    const usersCollection = db.collection('users');
    const now = Date.now();
    
    let userData = null;
    let isNewUser = false;
    
    try {
      // 6. 查询用户是否存在
      const userQuery = await usersCollection.where({
        openid: openid
      }).get();
      
      console.log('查询用户结果，找到', userQuery.data.length, '条记录');
      
      if (userQuery.data.length === 0) {
        // 新用户 - 创建记录
        console.log('👤 新用户，创建记录');
        
        const newUser = {
          openid: openid,
          unionid: unionid || '',
          session_key: session_key,
          createTime: now,
          lastLoginTime: now,
          loginCount: 1,
          userStatus: 1,
          nickName: '微信用户',
          avatarUrl: '',
          gender: 0,
          city: '',
          province: '',
          country: ''
        };
        
        const addResult = await usersCollection.add(newUser);
        console.log('添加用户成功，ID:', addResult.id);
        
        userData = {
          ...newUser,
          _id: addResult.id
        };
        isNewUser = true;
        
      } else {
        // 老用户 - 更新记录
        console.log('👤 老用户，更新记录，用户ID:', userQuery.data[0]._id);
        
        userData = userQuery.data[0];
        const userId = userData._id;
        
        // 只更新必要的字段
        const updateData = {
          lastLoginTime: now,
          loginCount: (userData.loginCount || 0) + 1
        };
        
        // 更新session_key（重要）
        if (session_key) {
          updateData.session_key = session_key;
        }
        
        await usersCollection.doc(userId).update(updateData);
        console.log('用户信息更新成功');
        
        // 获取更新后的数据
        const updatedUser = await usersCollection.doc(userId).get();
        userData = updatedUser.data[0];
      }
      
    } catch (dbError) {
      console.error('❌ 数据库操作失败:', dbError);
      // 数据库失败时，至少返回openid
      userData = {
        openid: openid,
        _id: 'temp_' + Date.now(),
        isTemp: true
      };
    }
    
    // 7. 生成token（简单实现，生产环境应使用更安全的方式）
    const token = generateSimpleToken(openid, userData._id);
    
    // 8. 构建返回数据（不返回session_key！）
    const responseData = {
      openid: userData.openid,
      userId: userData._id,
      nickName: userData.nickName || '微信用户',
      avatarUrl: userData.avatarUrl || '',
      isNewUser: isNewUser,
      hasRecord: userData.recordCount ? userData.recordCount > 0 : false,
      lastLoginTime: userData.lastLoginTime || now,
      // 可添加更多业务字段
      gender: userData.gender || 0,
      city: userData.city || '',
      province: userData.province || '',
      country: userData.country || ''
    };
    
    console.log('✅ 登录成功，返回数据:', {
      ...responseData,
      openid: responseData.openid.substring(0, 8) + '...',
      userId: responseData.userId.substring(0, 8) + '...'
    });
    
    return {
      code: 0,
      msg: isNewUser ? '新用户注册成功' : '登录成功',
      token: token,
      data: responseData
    };
    
  } catch (error) {
    console.error('❌ 云函数执行异常:', error);
    
    let errorMsg = '登录失败，请稍后重试';
    
    if (error.message && error.message.includes('timeout')) {
      errorMsg = '网络请求超时，请检查网络';
    } else if (error.message && error.message.includes('ENOTFOUND')) {
      errorMsg = '网络连接失败，请检查网络设置';
    } else if (error.message && error.message.includes('ECONNREFUSED')) {
      errorMsg = '微信服务器连接失败';
    }
    
    return {
      code: 500,
      msg: errorMsg,
      error: error.message.substring(0, 100) // 只返回部分错误信息
    };
  }
};

// 生成简单的token（用于演示）
function generateSimpleToken(openid, userId) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const str = `${openid}_${userId}_${timestamp}_${randomStr}`;
  // 使用Buffer进行base64编码
  return Buffer.from(str).toString('base64').replace(/[+=/]/g, '');
}

console.log('wechatLogin云函数模块加载完成');
console.log('当前配置APP_ID:', WEAPP_CONFIG.APP_ID);
console.log('当前配置APP_SECRET长度:', WEAPP_CONFIG.APP_SECRET.length);