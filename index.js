const express = require('express');
const router = express.Router();
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../config/swagger');

// 导入认证中间件
const authMiddleware = require('../middleware/authMiddleware');

// 导入各模块路由
const authRoutes = require('./auth');
const userRoutes = require('./user');
const healthRecordRoutes = require('./health-record');
const statisticsRoutes = require('./statistics');
const healthScoreRoutes = require('./health-score');
const notificationRoutes = require('./notification');

// 添加API文档路由（无需认证）
router.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
router.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// 注册认证相关路由（无需认证）
router.use('/api/auth', authRoutes);

// 需要认证的路由
const protectedRoutes = express.Router();
protectedRoutes.use(authMiddleware.verifyToken);

// 注册需要认证的路由
protectedRoutes.use('/user', userRoutes);
protectedRoutes.use('/health-record', healthRecordRoutes);
protectedRoutes.use('/statistics', statisticsRoutes);
protectedRoutes.use('/health-scores', healthScoreRoutes);
protectedRoutes.use('/notifications', notificationRoutes);

// 将受保护的路由挂载到主路由，添加api前缀
router.use('/api', protectedRoutes);

// 添加仪表盘路由
router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// 导出路由
module.exports = router;
