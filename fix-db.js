
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Checking database connection...');
  
  try {
    // 尝试直接查询数据库来验证列是否存在
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'story_states' 
      AND column_name = 'emotionalArcSummaries'
    `;
    
    console.log('Query result:', result);
    
    if (result.length === 0) {
      console.log('Column not found, adding it...');
      // 尝试添加列
      try {
        await prisma.$executeRaw`ALTER TABLE "story_states" ADD COLUMN "emotionalArcSummaries" JSON DEFAULT '[]'`;
        console.log('Column added successfully!');
      } catch (addError) {
        if (addError.message.includes('already exists')) {
          console.log('Column already exists (error message confirms)');
        } else {
          throw addError;
        }
      }
    } else {
      console.log('Column already exists!');
    }
    
    // 再次验证
    const result2 = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'story_states' 
      AND column_name = 'emotionalArcSummaries'
    `;
    
    console.log('Final verification:', result2);
    
    if (result2.length > 0) {
      console.log('✅ Database fix successful!');
    } else {
      console.log('❌ Database fix failed - column still not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
