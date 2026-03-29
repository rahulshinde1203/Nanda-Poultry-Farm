const fs = require('fs');
const path = require('path');

const envLocal = path.resolve(process.cwd(), '.env.local');
const envFile  = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocal)) {
  fs.copyFileSync(envLocal, envFile);
  console.log('✔ Copied .env.local → .env (for Prisma CLI)');
} else if (!fs.existsSync(envFile)) {
  console.error('❌  Neither .env.local nor .env found!');
  console.error('    Create .env.local with your DATABASE_URL first.');
  console.error('    See MYSQL_SETUP.md for instructions.');
  process.exit(1);
}
