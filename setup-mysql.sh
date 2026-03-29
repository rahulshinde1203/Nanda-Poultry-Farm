#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Nanda Poultry Farm — MySQL Setup Script
#  Run this ONCE after unzipping the project
# ═══════════════════════════════════════════════════════════════

set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║   Nanda Poultry Farm — MySQL Setup           ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Check MySQL ──────────────────────────────────────
echo -e "${BOLD}[1/7] Checking MySQL...${NC}"
if ! command -v mysql &> /dev/null; then
  echo -e "${RED}✗ mysql not found. Install it first:${NC}"
  echo "  Ubuntu:  sudo apt install mysql-server"
  echo "  macOS:   brew install mysql"
  exit 1
fi
echo -e "${GREEN}✓ $(mysql --version)${NC}"

# ── Step 2: Collect credentials ─────────────────────────────
echo ""
echo -e "${BOLD}[2/7] MySQL credentials${NC}"
read -p "  MySQL host     [localhost]: " DB_HOST; DB_HOST=${DB_HOST:-localhost}
read -p "  MySQL port     [3306]: "      DB_PORT; DB_PORT=${DB_PORT:-3306}
read -p "  MySQL username [root]: "      DB_USER; DB_USER=${DB_USER:-root}
read -s -p "  MySQL password: "           DB_PASS; echo ""
read -p "  Database name  [nanda_poultry]: " DB_NAME; DB_NAME=${DB_NAME:-nanda_poultry}

# ── Step 3: Create database ──────────────────────────────────
echo ""
echo -e "${BOLD}[3/7] Creating database '${DB_NAME}'...${NC}"
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" \
  -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
echo -e "${GREEN}✓ Database '${DB_NAME}' ready${NC}"

# ── Step 4: Write .env.local ─────────────────────────────────
echo ""
echo -e "${BOLD}[4/7] Writing .env.local...${NC}"
ENCODED_PASS=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${DB_PASS}', safe=''))" 2>/dev/null || echo "$DB_PASS")
SECRET=$(openssl rand -base64 32 2>/dev/null || echo 'nanda-poultry-secret-key-32chars!!')

cat > .env.local << ENV
# ─── MySQL Database ───────────────────────────────────────
DATABASE_URL="mysql://${DB_USER}:${ENCODED_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# ─── NextAuth ─────────────────────────────────────────────
NEXTAUTH_SECRET="${SECRET}"
NEXTAUTH_URL="http://localhost:3000"

# ─── Optional: Twilio WhatsApp ───────────────────────────
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"
ENV
echo -e "${GREEN}✓ .env.local created${NC}"
echo -e "  ${CYAN}DATABASE_URL=mysql://${DB_USER}:****@${DB_HOST}:${DB_PORT}/${DB_NAME}${NC}"

# ── Step 5: npm install ──────────────────────────────────────
echo ""
echo -e "${BOLD}[5/7] Installing Node dependencies...${NC}"
npm install 2>&1 | tail -3
echo -e "${GREEN}✓ npm install done${NC}"

# ── Step 6: Push Prisma schema ───────────────────────────────
echo ""
echo -e "${BOLD}[6/7] Pushing Prisma schema to MySQL...${NC}"
# Use dotenv-cli so prisma CLI can read .env.local
npx dotenv -e .env.local -- npx prisma db push
echo -e "${GREEN}✓ All tables created${NC}"

# ── Step 7: Seed demo data ───────────────────────────────────
echo ""
echo -e "${BOLD}[7/7] Seeding demo data...${NC}"
npm run seed
echo -e "${GREEN}✓ Seed complete${NC}"

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║   ✅  Setup Complete!                         ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Start the app:  ${CYAN}npm run dev${NC}"
echo -e "  Open browser:   ${CYAN}http://localhost:3000${NC}"
echo ""
echo "  Demo Login Accounts:"
echo "  ┌──────────────────────────────────────────────┐"
echo "  │  admin@nanda.com      →  Admin@123          │"
echo "  │  sales@nanda.com      →  Sales@123          │"
echo "  │  accounts@nanda.com   →  Accounts@123       │"
echo "  └──────────────────────────────────────────────┘"
echo ""
