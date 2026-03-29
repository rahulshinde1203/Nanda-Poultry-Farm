// Fix duplicate empty loginId values BEFORE running npm run db:push
// Usage: node scripts/fix-loginids.js

const fs = require('fs');
const path = require('path');

const envLocal = path.join(process.cwd(), '.env.local');
const envFile  = path.join(process.cwd(), '.env');
if (fs.existsSync(envLocal)) require('dotenv').config({ path: envLocal });
else if (fs.existsSync(envFile)) require('dotenv').config({ path: envFile });

const mysql = require('mysql2/promise');

async function fixLoginIds() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('❌ DATABASE_URL not found'); process.exit(1); }

  console.log('🔍 Parsing DATABASE_URL...');

  // Use URL parser instead of regex - handles special chars in passwords
  let parsed;
  try {
    // mysql://user:pass@host:port/dbname
    const urlObj = new URL(url);
    parsed = {
      user:     decodeURIComponent(urlObj.username),
      password: decodeURIComponent(urlObj.password),
      host:     urlObj.hostname,
      port:     parseInt(urlObj.port) || 3306,
      database: urlObj.pathname.replace(/^\//, ''),
    };
  } catch (e) {
    console.error('❌ Could not parse DATABASE_URL:', e.message);
    console.error('   Expected format: mysql://user:password@host:3306/dbname');
    process.exit(1);
  }

  console.log(`\n🔗 Connecting to: ${parsed.host}:${parsed.port}/${parsed.database}\n`);

  const conn = await mysql.createConnection({
    host:     parsed.host,
    port:     parsed.port,
    user:     parsed.user,
    password: parsed.password,
    database: parsed.database,
  });

  const [users] = await conn.execute('SELECT id, email, role FROM users ORDER BY id ASC');
  console.log(`📋 Found ${users.length} users\n`);

  const counters = { admin: 0, salesperson: 0, accountant: 0 };
  const prefixes  = { admin: 'ADM', salesperson: 'SLS', accountant: 'ACC' };

  for (const u of users) {
    const role = u.role || 'salesperson';
    counters[role] = (counters[role] || 0) + 1;
    const loginId = `${prefixes[role] || 'USR'}${String(counters[role]).padStart(3, '0')}`;
    await conn.execute('UPDATE users SET loginId = ? WHERE id = ?', [loginId, u.id]);
    console.log(`  ✅ ${u.email}  (${role})  →  loginId = ${loginId}`);
  }

  await conn.end();
  console.log('\n✅ Done! Now run:\n');
  console.log('   npm run db:push');
  console.log('   npm run seed');
  console.log('   npm run dev\n');
  console.log('   Login credentials:');
  console.log('   ADM001  /  Admin@123');
  console.log('   SLS001  /  Sales@123');
  console.log('   ACC001  /  Accounts@123\n');
}

fixLoginIds().catch(e => {
  console.error('\n❌', e.message);
  if (e.message.includes("Cannot find module 'mysql2'")) {
    console.error('\n   Run first: npm install mysql2\n');
  }
  process.exit(1);
});
