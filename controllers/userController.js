const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

// 获取用户个人信息
exports.getUserProfile = async (userId) => {
  try {
    const sql = `SELECT id, username, email, phone, nickname, gender, age, height, weight, avatar_url, privacy_settings, created_at, updated_at, is_active FROM users WHERE id = ?`;
    const [users] = await pool.execute(sql, [userId]);
    
    if (users.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    return {
      success: true,
      user: users[0]
    };
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return {
      success: false,
      message: '获取用户信息失败'
    };
  }
};

// 更新用户个人资料
exports.updateUserProfile = async (userId, updateData) => {
  try {
    // 检查用户是否存在
    const [existingUsers] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    
    if (existingUsers.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    // 只允许更新的字段
    const allowedFields = ['nickname', 'gender', 'age', 'height', 'weight', 'avatar_url'];
    const updates = [];
    const params = [];
    
    allowedFields.forEach(field => {
      if (updateData.hasOwnProperty(field)) {
        updates.push(`${field} = ?`);
        params.push(updateData[field]);
      }
    });
    
    // 如果没有要更新的字段，直接返回成功
    if (updates.length === 0) {
      const [users] = await pool.execute('SELECT id, username, email, phone, nickname, gender, age, height, weight, avatar_url, privacy_settings, created_at, updated_at, is_active FROM users WHERE id = ?', [userId]);
      return {
        success: true,
        user: users[0]
      };
    }
    
    // 添加更新时间
    updates.push(`updated_at = ?`);
    params.push(new Date());
    
    // 添加用户ID到参数列表
    params.push(userId);
    
    // 构建并执行更新查询
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await pool.execute(sql, params);
    
    // 返回更新后的用户信息
    const [updatedUsers] = await pool.execute('SELECT id, username, email, phone, nickname, gender, age, height, weight, avatar_url, privacy_settings, created_at, updated_at, is_active FROM users WHERE id = ?', [userId]);
    
    return {
      success: true,
      user: updatedUsers[0]
    };
  } catch (error) {
    console.error('更新用户资料错误:', error);
    return {
      success: false,
      message: '更新失败，请稍后重试'
    };
  }
};

// 修改密码
exports.changePassword = async (userId, oldPassword, newPassword) => {
  try {
    // 获取用户信息（包含密码）
    const [users] = await pool.execute('SELECT id, password FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    const user = users[0];
    
    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return {
        success: false,
        message: '旧密码错误'
      };
    }
    
    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新密码
    await pool.execute(
      'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
      [hashedPassword, new Date(), userId]
    );
    
    return {
      success: true,
      message: '密码修改成功'
    };
  } catch (error) {
    console.error('修改密码错误:', error);
    return {
      success: false,
      message: '密码修改失败，请稍后重试'
    };
  }
};

// 绑定邮箱
exports.bindEmail = async (userId, email) => {
  try {
    // 检查邮箱是否已被其他用户使用
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, userId]
    );
    
    if (existingUsers.length > 0) {
      return {
        success: false,
        message: '该邮箱已被其他用户绑定'
      };
    }
    
    // 检查用户是否存在
    const [users] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    // 更新用户邮箱
    await pool.execute(
      'UPDATE users SET email = ?, updated_at = ? WHERE id = ?',
      [email, new Date(), userId]
    );
    
    return {
      success: true,
      message: '邮箱绑定成功'
    };
  } catch (error) {
    console.error('绑定邮箱错误:', error);
    return {
      success: false,
      message: '邮箱绑定失败，请稍后重试'
    };
  }
};

// 获取账号安全设置
exports.getSecuritySettings = async (userId) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, phone, email, password, privacy_settings, created_at FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    const user = users[0];
    
    const settings = {
      hasPassword: !!user.password,
      hasEmail: !!user.email,
      createdAt: user.created_at,
      privacySettings: user.privacy_settings || {
        record_visible: 'self',
        allow_data_analysis: true,
        receive_notifications: true
      }
    };
    
    return {
      success: true,
      settings
    };
  } catch (error) {
    console.error('获取安全设置错误:', error);
    return {
      success: false,
      message: '获取安全设置失败'
    };
  }
};

// 更新隐私设置
exports.updatePrivacySettings = async (userId, privacySettings) => {
  try {
    // 检查用户是否存在并获取当前隐私设置
    const [users] = await pool.execute(
      'SELECT id, privacy_settings FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    const user = users[0];
    
    // 合并旧的隐私设置和新的隐私设置
    const currentSettings = user.privacy_settings || {
      record_visible: 'self',
      allow_data_analysis: true,
      receive_notifications: true
    };
    
    const updatedSettings = {
      ...currentSettings,
      ...privacySettings
    };
    
    // 更新隐私设置
    await pool.execute(
      'UPDATE users SET privacy_settings = ?, updated_at = ? WHERE id = ?',
      [updatedSettings, new Date(), userId]
    );
    
    return {
      success: true,
      settings: updatedSettings
    };
  } catch (error) {
    console.error('更新隐私设置错误:', error);
    return {
      success: false,
      message: '更新隐私设置失败'
    };
  }
};

// 获取用户统计信息
exports.getUserStats = async (userId) => {
  try {
    // TODO: 实现用户统计信息，如记录总数、最近登录时间等
    // 这个功能将在后续实现
    
    return {
      success: true,
      stats: {
        totalRecords: 0,
        lastLogin: null,
        joinDays: 0
      }
    };
  } catch (error) {
    console.error('获取用户统计信息错误:', error);
    return {
      success: false,
      message: '获取用户统计信息失败'
    };
  }
};
