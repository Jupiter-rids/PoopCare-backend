// 健康记录模型 - 简化版，移除Sequelize依赖

// 计算健康评分的函数
exports.calculateHealthScore = (recordData) => {
  let score = 100;
  
  // 基于布里斯托大便分类法评分
  const shapeScores = {
    'type_1': 40, // 非常硬，严重便秘
    'type_2': 60, // 硬，轻度便秘
    'type_3': 90, // 正常
    'type_4': 100, // 正常
    'type_5': 90, // 正常
    'type_6': 60, // 软，轻度腹泻
    'type_7': 40  // 水样，严重腹泻
  };
  
  // 基于颜色评分
  const colorScores = {
    'yellow': 70,
    'brown': 100,  // 最理想
    'dark_brown': 90,
    'green': 70,
    'black': 50,   // 可能有问题
    'red': 30,     // 可能带血
    'white': 40,   // 可能有问题
    'other': 60
  };
  
  // 基于排便感觉评分
  const feelingScores = {
    'smooth': 100,
    'normal': 90,
    'difficult': 60,
    'painful': 30
  };
  
  // 应用各方面评分
  score = Math.min(100, Math.max(0,
    (shapeScores[recordData.shape] || 0) * 0.4 +
    (colorScores[recordData.color] || 0) * 0.3 +
    (feelingScores[recordData.feeling] || 0) * 0.2 +
    (recordData.has_blood ? 0 : 100) * 0.1 // 有血直接扣10分
  ));
  
  // 特殊情况扣分
  if (recordData.has_pus) score -= 20;
  if (recordData.frequency > 3) score -= (recordData.frequency - 3) * 5; // 次数过多扣分
  if (recordData.frequency < 1) score -= 10; // 次数过少扣分
  
  // 确保分数在0-100范围内
  return Math.round(Math.min(100, Math.max(0, score)));
};

// 数据映射常量
exports.shapeMap = ['type_1', 'type_2', 'type_3', 'type_4', 'type_5', 'type_6', 'type_7'];
exports.feelingMap = ['smooth', 'normal', 'difficult', 'painful'];
exports.colorMap = ['yellow', 'brown', 'dark_brown', 'green', 'black', 'red', 'white', 'other'];
exports.odorIntensityMap = ['mild', 'moderate', 'strong', 'very_strong'];
exports.hardnessMap = ['very_soft', 'soft', 'normal', 'hard', 'very_hard'];

exports.defaultValues = {
  color: 'brown',
  shape: 'type_4',
  feeling: 'normal',
  frequency: 1,
  has_blood: false,
  has_mucus: false,
  has_pus: false,
  odor_intensity: 'moderate',
  visibility: 'self'
};
