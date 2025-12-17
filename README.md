
1. HTML结构
  头部区域 (header) - 标题和副标题
  用户控制区 - 用户ID输入和时间选择
  统计卡片区 - 4个关键统计数据展示
  图表区域 - 5个不同类型的图表容器

2. CSS样式设计
/* 主要样式特性 */
  使用Bootstrap 5进行响应式布局
  自定义卡片阴影和圆角
  图表容器统一风格
  移动端适配设计
  统计卡片特殊样式
  

3. JavaScript核心逻辑
3.1 数据加载函数 loadData()
// 主要流程：
   获取用户ID和时间范围
   异步请求5个API端点数据
   分别渲染5个图表
   更新统计卡片
   错误处理机制
3.2 图表渲染函数
// 五个图表渲染函数：
   renderHealthScoreChart() - 健康评分趋势图
   renderColorDistributionChart() - 颜色分布图
   renderShapeDistributionChart() - 形状分布图
   renderFeelingDistributionChart() - 感觉分布图
   renderAbnormalStatsChart() - 异常统计图
// 共同特点：
  使用Chart.js库
  支持图表实例复用（先销毁旧实例）
  响应式设计
  自定义颜色和标签
 3.3辅助函数
 //1. getToken() - 模拟JWT令牌生成
 //    用途：API请求认证
 //    注意：生产环境应由后端生成真实令牌
 // renderStatsCards() - 更新统计卡片显示
 // 用途：显示关键统计数据


4. 数据映射配置
// 颜色映射 - 颜色名称到十六进制值
const colorMap = {
    'yellow': '#FFC107',
    'brown': '#795548',
    // ... 其他颜色
};
// 形状映射 - 类型代码到中文描述
const shapeMap = {
    'type_1': '类型1',
    // ... 其他类型
};
// 感觉映射 - 感觉代码到中文描述
const feelingMap = {
    'smooth': '顺畅',
    // ... 其他感觉
};

5. API接口规范
5.1 请求格式
// 所有API请求都需要认证头
headers: {
    'Authorization': `Bearer ${token}`
}
// 健康评分趋势API支持时间参数
/api/statistics/health-score/trend?days=30
5.2 响应数据格式
// 趋势数据格式
{
    "data": {
        "trend": [
            {"date": "2024-01-01", "score": 85},
            {"date": "2024-01-02", "score": 88}
        ]
    }
}
// 分布数据格式
{
    "data": {
        "color_distribution": {
            "yellow": {"count": 10},
            "brown": {"count": 20}
        }
    }
}
// 总体统计格式
{
    "data": {
        "average_health_score": 86.5,
        "total_records": 42,
        "most_common_color": "brown",
        "most_common_shape": "type_4",
        "abnormal_stats": {
            "blood": 2,
            "mucus": 1
        }
    }
}