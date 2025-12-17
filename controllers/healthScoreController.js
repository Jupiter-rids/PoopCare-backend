const HealthScore = require('../models/HealthScore');
const HealthRecord = require('../models/HealthRecord');
const AppError = require('../utils/appError');
const moment = require('moment');
const { pool } = require('../config/database');

// 辅助方法：执行SQL查询获取健康评分及关联的健康记录
async function getScoreWithRecords(userId, scoreDate) {
  const sql = `
    SELECT hs.*, hr.record_id, hr.record_time, hr.color, hr.shape, hr.feeling, hr.symptoms
    FROM health_scores hs
    LEFT JOIN poop_records hr ON hs.record_id = hr.id
    WHERE hs.user_id = ?
    AND hs.score_date = ?
    AND hs.deleted_at IS NULL
    ORDER BY hs.created_at DESC
    LIMIT 1
  `;
  const [rows] = await pool.execute(sql, [userId, scoreDate]);
  return rows[0] ? {
    ...rows[0],
    recommendations: typeof rows[0].recommendations === 'string' ? JSON.parse(rows[0].recommendations) : rows[0].recommendations,
    healthRecord: rows[0].record_id ? {
      record_id: rows[0].record_id,
      record_time: rows[0].record_time,
      color: rows[0].color,
      shape: rows[0].shape,
      feeling: rows[0].feeling,
      symptoms: rows[0].symptoms
    } : null
  } : null;
}

// 辅助方法：执行带日期范围的查询
async function getScoresInDateRange(userId, startDate, endDate, attributes = null) {
  const attr = attributes ? attributes.join(', ') : '*';
  const sql = `
    SELECT ${attr} FROM health_scores
    WHERE user_id = ?
    AND score_date BETWEEN ? AND ?
    AND deleted_at IS NULL
    ORDER BY score_date ASC
  `;
  const [rows] = await pool.execute(sql, [userId, startDate, endDate]);
  return rows.map(row => {
    if (row.recommendations && typeof row.recommendations === 'string') {
      row.recommendations = JSON.parse(row.recommendations);
    }
    return row;
  });
}

class HealthScoreController {
  // 1. 获取今日健康评分
  async getTodayScore(userId) {
    try {
      const today = moment().format('YYYY-MM-DD');
      
      const score = await getScoreWithRecords(userId, today);
      
      if (!score) {
        return {
          exists: false,
          message: '今日暂无健康评分'
        };
      }
      
      return {
        exists: true,
        data: {
          id: score.id,
          total_score: score.total_score,
          health_level: score.health_level,
          score_date: score.score_date,
          details: {
            poop_health_score: score.poop_health_score,
            frequency_health_score: score.frequency_health_score,
            symptom_health_score: score.symptom_health_score
          },
          health_description: score.health_description,
          recommendations: score.recommendations,
          related_records: score.healthRecord ? [score.healthRecord] : []
        }
      };
    } catch (error) {
      throw new AppError('获取今日健康评分失败', 500, { error: error.message });
    }
  }

  // 2. 获取本周健康评分趋势
  async getWeekTrend(userId, date) {
    try {
      const weekStart = moment(date).startOf('week');
      const weekEnd = moment(date).endOf('week');
      
      const scores = await getScoresInDateRange(
        userId, 
        weekStart.format('YYYY-MM-DD'), 
        weekEnd.format('YYYY-MM-DD'),
        ['score_date', 'total_score', 'health_level']
      );
      
      // 构建完整的一周数据，填充缺失日期
      const weekData = [];
      for (let i = 0; i < 7; i++) {
        const currentDate = moment(weekStart).add(i, 'days');
        const score = scores.find(s => moment(s.score_date).isSame(currentDate, 'day'));
        
        weekData.push({
          date: currentDate.format('YYYY-MM-DD'),
          day_of_week: currentDate.format('dddd'),
          total_score: score ? score.total_score : 0,
          health_level: score ? score.health_level : null,
          has_record: !!score
        });
      }
      
      const averageScore = scores.length > 0 
        ? scores.reduce((sum, s) => sum + s.total_score, 0) / scores.length 
        : 0;
      
      return {
        week_range: {
          start: weekStart.format('YYYY-MM-DD'),
          end: weekEnd.format('YYYY-MM-DD')
        },
        average_score: Math.round(averageScore * 100) / 100,
        daily_scores: weekData,
        total_days_recorded: scores.length
      };
    } catch (error) {
      throw new AppError('获取本周健康评分趋势失败', 500, { error: error.message });
    }
  }

  // 3. 获取月度健康评分趋势
  async getMonthTrend(userId, year, month) {
    try {
      const monthStart = moment().year(year).month(month - 1).startOf('month');
      const monthEnd = moment().year(year).month(month - 1).endOf('month');
      
      const scores = await getScoresInDateRange(
        userId, 
        monthStart.format('YYYY-MM-DD'), 
        monthEnd.format('YYYY-MM-DD'),
        ['score_date', 'total_score', 'health_level']
      );
      
      // 按周分组统计
      const weeklyData = [];
      let currentWeekStart = moment(monthStart).startOf('week');
      
      while (currentWeekStart.isBefore(monthEnd)) {
        const currentWeekEnd = moment(currentWeekStart).endOf('week');
        const weekEnd = currentWeekEnd.isAfter(monthEnd) ? monthEnd : currentWeekEnd;
        
        const weekScores = scores.filter(s => 
          moment(s.score_date).isBetween(currentWeekStart, weekEnd, null, '[]')
        );
        
        const averageScore = weekScores.length > 0
          ? weekScores.reduce((sum, s) => sum + s.total_score, 0) / weekScores.length
          : 0;
        
        weeklyData.push({
          week_range: {
            start: currentWeekStart.format('YYYY-MM-DD'),
            end: weekEnd.format('YYYY-MM-DD')
          },
          average_score: Math.round(averageScore * 100) / 100,
          days_recorded: weekScores.length,
          scores: weekScores.map(s => ({
            date: moment(s.score_date).format('YYYY-MM-DD'),
            score: s.total_score,
            level: s.health_level
          }))
        });
        
        currentWeekStart.add(1, 'week');
      }
      
      const totalAverageScore = scores.length > 0
        ? scores.reduce((sum, s) => sum + s.total_score, 0) / scores.length
        : 0;
      
      return {
        month: {
          year,
          month,
          display: moment().year(year).month(month - 1).format('YYYY年MM月')
        },
        total_average_score: Math.round(totalAverageScore * 100) / 100,
        total_days_recorded: scores.length,
        weekly_data: weeklyData,
        daily_scores: scores.map(s => ({
          date: moment(s.score_date).format('YYYY-MM-DD'),
          score: s.total_score,
          level: s.health_level
        }))
      };
    } catch (error) {
      throw new AppError('获取月度健康评分趋势失败', 500, { error: error.message });
    }
  }

  // 4. 获取历史健康评分记录（分页）
  async getHistoryScores(userId, page, limit, startDate, endDate) {
    try {
      const offset = (page - 1) * limit;
      
      // 构建查询条件
      let whereSql = 'WHERE user_id = ? AND deleted_at IS NULL';
      const params = [userId];
      
      if (startDate && endDate) {
        whereSql += ' AND score_date BETWEEN ? AND ?';
        params.push(startDate, endDate);
      } else if (startDate) {
        whereSql += ' AND score_date >= ?';
        params.push(startDate);
      } else if (endDate) {
        whereSql += ' AND score_date <= ?';
        params.push(endDate);
      }
      
      // 查询记录
      const rowsSql = `
        SELECT id, total_score, health_level, score_date,
               poop_health_score, frequency_health_score, symptom_health_score
        FROM health_scores
        ${whereSql}
        ORDER BY score_date DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await pool.execute(rowsSql, [...params, limit, offset]);
      
      // 查询总数
      const countSql = `
        SELECT COUNT(*) as count FROM health_scores
        ${whereSql}
      `;
      const [countResult] = await pool.execute(countSql, params);
      const count = countResult[0].count;
      
      return {
        total: count,
        page,
        limit,
        total_pages: Math.ceil(count / limit),
        data: rows.map(score => ({
          id: score.id,
          date: moment(score.score_date).format('YYYY-MM-DD'),
          total_score: score.total_score,
          health_level: score.health_level,
          details: {
            poop_health_score: score.poop_health_score,
            frequency_health_score: score.frequency_health_score,
            symptom_health_score: score.symptom_health_score
          }
        }))
      };
    } catch (error) {
      throw new AppError('获取历史健康评分记录失败', 500, { error: error.message });
    }
  }

  // 5. 获取健康评分详情
  async getScoreDetail(userId, scoreId) {
    try {
      const sql = `
        SELECT hs.*, hr.record_id, hr.record_time, hr.color, hr.shape, hr.feeling, hr.symptoms,
               hr.frequency, hr.has_blood, hr.has_mucus, hr.notes
        FROM health_scores hs
        LEFT JOIN poop_records hr ON hs.record_id = hr.id
        WHERE hs.id = ? AND hs.user_id = ? AND hs.deleted_at IS NULL
        LIMIT 1
      `;
      
      const [rows] = await pool.execute(sql, [scoreId, userId]);
      const score = rows[0];
      
      if (!score) {
        throw new AppError('健康评分记录不存在', 404);
      }
      
      // 处理JSON字段
      if (score.recommendations && typeof score.recommendations === 'string') {
        score.recommendations = JSON.parse(score.recommendations);
      }
      
      return {
        id: score.id,
        date: moment(score.score_date).format('YYYY-MM-DD'),
        total_score: score.total_score,
        health_level: score.health_level,
        health_description: score.health_description,
        level_description: this.getLevelDescription(score.health_level),
        details: {
          poop_health_score: score.poop_health_score,
          frequency_health_score: score.frequency_health_score,
          symptom_health_score: score.symptom_health_score
        },
        recommendations: score.recommendations,
        related_records: score.record_id ? [{
          id: score.record_id,
          record_time: moment(score.record_time).format('YYYY-MM-DD HH:mm:ss'),
          color: score.color,
          shape: score.shape,
          feeling: score.feeling,
          symptoms: score.symptoms || [],
          frequency: score.frequency,
          has_blood: score.has_blood,
          has_mucus: score.has_mucus,
          notes: score.notes
        }] : [],
        created_at: moment(score.created_at).format('YYYY-MM-DD HH:mm:ss'),
        updated_at: moment(score.updated_at).format('YYYY-MM-DD HH:mm:ss')
      };
    } catch (error) {
      if (error.statusCode === 404) {
        throw error;
      }
      throw new AppError('获取健康评分详情失败', 500, { error: error.message });
    }
  }

  // 6. 获取健康等级分布统计
  async getLevelDistribution(userId, period, date) {
    try {
      let startDate, endDate;
      const mDate = moment(date);
      
      switch (period) {
        case 'week':
          startDate = mDate.startOf('week');
          endDate = mDate.endOf('week');
          break;
        case 'month':
          startDate = mDate.startOf('month');
          endDate = mDate.endOf('month');
          break;
        case 'quarter':
          startDate = mDate.startOf('quarter');
          endDate = mDate.endOf('quarter');
          break;
        case 'year':
          startDate = mDate.startOf('year');
          endDate = mDate.endOf('year');
          break;
        default:
          throw new AppError('无效的统计周期', 400);
      }
      
      const scores = await getScoresInDateRange(
        userId, 
        startDate.format('YYYY-MM-DD'), 
        endDate.format('YYYY-MM-DD'),
        ['health_level']
      );
      
      // 统计各等级数量
      const distribution = {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
        bad: 0
      };
      
      scores.forEach(score => {
        if (distribution.hasOwnProperty(score.health_level)) {
          distribution[score.health_level]++;
        }
      });
      
      const total = scores.length;
      
      return {
        period,
        date_range: {
          start: startDate.format('YYYY-MM-DD'),
          end: endDate.format('YYYY-MM-DD')
        },
        distribution: Object.entries(distribution).map(([level, count]) => ({
          level,
          level_name: this.getLevelName(level),
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0
        })),
        total_records: total
      };
    } catch (error) {
      if (error.statusCode === 400) {
        throw error;
      }
      throw new AppError('获取健康等级分布失败', 500, { error: error.message });
    }
  }

  // 7. 获取健康评分平均趋势（按周/月）
  async getAverageTrend(userId, type, count) {
    try {
      const trends = [];
      const now = moment();
      
      for (let i = count - 1; i >= 0; i--) {
        let startDate, endDate, label;
        
        if (type === 'week') {
          startDate = now.clone().subtract(i, 'weeks').startOf('week');
          endDate = now.clone().subtract(i, 'weeks').endOf('week');
          label = `第${startDate.week()}周`;
        } else if (type === 'month') {
          startDate = now.clone().subtract(i, 'months').startOf('month');
          endDate = now.clone().subtract(i, 'months').endOf('month');
          label = startDate.format('YYYY年MM月');
        }
        
        const scores = await getScoresInDateRange(
          userId, 
          startDate.format('YYYY-MM-DD'), 
          endDate.format('YYYY-MM-DD'),
          ['total_score']
        );
        
        const averageScore = scores.length > 0
          ? scores.reduce((sum, s) => sum + s.total_score, 0) / scores.length
          : 0;
        
        trends.push({
          period: {
            start: startDate.format('YYYY-MM-DD'),
            end: endDate.format('YYYY-MM-DD'),
            label
          },
          average_score: Math.round(averageScore * 100) / 100,
          records_count: scores.length
        });
      }
      
      return {
        type,
        count,
        trends
      };
    } catch (error) {
      throw new AppError('获取健康评分平均趋势失败', 500, { error: error.message });
    }
  }

  // 8. 获取健康建议
  async getHealthAdvice(userId) {
    try {
      // 获取最近7天的健康评分
      const sevenDaysAgo = moment().subtract(7, 'days').format('YYYY-MM-DD');
      const today = moment().format('YYYY-MM-DD');
      const recentScores = await getScoresInDateRange(
        userId, 
        sevenDaysAgo, 
        today,
        ['total_score', 'health_level', 'recommendations']
      );
      
      if (recentScores.length === 0) {
        return {
          has_recent_data: false,
          general_advice: this.getGeneralAdvice()
        };
      }
      
      // 分析最近评分趋势
      const scores = recentScores.map(s => s.total_score);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const trend = this.analyzeTrend(scores);
      
      // 收集所有建议
      const recommendations = new Set();
      recentScores.forEach(score => {
        if (score.recommendations) {
          const recs = typeof score.recommendations === 'string' 
            ? JSON.parse(score.recommendations)
            : score.recommendations;
          recs.forEach(rec => recommendations.add(rec));
        }
      });
      
      // 根据平均分和趋势生成建议
      const personalizedAdvice = this.generatePersonalizedAdvice(
        averageScore,
        trend,
        recentScores[0].health_level
      );
      
      return {
        has_recent_data: true,
        recent_stats: {
          average_score: Math.round(averageScore * 100) / 100,
          days_analyzed: recentScores.length,
          current_level: recentScores[0].health_level,
          trend
        },
        personalized_advice: [...recommendations, ...personalizedAdvice],
        general_advice: this.getGeneralAdvice()
      };
    } catch (error) {
      throw new AppError('获取健康建议失败', 500, { error: error.message });
    }
  }

  // 辅助方法：获取等级描述
  getLevelDescription(level) {
    const descriptions = {
      excellent: '非常健康，继续保持良好的生活习惯',
      good: '健康状态良好，注意日常维护',
      fair: '健康状态一般，需要适当调整生活和饮食习惯',
      poor: '健康状态较差，建议关注并改善',
      bad: '健康状态不佳，建议咨询医生'
    };
    return descriptions[level] || '未知等级';
  }

  // 辅助方法：获取等级名称
  getLevelName(level) {
    const names = {
      excellent: '优秀',
      good: '良好',
      fair: '一般',
      poor: '较差',
      bad: '不佳'
    };
    return names[level] || level;
  }

  // 辅助方法：分析趋势
  analyzeTrend(scores) {
    if (scores.length < 2) return 'stable';
    
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    
    const avgFirstHalf = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const avgSecondHalf = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    
    const diff = avgSecondHalf - avgFirstHalf;
    if (diff > 10) return 'improving';
    if (diff < -10) return 'declining';
    return 'stable';
  }

  // 辅助方法：生成个性化建议
  generatePersonalizedAdvice(averageScore, trend, currentLevel) {
    const advice = [];
    
    if (averageScore >= 80) {
      advice.push('您的肠道健康状况非常好，请继续保持健康的生活方式。');
      advice.push('建议定期进行记录，以便及时发现任何变化。');
    } else if (averageScore >= 60) {
      advice.push('您的肠道健康状况良好，可以通过调整饮食结构进一步改善。');
      advice.push('建议增加膳食纤维摄入，保持充足的水分。');
    } else {
      advice.push('您的肠道健康状况需要关注，建议调整饮食习惯。');
      advice.push('减少辛辣、油腻食物摄入，规律作息。');
      advice.push('如症状持续，建议咨询专业医生。');
    }
    
    if (trend === 'improving') {
      advice.push('很高兴看到您的健康状况正在改善，请继续保持！');
    } else if (trend === 'declining') {
      advice.push('注意到您的健康状况有所下降，建议关注饮食和生活习惯的调整。');
    }
    
    return advice;
  }

  // 辅助方法：获取通用建议
  getGeneralAdvice() {
    return [
      '保持规律的饮食习惯，定时定量进食。',
      '增加膳食纤维摄入，多吃蔬菜、水果和全谷物。',
      '每天保证充足的水分摄入，建议饮用2000ml左右的水。',
      '适量运动有助于促进肠道蠕动和消化。',
      '保持良好的作息，避免熬夜。',
      '减少压力，保持心情愉悦。',
      '如有持续不适，建议及时就医。'
    ];
  }
}



module.exports = new HealthScoreController();