const Notification = require('../models/Notification');
const AppError = require('../utils/appError');
const moment = require('moment');
const { pool } = require('../config/database');

class NotificationController {
  // 1. 获取用户通知列表（分页）
  async getUserNotifications(userId, page = 1, limit = 20, type = null) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'user_id = ?';
      const params = [userId];
      
      if (type) {
        whereClause += ' AND type = ?';
        params.push(type);
      }
      
      // 查询总数
      const countSql = `SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}`;
      const [countResult] = await pool.execute(countSql, [...params]);
      const total = countResult[0].count;
      
      // 查询记录
      const rowsSql = `
        SELECT * FROM notifications 
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await pool.execute(rowsSql, [...params, limit, offset]);
      
      return {
        total: total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        data: rows.map(notification => ({
          notification_id: notification.notification_id,
          title: notification.title,
          content: notification.content,
          type: notification.type,
          type_name: this.getTypeName(notification.type),
          related_id: notification.related_id,
          is_read: notification.is_read,
          read_at: notification.read_at ? moment(notification.read_at).format('YYYY-MM-DD HH:mm:ss') : null,
          created_at: moment(notification.created_at).format('YYYY-MM-DD HH:mm:ss'),
          time_ago: this.getTimeAgo(notification.created_at)
        }))
      };
    } catch (error) {
      throw new AppError('获取通知列表失败', 500, { error: error.message });
    }
  }

  // 2. 获取未读通知数量
  async getUnreadCount(userId) {
    try {
      const count = await Notification.getUnreadCount(userId);
      return count;
    } catch (error) {
      throw new AppError('获取未读通知数量失败', 500, { error: error.message });
    }
  }

  // 3. 标记单个通知为已读
  async markAsRead(userId, notificationId) {
    try {
      // 先检查通知是否存在
      const notification = await Notification.findByPk(notificationId);
      
      if (!notification || notification.user_id !== userId) {
        throw new AppError('通知不存在', 404);
      }
      
      if (notification.is_read) {
        return {
          success: true,
          message: '通知已经是已读状态',
          notification_id: notificationId
        };
      }
      
      const updated = await Notification.markAsRead(userId, notificationId);
      
      if (updated) {
        return {
          success: true,
          message: '通知已标记为已读',
          notification_id: notificationId,
          read_at: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      } else {
        throw new AppError('标记通知为已读失败', 500);
      }
    } catch (error) {
      if (error.statusCode === 404) {
        throw error;
      }
      throw new AppError('标记通知为已读失败', 500, { error: error.message });
    }
  }

  // 4. 批量标记通知为已读
  async markMultipleAsRead(userId, notificationIds) {
    try {
      const result = await Notification.markMultipleAsRead(userId, notificationIds);
      
      return {
        success: true,
        updated_count: result.updated_count,
        message: `成功将 ${result.updated_count} 条通知标记为已读`
      };
    } catch (error) {
      throw new AppError('批量标记通知为已读失败', 500, { error: error.message });
    }
  }

  // 5. 标记所有通知为已读
  async markAllAsRead(userId) {
    try {
      const now = new Date();
      const sql = `
        UPDATE notifications 
        SET is_read = true, read_at = ?, updated_at = ?
        WHERE user_id = ? AND is_read = false
      `;
      const [result] = await pool.execute(sql, [now, now, userId]);
      
      return {
        success: true,
        updated_count: result.affectedRows,
        message: `成功将 ${result.affectedRows} 条未读通知标记为已读`
      };
    } catch (error) {
      throw new AppError('标记所有通知为已读失败', 500, { error: error.message });
    }
  }

  // 6. 删除单个通知
  async deleteNotification(userId, notificationId) {
    try {
      const sql = `
        DELETE FROM notifications 
        WHERE notification_id = ? AND user_id = ?
      `;
      const [result] = await pool.execute(sql, [notificationId, userId]);
      
      if (result.affectedRows === 0) {
        throw new AppError('通知不存在或无权删除', 404);
      }
      
      return {
        success: true,
        message: '通知已成功删除',
        deleted_count: result.affectedRows
      };
    } catch (error) {
      if (error.statusCode === 404) {
        throw error;
      }
      throw new AppError('删除通知失败', 500, { error: error.message });
    }
  }

  // 7. 批量删除通知
  async deleteMultipleNotifications(userId, notificationIds) {
    try {
      if (!notificationIds || notificationIds.length === 0) {
        return {
          success: true,
          deleted_count: 0,
          message: '没有提供要删除的通知ID'
        };
      }
      
      const placeholders = notificationIds.map(() => '?').join(',');
      const sql = `
        DELETE FROM notifications 
        WHERE user_id = ? AND notification_id IN (${placeholders})
      `;
      const params = [userId, ...notificationIds];
      const [result] = await pool.execute(sql, params);
      
      return {
        success: true,
        deleted_count: result.affectedRows,
        message: `成功删除 ${result.affectedRows} 条通知`
      };
    } catch (error) {
      throw new AppError('批量删除通知失败', 500, { error: error.message });
    }
  }

  // 8. 清除已读通知
  async clearReadNotifications(userId) {
    try {
      const sql = `
        DELETE FROM notifications 
        WHERE user_id = ? AND is_read = true
      `;
      const [result] = await pool.execute(sql, [userId]);
      
      return {
        success: true,
        deleted_count: result.affectedRows,
        message: `成功清除 ${result.affectedRows} 条已读通知`
      };
    } catch (error) {
      throw new AppError('清除已读通知失败', 500, { error: error.message });
    }
  }

  // 9. 清除指定天数之前的通知
  async clearOldNotifications(userId, days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const sql = `
        DELETE FROM notifications 
        WHERE user_id = ? AND created_at < ?
      `;
      const [result] = await pool.execute(sql, [userId, cutoffDate]);
      
      return {
        success: true,
        deleted_count: result.affectedRows,
        message: `成功清除 ${days} 天前的 ${result.affectedRows} 条通知`
      };
    } catch (error) {
      throw new AppError('清除旧通知失败', 500, { error: error.message });
    }
  }

  // 10. 创建测试通知（仅用于开发测试）
  async createTestNotification(userId) {
    try {
      const notification = await Notification.create({
        user_id: userId,
        title: '测试通知',
        content: '这是一条测试通知，用于测试通知功能是否正常工作。时间：' + moment().format('YYYY-MM-DD HH:mm:ss'),
        type: 'system',
        is_read: false,
        params: {
          test: true,
          timestamp: Date.now()
        }
      });
      
      return Notification.getSummary(notification);
    } catch (error) {
      throw new AppError('创建测试通知失败', 500, { error: error.message });
    }
  }

  // 11. 创建健康提醒通知
  async createHealthReminder(userId, healthData) {
    try {
      const title = '健康提醒';
      let content = '';
      
      if (healthData.health_level === 'poor' || healthData.health_level === 'bad') {
        content = `您最近的肠道健康状况不太理想，健康评分为 ${healthData.score} 分。建议您注意饮食，保持规律作息，如有不适请及时就医。`;
      } else if (healthData.trend === 'declining') {
        content = `注意到您的肠道健康评分有所下降，建议您关注饮食结构，增加膳食纤维摄入，保持充足水分。`;
      } else if (healthData.days_without_record > 3) {
        content = `您已经 ${healthData.days_without_record} 天没有记录肠道健康数据了，为了更好地了解您的健康状况，请记得及时记录。`;
      }
      
      if (content) {
        const notification = await Notification.create({
          user_id: userId,
          title,
          content,
          type: 'health',
          related_id: healthData.record_id || null,
          is_read: false,
          params: healthData
        });
        
        return notification;
      }
      
      return null;
    } catch (error) {
      console.error('创建健康提醒通知失败:', error);
      return null;
    }
  }

  // 辅助方法：获取通知类型名称
  getTypeName(type) {
    const typeNames = {
      system: '系统通知',
      health: '健康提醒',
      reminder: '定时提醒',
      achievement: '成就通知',
      message: '消息通知'
    };
    return typeNames[type] || type;
  }

  // 辅助方法：获取时间差描述
  getTimeAgo(date) {
    const now = moment();
    const notificationDate = moment(date);
    const diffInMinutes = now.diff(notificationDate, 'minutes');
    
    if (diffInMinutes < 1) {
      return '刚刚';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}分钟前`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}小时前`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      if (days < 7) {
        return `${days}天前`;
      } else {
        return notificationDate.format('MM-DD');
      }
    }
  }
}

module.exports = new NotificationController();