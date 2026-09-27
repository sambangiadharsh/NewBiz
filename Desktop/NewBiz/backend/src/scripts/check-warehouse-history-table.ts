import { prisma } from '../database/prisma.js';

async function check() {
  const result = await prisma.$queryRawUnsafe<any[]>(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME = 'WarehouseStatusHistory'
  `);
  console.log('WarehouseStatusHistory exists:', result.length > 0);
  await prisma.$disconnect();
}

check().catch(console.error);
