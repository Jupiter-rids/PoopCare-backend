const axios = require('axios');

// 配置
const BASE_URL = 'http://localhost:3000';
const TEST_PHONE = '18856615233';
const TEST_PASSWORD = '123456';

async function testLogin() {
  try {
    console.log('=== 测试登录功能 ===\n');
    
    // 登录
    console.log('1. 发送登录请求...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      phone: TEST_PHONE,
      password: TEST_PASSWORD
    });
    
    console.log('登录成功！');
    console.log('响应状态码:', loginResponse.status);
    console.log('响应数据:', JSON.stringify(loginResponse.data, null, 2));
    
    const token = loginResponse.data.data?.token;
    if (token) {
      console.log('\n2. 验证token是否有效...');
      const verifyResponse = await axios.post(`${BASE_URL}/api/auth/verify-token`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Token验证成功！');
      console.log('响应数据:', JSON.stringify(verifyResponse.data, null, 2));
    }
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试过程中发生错误:', error.response?.data || error.message);
  }
}

testLogin();