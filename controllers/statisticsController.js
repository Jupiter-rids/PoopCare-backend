const { validationResult } = require('express-validator');
const Statistics = require('../models/Statistics');
const HealthRecord = require('../models/HealthRecord');
const HealthScore = require('../models/HealthScore');
const { pool } = require('../config/database');

// 添加一些工具函数
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// 获取用户某天的健康统计数据
exports.getDailyStats = async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.userId;
    const date = req.query.date;
    
    // 查询统计数据
    let stats = await Statistics.getUserStats(userId, 'daily', date);
    
    // 如果不存在，则计算
    if (!stats) {
      stats = await Statistics.calculateDailyStats(userId, date);
    }
    
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('获取日统计数据失败:', error);
    return res.status(500).json({ success: false, message: '获取日统计数据失败', error: error.message });
  }
};

// 获取用户某周的健康统计数据
exports.getWeeklyStats = async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.userId;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    
    // 查询统计数据
    let stats = await Statistics.getUserStats(userId, 'weekly', startDate, endDate);
    
    // 如果不存在，则计算
    if (!stats) {
      stats = await Statistics.calculateWeeklyStats(userId, startDate, endDate);
    }
    
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('获取周统计数据失败:', error);
    return res.status(500).json({ success: false, message: '获取周统计数据失败', error: error.message });
  }
};

// 获取用户某月的健康统计数据
exports.getMonthlyStats = async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.userId;
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month);
    
    // 生成日期范围
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
    
    // 查询统计数据
    let stats = await Statistics.getUserStats(userId, 'monthly', startDate, endDate);
    
    // 如果不存在，则计算
    if (!stats) {
      stats = await Statistics.calculateMonthlyStats(userId, year, month);
    }
    
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('获取月统计数据失败:', error);
    return res.status(500).json({ success: false, message: '获取月统计数据失败', error: error.message });
  }
};

// 获取用户总体健康统计数据
exports.getOverallStats = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 查询统计数据
    let stats = await Statistics.getUserStats(userId, 'overall');
    
    // 如果不存在，则计算
    if (!stats) {
      stats = await Statistics.calculateOverallStats(userId);
    }
    
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('获取总体统计数据失败:', error);
    return res.status(500).json({ success: false, message: '获取总体统计数据失败', error: error.message });
  }
};

// 重新计算用户某天的健康统计数据
exports.recalculateDailyStats = async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.userId;
    const date = req.query.date;
    
    // 删除旧的统计数据
    await Statistics.destroyStats(userId, 'daily', { statsDate: date });
    
    // 计算新的统计数据
    const stats = await Statistics.calculateDailyStats(userId, date);
    
    return res.status(200).json({ success: true, data: stats, message: '日统计数据重新计算成功' });
  } catch (error) {
    console.error('重新计算日统计数据失败:', error);
    return res.status(500).json({ success: false, message: '重新计算日统计数据失败', error: error.message });
  }
};

// 重新计算用户某周的健康统计数据
exports.recalculateWeeklyStats = async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.userId;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    
    // 删除旧的统计数据
    await Statistics.destroyStats(userId, 'weekly', { startDate, endDate });
    
    // 计算新的统计数据
    const stats = await Statistics.calculateWeeklyStats(userId, startDate, endDate);
    
    return res.status(200).json({ success: true, data: stats, message: '周统计数据重新计算成功' });
  } catch (error) {
    console.error('重新计算周统计数据失败:', error);
    return res.status(500).json({ success: false, message: '重新计算周统计数据失败', error: error.message });
  }
};

// 重新计算用户某月的健康统计数据
exports.recalculateMonthlyStats = async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.userId;
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month);
    
    // 生成日期范围
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
    
    // 删除旧的统计数据
    await Statistics.destroyStats(userId, 'monthly', { startDate, endDate });
    
    // 计算新的统计数据
    const stats = await Statistics.calculateMonthlyStats(userId, year, month);
    
    return res.status(200).json({ success: true, data: stats, message: '月统计数据重新计算成功' });
  } catch (error) {
    console.error('重新计算月统计数据失败:', error);
    return res.status(500).json({ success: false, message: '重新计算月统计数据失败', error: error.message });
  }
};

// 重新计算用户总体健康统计数据
exports.recalculateOverallStats = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 删除旧的统计数据
    await Statistics.destroyStats(userId, 'overall');
    
    // 计算新的统计数据
    const stats = await Statistics.calculateOverallStats(userId);
    
    return res.status(200).json({ success: true, data: stats, message: '总体统计数据重新计算成功' });
  } catch (error) {
    console.error('重新计算总体统计数据失败:', error);
    return res.status(500).json({ success: false, message: '重新计算总体统计数据失败', error: error.message });
  }
};

// 获取用户日统计历史（分页）
exports.getDailyStatsHistory = async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 30;
    
    // 构建查询条件
    const options = {
      page,
      pageSize
    };
    
    // 添加日期范围过滤（如果有）
    if (req.query.start_date && req.query.end_date) {
      options.startDate = req.query.start_date;
      options.endDate = req.query.end_date;
    }
    
    // 查询统计历史
    const result = await Statistics.getUserStatsHistory(userId, 'daily', options);
    
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('获取日统计历史失败:', error);
    return res.status(500).json({ success: false, message: '获取日统计历史失败', error: error.message });
  }
};

// 获取用户周统计历史（分页）
exports.getWeeklyStatsHistory = async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 30;
    
    // 构建查询条件
    const options = {
      page,
      pageSize
    };
    
    // 添加日期范围过滤（如果有）
    if (req.query.start_date && req.query.end_date) {
      options.startDate = req.query.start_date;
      options.endDate = req.query.end_date;
    }
    
    // 查询统计历史
    const result = await Statistics.getUserStatsHistory(userId, 'weekly', options);
    
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('获取周统计历史失败:', error);
    return res.status(500).json({ success: false, message: '获取周统计历史失败', error: error.message });
  }
};

// 获取用户月统计历史（分页）
exports.getMonthlyStatsHistory = async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 30;
    
    // 构建查询条件
    const options = {
      page,
      pageSize
    };
    
    // 添加日期范围过滤（如果有）
    if (req.query.start_date && req.query.end_date) {
      options.startDate = req.query.start_date;
      options.endDate = req.query.end_date;
    }
    
    // 查询统计历史
    const result = await Statistics.getUserStatsHistory(userId, 'monthly', options);
    
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('获取月统计历史失败:', error);
    return res.status(500).json({ success: false, message: '获取月统计历史失败', error: error.message });
  }
};

// 获取用户的平均健康评分
exports.getAverageHealthScore = async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.userId;
    const dateRange = req.query.date_range || '30days';
    
    // 获取平均评分
    const averageScore = await HealthScore.getAverageScore(userId, dateRange);
    
    return res.status(200).json({ 
      success: true, 
      data: { 
        average_score: averageScore,
        date_range: dateRange
      } 
    });
  } catch (error) {
    console.error('获取平均健康评分失败:', error);
    return res.status(500).json({ success: false, message: '获取平均健康评分失败', error: error.message });
  }
};

// 获取用户的健康评分趋势
exports.getHealthScoreTrend = async (req, res) => {
  try {
    const userId = req.userId;
    const days = parseInt(req.query.days) || 30;
    
    // 计算开始日期
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // 查询评分数据
    const sql = `
      SELECT score_date, total_score 
      FROM health_scores 
      WHERE user_id = ? 
        AND score_date >= ? 
        AND score_date <= ? 
        AND score_type = 'daily' 
        AND deleted_at IS NULL
      ORDER BY score_date ASC
    `;
    const [scores] = await pool.execute(sql, [
      userId, 
      formatDate(startDate), 
      formatDate(endDate)
    ]);
    
    // 格式化趋势数据
    const trendData = scores.map(score => ({
      date: score.score_date,
      score: score.total_score
    }));
    
    return res.status(200).json({ 
      success: true, 
      data: {
        trend: trendData,
        days,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate)
      } 
    });
  } catch (error) {
    console.error('获取健康评分趋势失败:', error);
    return res.status(500).json({ success: false, message: '获取健康评分趋势失败', error: error.message });
  }
};

// 获取用户的大便颜色分布统计
exports.getColorDistribution = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 先尝试获取总体统计
    let stats = await Statistics.getUserStats(userId, 'overall');
    
    // 如果不存在，则计算
    if (!stats) {
      stats = await Statistics.calculateOverallStats(userId);
    }
    
    return res.status(200).json({ 
      success: true, 
      data: { 
        color_distribution: stats.color_distribution,
        most_common_color: stats.most_common_color
      } 
    });
  } catch (error) {
    console.error('获取颜色分布统计失败:', error);
    return res.status(500).json({ success: false, message: '获取颜色分布统计失败', error: error.message });
  }
};

// 获取用户的大便形状分布统计
exports.getShapeDistribution = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 先尝试获取总体统计
    let stats = await Statistics.getUserStats(userId, 'overall');
    
    // 如果不存在，则计算
    if (!stats) {
      stats = await Statistics.calculateOverallStats(userId);
    }
    
    return res.status(200).json({ 
      success: true, 
      data: { 
        shape_distribution: stats.shape_distribution,
        most_common_shape: stats.most_common_shape
      } 
    });
  } catch (error) {
    console.error('获取形状分布统计失败:', error);
    return res.status(500).json({ success: false, message: '获取形状分布统计失败', error: error.message });
  }
};

// 获取用户的排便感觉分布统计
exports.getFeelingDistribution = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 先尝试获取总体统计
    let stats = await Statistics.getUserStats(userId, 'overall');
    
    // 如果不存在，则计算
    if (!stats) {
      stats = await Statistics.calculateOverallStats(userId);
    }
    
    return res.status(200).json({ 
      success: true, 
      data: { 
        feeling_distribution: stats.feeling_distribution
      } 
    });
  } catch (error) {
    console.error('获取感觉分布统计失败:', error);
    return res.status(500).json({ success: false, message: '获取感觉分布统计失败', error: error.message });
  }
};

// 获取用户的异常情况统计摘要
exports.getAbnormalSummary = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 先尝试获取总体统计
    let stats = await Statistics.getUserStats(userId, 'overall');
    
    // 如果不存在，则计算
    if (!stats) {
      stats = await Statistics.calculateOverallStats(userId);
    }
    
    // 构建异常摘要
    const abnormalSummary = {
      has_abnormal_pattern: stats.has_abnormal_pattern,
      abnormal_pattern_description: stats.abnormal_pattern_description,
      abnormal_stats: stats.abnormal_stats
    };
    
    return res.status(200).json({ 
      success: true, 
      data: abnormalSummary 
    });
  } catch (error) {
    console.error('获取异常情况统计摘要失败:', error);
    return res.status(500).json({ success: false, message: '获取异常情况统计摘要失败', error: error.message });
  }
};

// 获取用户的症状统计摘要
exports.getSymptomSummary = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 先尝试获取总体统计
    let stats = await Statistics.getUserStats(userId, 'overall');
    
    // 如果不存在，则计算
    if (!stats) {
      stats = await Statistics.calculateOverallStats(userId);
    }
    
    // 构建症状摘要
    const symptomSummary = {
      symptom_stats: stats.symptom_stats
    };
    
    return res.status(200).json({ 
      success: true, 
      data: symptomSummary 
    });
  } catch (error) {
    console.error('获取症状统计摘要失败:', error);
    return res.status(500).json({ success: false, message: '获取症状统计摘要失败', error: error.message });
  }
};

// 比较两个时间段的健康统计数据
exports.compareTimePeriods = async (req, res) => {
  try {
    // 验证输入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.userId;
    const { start_date_1, end_date_1, start_date_2, end_date_2 } = req.query;
    
    // 获取第一个时间段的记录
    const sql1 = `
      SELECT * FROM poop_records 
      WHERE user_id = ? 
        AND record_date >= ? 
        AND record_date <= ? 
        AND deleted_at IS NULL
    `;
    const [records1] = await pool.execute(sql1, [userId, start_date_1, end_date_1]);
    
    // 获取第二个时间段的记录
    const sql2 = `
      SELECT * FROM poop_records 
      WHERE user_id = ? 
        AND record_date >= ? 
        AND record_date <= ? 
        AND deleted_at IS NULL
    `;
    const [records2] = await pool.execute(sql2, [userId, start_date_2, end_date_2]);
    
    // 计算每个时间段的统计指标
    const compareData = {
      period_1: {
        start_date: start_date_1,
        end_date: end_date_1,
        total_records: records1.length
      },
      period_2: {
        start_date: start_date_2,
        end_date: end_date_2,
        total_records: records2.length
      },
      comparison: {}
    };
    
    // 如果有记录，计算更多统计指标
    if (records1.length > 0) {
      const totalFrequency1 = records1.reduce((sum, record) => sum + record.frequency, 0);
      compareData.period_1.average_frequency = Math.round((totalFrequency1 / records1.length) * 10) / 10;
      
      // 计算平均分
      const totalScore1 = records1.reduce((sum, record) => sum + (record.health_score || 0), 0);
      compareData.period_1.average_health_score = Math.round(totalScore1 / records1.length);
    }
    
    if (records2.length > 0) {
      const totalFrequency2 = records2.reduce((sum, record) => sum + record.frequency, 0);
      compareData.period_2.average_frequency = Math.round((totalFrequency2 / records2.length) * 10) / 10;
      
      // 计算平均分
      const totalScore2 = records2.reduce((sum, record) => sum + (record.health_score || 0), 0);
      compareData.period_2.average_health_score = Math.round(totalScore2 / records2.length);
    }
    
    // 计算比较数据
    compareData.comparison.record_count_change = compareData.period_2.total_records - compareData.period_1.total_records;
    
    if (compareData.period_1.average_health_score !== undefined && compareData.period_2.average_health_score !== undefined) {
      compareData.comparison.score_change = compareData.period_2.average_health_score - compareData.period_1.average_health_score;
    }
    
    if (compareData.period_1.average_frequency !== undefined && compareData.period_2.average_frequency !== undefined) {
      compareData.comparison.frequency_change = Math.round((compareData.period_2.average_frequency - compareData.period_1.average_frequency) * 10) / 10;
    }
    
    return res.status(200).json({ success: true, data: compareData });
  } catch (error) {
    console.error('比较时间段统计数据失败:', error);
    return res.status(500).json({ success: false, message: '比较时间段统计数据失败', error: error.message });
  }
};