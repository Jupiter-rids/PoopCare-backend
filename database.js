const mysql = require('mysql2/promise');
const config = require('./config');

// 调试：查看config结构
console.log('当前环境:', process.env.NODE_ENV);
console.log('config结构:', config);
console.log('config.database:', config.database);

// 创建MySQL连接池
const pool = mysql.createPool({
  host: config.database.host,      // 主机地址
  port: config.database.port,      // 端口号
  user: config.database.username,  // 用户名
  password: config.database.password, // 密码
  database: config.database.database, // 数据库名
  charset: 'utf8mb4',              // 字符集
  collation: 'utf8mb4_unicode_ci', // 校对规则
  waitForConnections: true,        // 当连接池没有可用连接时，是否等待
  connectionLimit: config.database.pool?.max || 5, // 最大连接数
  queueLimit: 0,                   // 连接请求队列的最大长度，0表示无限制
  namedPlaceholders: true          // 启用命名占位符
});

// 提供一个简单的方法来测试数据库连接
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('数据库连接测试成功！');
    connection.release();
    return true;
  } catch (error) {
    console.error('数据库连接测试失败:', error);
    return false;
  }
};

// 导出连接池和测试方法
module.exports = {
  pool,
  testConnection
};
