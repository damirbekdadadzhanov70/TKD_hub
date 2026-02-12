#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

PIDS=()

cleanup() {
  echo -e "\n${CYAN}Stopping all services...${NC}"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  echo -e "${GREEN}All services stopped.${NC}"
}

trap cleanup EXIT INT TERM

echo -e "${CYAN}━━━ KukkiDo ━━━${NC}\n"

# 1. Check .env
if [ ! -f .env ]; then
  echo -e "${RED}.env file not found. Copy .env.example and configure it.${NC}"
  exit 1
fi

# 2. Apply migrations
echo -e "${CYAN}[1/4] Applying database migrations...${NC}"
alembic upgrade head
echo -e "${GREEN}      Migrations applied.${NC}\n"

# 3. Build webapp
echo -e "${CYAN}[2/4] Building webapp...${NC}"
(cd webapp && npm run build)
echo -e "${GREEN}      Webapp built → webapp/dist/${NC}\n"

# 4. Start API (serves both API + webapp/dist)
echo -e "${CYAN}[3/4] Starting API server (port 8000)...${NC}"
uvicorn api.main:app --reload --port 8000 &
PIDS+=($!)
echo -e "${GREEN}      API + webapp on http://localhost:8000${NC}\n"

# Wait a moment for server to initialize
sleep 2

# 5. Start bot (foreground — Ctrl+C stops everything)
echo -e "${CYAN}[4/4] Starting Telegram bot...${NC}"
echo -e "${GREEN}      All services running. Press Ctrl+C to stop.${NC}"
echo -e "${GREEN}      Use 'ngrok http 8000' in another terminal for Telegram Mini App.${NC}\n"
python3 -m bot.main
