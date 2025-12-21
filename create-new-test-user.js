const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const config = require('./config/config');

async function createNewTestUser() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: config.database.host,
      port: config.database.port,
      user: config.database.username,
      password: config.database.password,
      database: config.database.database
    });

    const newPhone = '18856615233';
    const newPassword = '123456';
    const username = `test_user_${newPhone.slice(-4)}`;

    // 检查用户是否已存在
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE phone = ?',
      [newPhone]
    );

    if (existingUsers.length > 0) {
      console.log(`用户 ${newPhone} 已存在，正在更新密码...`);
      const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);
      await connection.execute(
        'UPDATE users SET password = ? WHERE phone = ?',
        [hashedPassword, newPhone]
      );
    } else {
      console.log(`正在创建新的测试用户 ${newPhone}...`);
      const hashedPassword = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);
      await connection.execute(
        'INSERT INTO users (username, phone, password, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [username, newPhone, hashedPassword]
      );
    }

    console.log('\n=== 新测试用户创建成功 ===');
    console.log(`手机号: ${newPhone}`);
    console.log(`密码: ${newPassword}`);
    console.log(`用户名: ${username}`);

    await connection.end();
  } catch (error) {
    console.error('创建测试用户失败:', error.message);
    console.error('详细错误:', error);
  }
}

createNewTestUser();
