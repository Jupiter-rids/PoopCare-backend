const express = require('express');
const { body, validationResult } = require('express-validator');
const healthRecordController = require('../controllers/healthRecordController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// 添加健康记录验证规则
const addRecordValidationRules = [
  // 支持前端发送的time字段
  body('time').optional().isISO8601().withMessage('记录时间格式无效'),
  body('record_time').optional().isISO8601().withMessage('记录时间格式无效'),
  // 支持前端发送的typeIndex（用于映射shape）
  body('typeIndex').optional().isInt({ min: 0, max: 6 }).withMessage('排便类型索引必须是0-6之间的整数'),
  // 支持前端发送的shape（可以是字符串或数字）
  body('shape').optional().custom((value) => {
    if (typeof value === 'string') {
      // 字符串类型：必须是'type_1'到'type_7'
      return ['type_1', 'type_2', 'type_3', 'type_4', 'type_5', 'type_6', 'type_7'].includes(value);
    } else if (typeof value === 'number') {
      // 数字类型：必须是1到7之间的整数
      return Number.isInteger(value) && value >= 1 && value <= 7;
    }
    return false;
  }).withMessage('排便类型无效'),
  // 支持前端发送的moodIndex（用于映射feeling）
  body('moodIndex').optional().isInt({ min: 0, max: 3 }).withMessage('排便感受索引必须是0-3之间的整数'),
  // 支持前端发送的feeling（可以是字符串或数字）
  body('feeling').optional().custom((value) => {
    if (typeof value === 'string') {
      // 字符串类型：必须是'smooth', 'normal', 'difficult', 'painful'
      return ['smooth', 'normal', 'difficult', 'painful'].includes(value);
    } else if (typeof value === 'number') {
      // 数字类型：必须是0到3之间的整数
      return Number.isInteger(value) && value >= 0 && value <= 3;
    }
    return false;
  }).withMessage('排便感受无效'),
  // 其他字段
  body('color').optional().isIn(['yellow', 'brown', 'dark_brown', 'green', 'black', 'red', 'white', 'other']).withMessage('颜色选项无效'),
  body('frequency').optional().isInt({ min: 1, max: 20 }).withMessage('排便次数必须是1-20之间的整数'),
  body('has_blood').optional().isBoolean().withMessage('是否带血必须是布尔值'),
  body('has_mucus').optional().isBoolean().withMessage('是否带黏液必须是布尔值'),
  body('has_pus').optional().isBoolean().withMessage('是否带脓液必须是布尔值'),
  body('odor_intensity').optional().isIn(['mild', 'moderate', 'strong', 'very_strong']).withMessage('气味强度无效'),
  body('hardness').optional().isIn(['very_soft', 'soft', 'normal', 'hard', 'very_hard']).withMessage('大便硬度无效'),
  body('symptoms').optional().isArray().withMessage('症状必须是数组格式'),
  body('otherSymptom').optional().isString().trim().isLength({ max: 100 }).withMessage('其他症状长度不能超过100个字符'),
  body('note').optional().isString().trim().isLength({ max: 500 }).withMessage('备注长度不能超过500个字符'),
  body('notes').optional().isString().trim().isLength({ max: 500 }).withMessage('备注长度不能超过500个字符'),
  body('photos').optional().isArray().withMessage('图片必须是数组格式'),
  body('visibility').optional().isIn(['self', 'anonymous']).withMessage('可见性设置无效')
];

// 获取健康记录列表
router.get('/', authMiddleware.verifyToken, async (req, res) => {
  try {
    // 解析查询参数
    const { 
      record_type, 
      start_date, 
      end_date, 
      page = 1, 
      limit = 20,
      sort_by = 'time',
      sort_order = 'desc'
    } = req.query;
    
    const result = await healthRecordController.getHealthRecords(
      req.userId,
      {
        start_date,
        end_date,
        page: parseInt(page),
        limit: parseInt(limit),
        sort_by,
        sort_order
      }
    );
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        data: result.records,
        pagination: result.pagination
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || '获取记录失败'
      });
    }
  } catch (error) {
    console.error('获取健康记录列表错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取健康记录详情
router.get('/:recordId', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { recordId } = req.params;
    const result = await healthRecordController.getHealthRecordDetail(req.userId, recordId);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        data: result.record
      });
    } else {
      return res.status(404).json({
        success: false,
        message: result.message || '记录不存在'
      });
    }
  } catch (error) {
    console.error('获取健康记录详情错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 添加健康记录
router.post('/', authMiddleware.verifyToken, addRecordValidationRules, async (req, res) => {
  try {
    // 验证请求数据
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '请求数据验证失败',
        errors: errors.array()
      });
    }
    
    const recordData = req.body;
    const result = await healthRecordController.addHealthRecord(req.userId, recordData);
    
    if (result.success) {
      return res.status(201).json({
        success: true,
        message: '记录添加成功',
        data: result.record
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || '添加记录失败'
      });
    }
  } catch (error) {
    console.error('添加健康记录错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 更新健康记录
router.put('/:recordId', authMiddleware.verifyToken, addRecordValidationRules, async (req, res) => {
  try {
    // 验证请求数据
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '请求数据验证失败',
        errors: errors.array()
      });
    }
    
    const { recordId } = req.params;
    const recordData = req.body;
    const result = await healthRecordController.updateHealthRecord(req.userId, recordId, recordData);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: '记录更新成功',
        data: result.record
      });
    } else {
      return res.status(404).json({
        success: false,
        message: result.message || '更新记录失败'
      });
    }
  } catch (error) {
    console.error('更新健康记录错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 删除健康记录
router.delete('/:recordId', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { recordId } = req.params;
    const result = await healthRecordController.deleteHealthRecord(req.userId, recordId);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: '记录删除成功'
      });
    } else {
      return res.status(404).json({
        success: false,
        message: result.message || '删除记录失败'
      });
    }
  } catch (error) {
    console.error('删除健康记录错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取健康记录统计
router.get('/statistics/summary', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const result = await healthRecordController.getHealthRecordStatistics(req.userId, period);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        data: result.statistics
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || '获取统计信息失败'
      });
    }
  } catch (error) {
    console.error('获取健康记录统计错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

module.exports = router;
