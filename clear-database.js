const { pool } = require('./config/database');
const readline = require('readline');
const { argv } = require('process');

// 创建命令行交互界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 解析命令行参数
const args = argv.slice(2);
const isNonInteractive = args.includes('--non-interactive');
const clearAll = args.includes('--all');
const tableArgs = args.filter(arg => arg.startsWith('--table='))
  .map(arg => arg.split('=')[1])
  .flatMap(arg => arg.split(','));

// 检查是否有有效参数
const hasValidParams = isNonInteractive && (clearAll || tableArgs.length > 0);

// 要清空数据的表列表（根据实际数据库表调整）
const TABLES_TO_CLEAR = [
  'poop_records',
  'drink_records',
  'feedbacks',
  'users'
];

async function getTableDataCounts() {
  try {
    const counts = [];
    for (const table of TABLES_TO_CLEAR) {
      const [rows] = await pool.execute(`SELECT COUNT(*) as count FROM ${table}`);
      counts.push({
        table,
        count: rows[0].count
      });
    }
    return counts;
  } catch (error) {
    console.error('获取表数据量失败:', error);
    return [];
  }
}

async function clearTableData(tableName) {
  try {
    // 检查是否有外键约束错误，如果有则暂时禁用外键约束
    await pool.execute(`SET FOREIGN_KEY_CHECKS = 0`);
    await pool.execute(`TRUNCATE TABLE ${tableName}`);
    await pool.execute(`SET FOREIGN_KEY_CHECKS = 1`);
    console.log(`✓ 成功清空表 ${tableName} 的数据`);
    return true;
  } catch (error) {
    // 如果TRUNCATE失败，尝试使用DELETE FROM
    try {
      await pool.execute(`SET FOREIGN_KEY_CHECKS = 0`);
      await pool.execute(`DELETE FROM ${tableName}`);
      await pool.execute(`SET FOREIGN_KEY_CHECKS = 1`);
      console.log(`✓ 成功使用DELETE清空表 ${tableName} 的数据`);
      return true;
    } catch (deleteError) {
      await pool.execute(`SET FOREIGN_KEY_CHECKS = 1`); // 确保重新启用外键约束
      console.error(`✗ 清空表 ${tableName} 数据失败:`, deleteError);
      return false;
    }
  }
}

async function clearAllTables() {
  console.log('\n开始清空所有表的数据...');
  let successCount = 0;
  let failCount = 0;
  
  for (const table of TABLES_TO_CLEAR) {
    const success = await clearTableData(table);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`\n清空完成: ${successCount} 个表成功, ${failCount} 个表失败`);
}

async function clearSelectedTables(selectedTables) {
  console.log('\n开始清空所选表的数据...');
  let successCount = 0;
  let failCount = 0;
  
  for (const table of selectedTables) {
    const success = await clearTableData(table);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`\n清空完成: ${successCount} 个表成功, ${failCount} 个表失败`);
}

async function main() {
  console.log('=== 数据库数据清空工具 ===\n');
  
  // 获取各表的数据量
  const tableCounts = await getTableDataCounts();
  
  if (tableCounts.length === 0) {
    console.error('无法获取表数据信息，请检查数据库连接');
    rl.close();
    await pool.end();
    return;
  }
  
  // 显示所有表和数据量
  console.log('当前数据库中的表及其数据量:');
  console.log('-' .repeat(50));
  tableCounts.forEach((item, index) => {
    console.log(`${index + 1}. ${item.table} - ${item.count} 条记录`);
  });
  console.log('-' .repeat(50));
  
  // 检查是否为非交互式模式且有有效参数
  if (hasValidParams) {
    console.log('\n⚠️  非交互式模式已启用，将直接执行清空操作');
    
    if (clearAll) {
      console.log('\n将清空所有表的数据...');
      await clearAllTables();
    } else {
      // 验证指定的表是否存在
      const validTables = tableArgs.filter(table => TABLES_TO_CLEAR.includes(table));
      const invalidTables = tableArgs.filter(table => !TABLES_TO_CLEAR.includes(table));
      
      if (invalidTables.length > 0) {
        console.log(`\n⚠️  以下表不存在或不在清空列表中: ${invalidTables.join(', ')}`);
      }
      
      if (validTables.length > 0) {
        console.log(`\n将清空以下表的数据: ${validTables.join(', ')}`);
        await clearSelectedTables(validTables);
      } else {
        console.log('\n未找到有效的表名，操作已取消');
      }
    }
    
    rl.close();
    await pool.end();
    return;
  }
  
  // 询问用户清空方式
  rl.question('\n请选择清空方式: [1] 清空所有表 [2] 选择特定表 [3] 取消操作: ', async (choice) => {
    if (choice === '1') {
      // 再次确认
      rl.question('\n⚠️  警告: 这将清空所有表的数据，操作不可恢复！\n请输入 YES 确认执行: ', async (confirm) => {
        if (confirm.toUpperCase() === 'YES') {
          await clearAllTables();
        } else {
          console.log('\n操作已取消');
        }
        rl.close();
        await pool.end();
      });
    } else if (choice === '2') {
      // 选择特定表
      const tableList = tableCounts.map((item, index) => `${index + 1}`).join(',');
      rl.question(`\n请输入要清空的表编号 (用逗号分隔，如: 1,3,5): `, async (selected) => {
        const selectedIndices = selected.split(',').map(i => parseInt(i.trim()) - 1).filter(i => !isNaN(i) && i >= 0 && i < tableCounts.length);
        
        if (selectedIndices.length === 0) {
          console.log('\n未选择有效表，操作已取消');
        } else {
          const selectedTables = selectedIndices.map(index => tableCounts[index].table);
          console.log('\n您选择清空以下表:');
          selectedTables.forEach(table => console.log(`- ${table}`));
          
          rl.question('\n请输入 YES 确认执行: ', async (confirm) => {
            if (confirm.toUpperCase() === 'YES') {
              await clearSelectedTables(selectedTables);
            } else {
              console.log('\n操作已取消');
            }
            rl.close();
            await pool.end();
          });
        }
      });
    } else {
      console.log('\n操作已取消');
      rl.close();
      await pool.end();
    }
  });
}

main();