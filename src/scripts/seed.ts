import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('\n❌ DATABASE_URL not found!');
  console.error('   Make sure .env.local exists with DATABASE_URL\n');
  process.exit(1);
}

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🔗 Connecting to MySQL...\n');

  // ── Users with loginId ──
  const users = [
    { loginId: 'ADM001', name: 'Admin',          email: 'admin@nanda.com',    password: 'Admin@123',    role: 'admin'       as const },
    { loginId: 'SLS001', name: 'Ravi Sales',     email: 'sales@nanda.com',    password: 'Sales@123',    role: 'salesperson' as const },
    { loginId: 'ACC001', name: 'Priya Accounts', email: 'accounts@nanda.com', password: 'Accounts@123', role: 'accountant'  as const },
  ];

  let adminId = 1;
  for (const u of users) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: u.email }, { loginId: u.loginId }] },
    });
    if (!existing) {
      const hash = await bcrypt.hash(u.password, 12);
      const created = await prisma.user.create({
        data: {
          loginId: u.loginId,
          name: u.name,
          email: u.email,
          password: hash,
          role: u.role,
          mobile:        u.role === 'admin' ? '9000000001' : u.role === 'salesperson' ? '9000000002' : '9000000003',
          aadhaarNumber: u.role === 'admin' ? '123456789012' : u.role === 'salesperson' ? '123456789013' : '123456789014',
          aadhaarPhoto:  'placeholder',
          panNumber:     u.role === 'admin' ? 'ABCDE1234F' : u.role === 'salesperson' ? 'BCDEF2345G' : 'CDEFG3456H',
          panPhoto:      'placeholder',
          bankName:      'SBI',
          accountNumber: u.role === 'admin' ? '10000000001' : u.role === 'salesperson' ? '10000000002' : '10000000003',
          ifscCode:      'SBIN0000001',
        },
      });
      if (u.role === 'admin') adminId = created.id;
      console.log(`✅ Created  [${u.loginId}]  ${u.email}  /  ${u.password}`);
    } else {
      // If user exists but has no loginId, patch it
      if (!existing.loginId || existing.loginId === '') {
        await prisma.user.update({ where: { id: existing.id }, data: { loginId: u.loginId } });
        console.log(`🔧 Patched loginId → ${u.loginId}  (${existing.email})`);
      } else {
        console.log(`ℹ️  Already exists: [${existing.loginId}]  ${existing.email}`);
      }
      if (u.role === 'admin') adminId = existing.id;
    }
  }

  // ── Default Expense Types ──
  const defaultTypes = ['Transport', 'Labour', 'Feed', 'Fuel', 'Electricity', 'Maintenance', 'Misc'];
  for (const name of defaultTypes) {
    const existing = await prisma.expenseType.findUnique({ where: { name } });
    if (!existing) {
      await prisma.expenseType.create({ data: { name, createdBy: adminId } });
      console.log(`✅ Expense type: ${name}`);
    }
  }

  console.log('\n🎉 Seed complete!\n');
  console.log('   ┌─────────────────────────────────────────────────┐');
  console.log('   │  Login at http://localhost:3001/login           │');
  console.log('   ├──────────┬──────────────────────────┬───────────┤');
  console.log('   │ Login ID │ Password                 │ Role      │');
  console.log('   ├──────────┼──────────────────────────┼───────────┤');
  console.log('   │ ADM001   │ Admin@123                │ Admin     │');
  console.log('   │ SLS001   │ Sales@123                │ Salespers │');
  console.log('   │ ACC001   │ Accounts@123             │ Accountant│');
  console.log('   └──────────┴──────────────────────────┴───────────┘\n');
}

seed()
  .catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
