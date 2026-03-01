import 'dotenv/config';
import { prisma } from './lib/prisma';

export async function testConnection() {
  try {
    await prisma.$connect();
    console.log('Database connection successful');

    const count = await prisma.user.count();
    console.log(`Users in DB: ${count}`);

    await prisma.$disconnect();
  } catch (err) {
    console.error('Database connection failed:', err);
  }
}

testConnection();