import 'dotenv/config';
import { prisma } from './lib/prisma';

async function testConnection() {
  try {
    // Just ping the database
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // Optional: count users
    const count = await prisma.user.count();
    console.log(`Users in DB: ${count}`);

    await prisma.$disconnect();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
  }
}

testConnection();