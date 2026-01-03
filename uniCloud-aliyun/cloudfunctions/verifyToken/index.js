// uniCloud/cloudfunctions/verifyToken/index.js
'use strict';

exports.main = async (event, context) => {
  const { token } = event;
  const { OPENID } = context;
  
  // 简单验证：检查 token 是否包含当前用户的 OPENID
  if (token && token.startsWith(OPENID)) {
    return { code: 0, msg: 'token有效' };
  }
  
  return { code: 401, msg: 'token无效' };
};