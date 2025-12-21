const User = require('../models/User');
const VerifyCode = require('../models/VerifyCode');
const config = require('../config/config');
const { pool } = require('../config/database');

// 模拟Sequelize的Op操作符，用于兼容性
const Op = {
  gt: '[Op.gt]',
  lt: '[Op.lt]'
};

// 生成随机验证码
function generateVerifyCode(length = 6) {
  let code = '';
  const chars = '0123456789';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 检查验证码是否有效
async function isVerifyCodeValid(phone, code, type = 'register') {
  try {
    const verifyCodeRecord = await VerifyCode.findOne({
      where: {
        phone,
        code,
        type,
        used: false,
        expires_at: { [Op.gt]: new Date() }
      },
      order: [['created_at', 'DESC']]
    });
    
    if (verifyCodeRecord) {
      // 标记验证码为已使用
      await verifyCodeRecord.update({ used: true });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('验证验证码错误:', error);
    return false;
  }
}

// 检查是否可以发送新的验证码
async function canSendNewVerifyCode(phone, type = 'register') {
  try {
    const lastVerifyCode = await VerifyCode.findOne({
      where: {
        phone,
        type,
        created_at: { 
          [Op.gt]: new Date(Date.now() - config.verifyCode.resendInterval) 
        }
      },
      order: [['created_at', 'DESC']]
    });
    
    return !lastVerifyCode;
  } catch (error) {
    console.error('检查是否可以发送新验证码错误:', error);
    return false;
  }
}

// 保存验证码到数据库
async function saveVerifyCode(phone, code, type = 'register') {
  try {
    const expiresAt = new Date(Date.now() + config.verifyCode.expireTime);
    
    await VerifyCode.create({
      phone,
      code,
      type,
      expires_at: expiresAt
    });
    
    return true;
  } catch (error) {
    console.error('保存验证码错误:', error);
    return false;
  }
}

// 发送验证码（模拟）
async function sendVerifyCode(phone, type = 'register') {
  try {
    // 检查是否可以发送新的验证码
    const canSend = await canSendNewVerifyCode(phone, type);
    if (!canSend) {
      return {
        success: false,
        message: `请在${config.verifyCode.resendInterval / 1000}秒后重试`,
        code: 429
      };
    }
    
    // 生成验证码
    const verifyCode = generateVerifyCode(config.verifyCode.length);
    
    // 在实际应用中，这里应该调用短信服务发送验证码
    // 由于这是测试环境，我们只打印验证码到控制台
    console.log(`[${type}] 发送验证码到 ${phone}: ${verifyCode}`);
    
    // 保存验证码到数据库
    await saveVerifyCode(phone, verifyCode, type);
    
    return {
      success: true,
      message: '验证码发送成功',
      code: verifyCode // 仅在测试环境返回验证码
    };
  } catch (error) {
    console.error('发送验证码错误:', error);
    return {
      success: false,
      message: '验证码发送失败，请稍后重试',
      code: 500
    };
  }
}

// 用户注册
async function register(phone, password, verifyCode) {
  try {
    // 检查用户是否已存在
    const existingUser = await User.findOne({ where: { phone } });
    if (existingUser) {
      return {
        success: false,
        message: '手机号已被注册',
        code: 409
      };
    }
    
    // 验证验证码
    const isCodeValid = await isVerifyCodeValid(phone, verifyCode, 'register');
    if (!isCodeValid) {
      return {
        success: false,
        message: '验证码无效或已过期',
        code: 400
      };
    }
    
    // 创建新用户
    const newUser = await User.create({
      phone,
      password,
      nickname: `用户${phone.slice(-4)}`, // 默认昵称使用手机号后四位
      registration_source: 'app'
    });
    
    return {
      success: true,
      user: newUser
    };
  } catch (error) {
    console.error('用户注册错误:', error);
    return {
      success: false,
      message: '注册失败，请稍后重试',
      code: 500
    };
  }
}

// 用户密码登录
async function login(phone, password) {
  try {
    // 查找用户
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return {
        success: false,
        message: '用户不存在',
        code: 401
      };
    }
    
    // 检查用户状态 - 注释掉，因为数据库表中没有status字段
    // if (user.status !== 'active') {
    //   return {
    //     success: false,
    //     message: '账号已被禁用，请联系管理员',
    //     code: 403
    //   };
    // }
    
    // 验证密码
    const isPasswordValid = await user.validPassword(password);
    if (!isPasswordValid) {
      return {
        success: false,
        message: '密码错误',
        code: 401
      };
    }
    
    // 更新最后登录时间 - 注释掉，因为数据库表中没有last_login_at字段
    // await User.findAndUpdateLoginTime(user.id);
    
    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('用户登录错误:', error);
    return {
      success: false,
      message: '登录失败，请稍后重试',
      code: 500
    };
  }
}

// 验证码登录
async function loginWithVerifyCode(phone, verifyCode) {
  try {
    // 查找用户
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return {
        success: false,
        message: '用户不存在，请先注册',
        code: 404
      };
    }
    
    // 检查用户状态 - 注释掉，因为数据库表中没有status字段
    // if (user.status !== 'active') {
    //   return {
    //     success: false,
    //     message: '账号已被禁用，请联系管理员',
    //     code: 403
    //   };
    // }
    
    // 验证验证码
    const isCodeValid = await isVerifyCodeValid(phone, verifyCode, 'login');
    if (!isCodeValid) {
      return {
        success: false,
        message: '验证码无效或已过期',
        code: 400
      };
    }
    
    // 更新最后登录时间 - 注释掉，因为数据库表中没有last_login_at字段
    // await User.findAndUpdateLoginTime(user.id);
    
    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('验证码登录错误:', error);
    return {
      success: false,
      message: '登录失败，请稍后重试',
      code: 500
    };
  }
}

// 重置密码
async function resetPassword(phone, newPassword, verifyCode) {
  try {
    // 查找用户
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return {
        success: false,
        message: '用户不存在',
        code: 404
      };
    }
    
    // 验证验证码
    const isCodeValid = await isVerifyCodeValid(phone, verifyCode, 'reset_password');
    if (!isCodeValid) {
      return {
        success: false,
        message: '验证码无效或已过期',
        code: 400
      };
    }
    
    // 更新密码
    await user.update({ password: newPassword });
    
    return {
      success: true
    };
  } catch (error) {
    console.error('重置密码错误:', error);
    return {
      success: false,
      message: '密码重置失败，请稍后重试',
      code: 500
    };
  }
}

module.exports = {
  sendVerifyCode,
  register,
  login,
  loginWithVerifyCode,
  resetPassword,
  // 导出内部方法用于测试
  generateVerifyCode,
  isVerifyCodeValid,
  canSendNewVerifyCode,
  saveVerifyCode
};
