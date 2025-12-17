const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { calculateHealthScore, shapeMap, feelingMap, defaultValues } = require('../models/HealthRecord');

// 数据映射和转换辅助函数
const mapHealthRecordData = (userId, recordData, existingRecord = null) => {
  const mappedData = {};
  
  // 如果是新记录，设置创建时间和用户ID
  if (!existingRecord) {
    mappedData.user_id = userId;
    mappedData.created_at = new Date();
  }
  
  // 处理记录时间（支持前端的time和record_time字段）
  if (recordData.time) {
    mappedData.time = new Date(recordData.time);
  } else if (recordData.record_time) {
    mappedData.time = new Date(recordData.record_time);
  } else if (!existingRecord) {
    // 新记录默认使用当前时间
    mappedData.time = new Date();
  }
  
  // 处理排便类型 (支持typeIndex/type_index和shape字段)
  if (recordData.typeIndex !== undefined && recordData.typeIndex !== null) {
    mappedData.type_index = recordData.typeIndex;
  } else if (recordData.shape !== undefined && recordData.shape !== null) {
    // 前端发送的shape是1-7，需要减1转换为0-6
    mappedData.type_index = recordData.shape - 1;
  } else if (!existingRecord) {
    mappedData.type_index = 4; // 默认正常类型
  }
  
  // 处理排便感受 (支持moodIndex/mood_index和feeling字段)
  if (recordData.moodIndex !== undefined && recordData.moodIndex !== null) {
    mappedData.mood_index = recordData.moodIndex;
  } else if (recordData.feeling !== undefined && recordData.feeling !== null) {
    mappedData.mood_index = recordData.feeling;
  } else if (!existingRecord) {
    mappedData.mood_index = 2; // 默认正常感受
  }
  
  // 处理持续时间
  if (recordData.duration) {
    mappedData.duration = recordData.duration;
  } else if (!existingRecord) {
    mappedData.duration = '5-10分钟'; // 默认持续时间
  }
  
  // 处理伴随症状
  if (recordData.symptoms && Array.isArray(recordData.symptoms)) {
    mappedData.symptoms = recordData.symptoms;
  } else if (recordData.symptoms !== undefined) {
    mappedData.symptoms = [];
  } else {
    mappedData.symptoms = [];
  }
  
  // 如果有其他症状，单独保存 (支持otherSymptom和other_symptom字段)
  if ((recordData.otherSymptom && recordData.otherSymptom.trim()) || 
      (recordData.other_symptom && recordData.other_symptom.trim())) {
    mappedData.other_symptom = (recordData.otherSymptom || recordData.other_symptom).trim();
  } else {
    mappedData.other_symptom = null;
  }
  
  // 处理备注
  if (recordData.note) {
    mappedData.note = recordData.note;
  } else if (recordData.notes) {
    mappedData.note = recordData.notes;
  } else {
    mappedData.note = null;
  }
  
  // 处理习惯
  if (recordData.habits && Array.isArray(recordData.habits)) {
    mappedData.habits = recordData.habits;
  } else if (recordData.habits !== undefined) {
    mappedData.habits = [];
  } else {
    mappedData.habits = [];
  }
  
  return mappedData;
};

// 获取健康记录列表
exports.getHealthRecords = async (userId, queryParams) => {
  try {
    const {
      start_date,
      end_date,
      page = 1,
      limit = 20,
      sort_by = 'time',
      sort_order = 'desc'
    } = queryParams;
    
    // 构建基础查询
    let sql = `SELECT * FROM poop_records WHERE user_id = ?`;
    const params = [userId];
    
    // 添加日期范围过滤
    if (start_date) {
      sql += ` AND time >= ?`;
      params.push(new Date(start_date));
    }
    
    if (end_date) {
      sql += ` AND time <= ?`;
      params.push(new Date(end_date));
    }
    
    // 构建排序规则
    const safeSortColumns = ['time', 'created_at', 'id'];
    const sortColumn = safeSortColumns.includes(sort_by) ? sort_by : 'time';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortColumn} ${sortDirection}`;
    
    // 计算偏移量和限制
    const offset = (page - 1) * limit;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));
    
    // 执行查询获取记录
    const [records] = await pool.execute(sql, params);
    
    // 获取总记录数
    let countSql = `SELECT COUNT(*) as total FROM poop_records WHERE user_id = ?`;
    const countParams = [userId];
    
    if (start_date) {
      countSql += ` AND time >= ?`;
      countParams.push(new Date(start_date));
    }
    
    if (end_date) {
      countSql += ` AND time <= ?`;
      countParams.push(new Date(end_date));
    }
    
    const [countResult] = await pool.execute(countSql, countParams);
    const totalCount = countResult[0].total;
    
    // 计算分页信息
    const totalPages = Math.ceil(totalCount / limit);
    
    return {
      success: true,
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    };
  } catch (error) {
    console.error('获取健康记录列表错误:', error);
    return {
      success: false,
      message: '获取健康记录列表失败'
    };
  }
};

// 获取健康记录详情
exports.getHealthRecordDetail = async (userId, recordId) => {
  try {
    const sql = `SELECT * FROM poop_records WHERE id = ? AND user_id = ?`;
    const [records] = await pool.execute(sql, [recordId, userId]);
    
    if (records.length === 0) {
      return {
        success: false,
        message: '健康记录不存在'
      };
    }
    
    return {
      success: true,
      record: records[0]
    };
  } catch (error) {
    console.error('获取健康记录详情错误:', error);
    return {
      success: false,
      message: '获取健康记录详情失败'
    };
  }
};

// 添加健康记录
exports.addHealthRecord = async (userId, recordData) => {
  try {
    // 数据映射和转换
    const mappedData = mapHealthRecordData(userId, recordData);
    
    // 确保所有必要的字段都有值，避免undefined
    const user_id = mappedData.user_id;
    const time = mappedData.time || new Date();
    const type_index = mappedData.type_index !== undefined ? mappedData.type_index : 4;
    const duration = mappedData.duration || '5-10分钟';
    const mood_index = mappedData.mood_index !== undefined ? mappedData.mood_index : 2;
    const symptoms = mappedData.symptoms || [];
    const other_symptom = mappedData.other_symptom !== undefined ? mappedData.other_symptom : null;
    const note = mappedData.note !== undefined ? mappedData.note : null;
    const habits = mappedData.habits || [];
    const created_at = mappedData.created_at || new Date();
    
    // 构建插入查询
    const sql = `
      INSERT INTO poop_records (
        user_id, time, type_index, duration, mood_index, symptoms, 
        other_symptom, note, habits, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;
    
    const params = [
      user_id,
      time,
      type_index,
      duration,
      mood_index,
      JSON.stringify(symptoms),
      other_symptom,
      note,
      JSON.stringify(habits),
      created_at
    ];
    
    // 执行插入
    const [result] = await pool.execute(sql, params);
    
    // 获取插入后的记录
    const [newRecord] = await pool.execute(
      `SELECT * FROM poop_records WHERE id = ?`, 
      [result.insertId]
    );
    
    return {
      success: true,
      record: newRecord[0]
    };
  } catch (error) {
    console.error('添加健康记录错误:', error);
    console.error('SQL参数:', JSON.stringify({
      user_id: mappedData.user_id,
      time: mappedData.time,
      type_index: mappedData.type_index,
      duration: mappedData.duration,
      mood_index: mappedData.mood_index,
      symptoms: mappedData.symptoms,
      other_symptom: mappedData.other_symptom,
      note: mappedData.note,
      habits: mappedData.habits,
      created_at: mappedData.created_at
    }));
    return {
      success: false,
      message: '添加健康记录失败',
      error: error.message
    };
  }
};

// 更新健康记录
exports.updateHealthRecord = async (userId, recordId, recordData) => {
  try {
    // 先检查记录是否存在且属于当前用户
    const checkSql = `SELECT * FROM poop_records WHERE id = ? AND user_id = ?`;
    const [existingRecords] = await pool.execute(checkSql, [recordId, userId]);
    
    if (existingRecords.length === 0) {
      return {
        success: false,
        message: '健康记录不存在或无权修改'
      };
    }
    
    // 不允许更新用户ID
    delete recordData.user_id;
    
    // 数据映射和转换
    const existingRecord = existingRecords[0];
    const mappedData = mapHealthRecordData(userId, recordData, existingRecord);
    
    // 构建更新查询
    const sql = `
      UPDATE poop_records SET
        time = ?,
        type_index = ?,
        duration = ?,
        mood_index = ?,
        symptoms = ?,
        other_symptom = ?,
        note = ?,
        habits = ?
      WHERE id = ? AND user_id = ?
    `;
    
    const params = [
      mappedData.time || existingRecord.time,
      mappedData.type_index !== undefined ? mappedData.type_index : existingRecord.type_index,
      mappedData.duration || existingRecord.duration,
      mappedData.mood_index !== undefined ? mappedData.mood_index : existingRecord.mood_index,
      mappedData.symptoms !== undefined ? JSON.stringify(mappedData.symptoms) : existingRecord.symptoms,
      mappedData.other_symptom !== undefined ? mappedData.other_symptom : existingRecord.other_symptom,
      mappedData.note !== undefined ? mappedData.note : existingRecord.note,
      mappedData.habits !== undefined ? JSON.stringify(mappedData.habits) : existingRecord.habits,
      recordId,
      userId
    ];
    
    // 执行更新
    await pool.execute(sql, params);
    
    // 获取更新后的记录
    const [updatedRecords] = await pool.execute(checkSql, [recordId, userId]);
    
    return {
      success: true,
      record: updatedRecords[0]
    };
  } catch (error) {
    console.error('更新健康记录错误:', error);
    return {
      success: false,
      message: '更新健康记录失败',
      error: error.message
    };
  }
};

// 删除健康记录
exports.deleteHealthRecord = async (userId, recordId) => {
  try {
    // 检查记录是否存在且属于当前用户
    const checkSql = `SELECT * FROM poop_records WHERE id = ? AND user_id = ?`;
    const [existingRecords] = await pool.execute(checkSql, [recordId, userId]);
    
    if (existingRecords.length === 0) {
      return {
        success: false,
        message: '健康记录不存在或无权删除'
      };
    }
    
    // 执行删除
    const deleteSql = `DELETE FROM poop_records WHERE id = ? AND user_id = ?`;
    await pool.execute(deleteSql, [recordId, userId]);
    
    return {
      success: true,
      message: '健康记录删除成功'
    };
  } catch (error) {
    console.error('删除健康记录错误:', error);
    return {
      success: false,
      message: '删除健康记录失败',
      error: error.message
    };
  }
};

// 获取健康记录统计
exports.getHealthRecordStatistics = async (userId, period = 'week') => {
  try {
    // 计算时间范围
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
    }
    
    // 查询记录
    const sql = `SELECT * FROM poop_records WHERE user_id = ? AND time >= ?`;
    const [records] = await pool.execute(sql, [userId, startDate]);
    
    // 统计分析
    const statistics = {
      total_records: records.length,
      type_index_distribution: {},
      mood_index_distribution: {},
      symptoms_count: {},
      daily_records: []
    };
    
    // 按类型分组统计
    records.forEach(record => {
      // 统计排便类型分布
      if (record.type_index !== undefined) {
        statistics.type_index_distribution[record.type_index] = 
          (statistics.type_index_distribution[record.type_index] || 0) + 1;
      }
      
      // 统计排便感受分布
      if (record.mood_index !== undefined) {
        statistics.mood_index_distribution[record.mood_index] = 
          (statistics.mood_index_distribution[record.mood_index] || 0) + 1;
      }
      
      // 统计症状频率
      if (record.symptoms) {
        try {
          const symptoms = JSON.parse(record.symptoms);
          if (Array.isArray(symptoms)) {
            symptoms.forEach(symptom => {
              statistics.symptoms_count[symptom] = 
                (statistics.symptoms_count[symptom] || 0) + 1;
            });
          }
        } catch (e) {
          console.error('解析症状数据失败:', e);
        }
      }
    });
    
    return {
      success: true,
      statistics
    };
  } catch (error) {
    console.error('获取健康记录统计错误:', error);
    return {
      success: false,
      message: '获取健康记录统计失败',
      error: error.message
    };
  }
};
