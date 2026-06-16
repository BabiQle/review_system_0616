import PocketBase from 'pocketbase';

// 配置你的 PocketBase 地址和管理员账号
const PB_URL = 'http://10.80.159.174:8091';
const ADMIN_EMAIL = 'yi.zhou@smartmore.com';   // 替换为真实超级管理员邮箱
const ADMIN_PASSWORD = '123123123';    // 替换为真实密码

const pb = new PocketBase(PB_URL);

async function generateCycles(months = 12) {
  try {
    await pb.collection('users').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('登录成功');
  } catch (err) {
    console.error('管理员登录失败，请检查账号密码:', err);
    return;
  }

  const now = new Date();
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < months; i++) {
    const startDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;
    const cycleName = `${year}年${month}月`;

    // 检查是否已存在
    let existing = null;
    try {
      existing = await pb.collection('month_cycles').getFirstListItem(`name="${cycleName}"`);
    } catch (e) {
      // 不存在，继续
    }

    if (existing) {
      console.log(`周期已存在: ${cycleName}`);
      skipped++;
      continue;
    }

    // 是否为当前月（用于活跃标志）
    const isActive = (year === now.getFullYear() && month === now.getMonth() + 1);

    try {
      await pb.collection('month_cycles').create({
        name: cycleName,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        is_active: isActive,
      });
      console.log(`✓ 创建周期: ${cycleName}`);
      created++;
    } catch (err) {
      console.error(`创建失败 ${cycleName}:`, err);
    }
  }

  console.log(`\n完成：创建 ${created} 个，跳过 ${skipped} 个`);
}

// 生成未来12个月（可修改参数）
generateCycles(12).catch(console.error);