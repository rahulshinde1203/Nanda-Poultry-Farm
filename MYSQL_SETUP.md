# MySQL Terminal Setup — Nanda Poultry Farm

---

## ─── How It Works ─────────────────────────────────────────────

Next.js uses `.env.local` for secrets, but Prisma CLI only reads `.env`.

This project solves it automatically: every `npm run db:*` command runs
`scripts/copy-env.js` first, which copies `.env.local` → `.env` so
Prisma always finds `DATABASE_URL`.

**Rule: always use `npm run db:push` — never `npx prisma db push` directly.**

---

## ─── OPTION A: One-Command Auto Setup ────────────────────────

```bash
bash setup-mysql.sh
```

Prompts for MySQL credentials, creates the DB, writes `.env.local`,
installs packages, pushes the schema, and seeds demo data — all in one go.

---

## ─── OPTION B: Manual Step-by-Step ──────────────────────────

### Step 1 — Install MySQL

**Ubuntu / Debian**
```bash
sudo apt update && sudo apt install -y mysql-server
sudo systemctl start mysql && sudo systemctl enable mysql
```

**macOS (Homebrew)**
```bash
brew install mysql
brew services start mysql
```

**Windows** → https://dev.mysql.com/downloads/installer/

---

### Step 2 — Secure MySQL & Set Root Password

```bash
sudo mysql_secure_installation
```

Or directly:
```bash
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'YourPassword';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

---

### Step 3 — Create the Database

```bash
mysql -u root -p -e "CREATE DATABASE nanda_poultry CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

---

### Step 4 — Create `.env.local`

```bash
cp .env.example .env.local
nano .env.local        # or: vim / code / notepad
```

Set your connection string:
```
DATABASE_URL="mysql://root:YourPassword@localhost:3306/nanda_poultry"
NEXTAUTH_SECRET="any-random-32-char-string"
NEXTAUTH_URL="http://localhost:3000"
```

---

### Step 5, 6, 7 — Install, Push Schema, Seed

Run these **three commands in order**:

```bash
npm install
npm run db:push
npm run seed
```

That's it. Then start the app:

```bash
npm run dev
```

Open **http://localhost:3000**

---

## ─── Demo Login Accounts ─────────────────────────────────────

| Role | Email | Password |
|---|---|---|
| Admin | admin@nanda.com | Admin@123 |
| Salesperson | sales@nanda.com | Sales@123 |
| Accountant | accounts@nanda.com | Accounts@123 |

---

## ─── npm Scripts Reference ───────────────────────────────────

| Command | What it does |
|---|---|
| `npm install` | Install all packages + generate Prisma client |
| `npm run db:push` | Create/sync all MySQL tables from schema |
| `npm run db:migrate` | Create a named migration file |
| `npm run db:studio` | Open Prisma visual DB browser (localhost:5555) |
| `npm run db:reset` | Drop and recreate all tables (⚠️ deletes all data) |
| `npm run seed` | Insert demo users + expense types |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |

---

## ─── Troubleshooting ─────────────────────────────────────────

**`Error: Environment variable not found: DATABASE_URL`**

You ran `npx prisma db push` directly. Use `npm run db:push` instead:
```bash
npm run db:push    ✅ reads .env.local automatically
npx prisma db push ❌ doesn't read .env.local
```

---

**`The table 'users' does not exist`**

Schema was never pushed. Run:
```bash
npm run db:push
```

---

**`Access denied for user 'root'@'localhost'`**
```bash
sudo mysql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'NewPassword';
FLUSH PRIVILEGES;
EXIT;
```
Then update `DATABASE_URL` in `.env.local`.

---

**`Unknown database 'nanda_poultry'`**
```bash
mysql -u root -p -e "CREATE DATABASE nanda_poultry CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

---

**`Can't connect to MySQL server`**
```bash
sudo systemctl status mysql   # Check if running
sudo systemctl start mysql    # Start it
```

---

**Special characters in password** (`@`, `#`, `!`, `$` etc.)

URL-encode them in `DATABASE_URL`:

| Char | Encoded |
|------|---------|
| `@` | `%40` |
| `#` | `%23` |
| `!` | `%21` |
| `$` | `%24` |

Example for password `p@ss#1`:
```
DATABASE_URL="mysql://root:p%40ss%231@localhost:3306/nanda_poultry"
```

---

## ─── DATABASE_URL Format ─────────────────────────────────────

```
mysql://USER:PASSWORD@HOST:PORT/DATABASE
```

| Scenario | Example |
|---|---|
| Local, no password | `mysql://root:@localhost:3306/nanda_poultry` |
| Local with password | `mysql://root:secret@localhost:3306/nanda_poultry` |
| Remote server | `mysql://admin:pass@db.myserver.com:3306/nanda_poultry` |
| AWS RDS | `mysql://admin:pass@xx.rds.amazonaws.com:3306/nanda_poultry` |

