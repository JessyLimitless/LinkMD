#!/bin/bash
# ============================================================
#  LinkMD Deploy Script (Cloud5 방식: rsync + PM2)
#
#  사용법: bash deploy.sh
#
#  data/, storage/, .env는 절대 덮어쓰지 않음
# ============================================================

set -e

# ── 설정 (환경에 맞게 수정) ──────────────────────────────
EC2_HOST="ubuntu@3.39.191.178"
SSH_KEY="$HOME/Desktop/cloud5-mvp/cloud5.pem"
REMOTE_DIR="/home/ubuntu/linkmd"
PM2_NAME="linkmd"
# ─────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}[LinkMD]${NC} 배포 시작..."

# 1. SSH 키 확인
if [ ! -f "$SSH_KEY" ]; then
  echo -e "${RED}[ERROR]${NC} SSH 키를 찾을 수 없습니다: $SSH_KEY"
  exit 1
fi

# 2. rsync로 파일 전송 (data, storage, .env, node_modules 제외)
echo -e "${YELLOW}[1/4]${NC} 파일 전송 중..."
rsync -avz --delete \
  --exclude 'data/' \
  --exclude 'storage/' \
  --exclude 'node_modules/' \
  --exclude '.env' \
  --exclude '.git/' \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
  ./ "$EC2_HOST:$REMOTE_DIR/"

# 3. 원격에서 npm install + 디렉토리 생성 + PM2 재시작
echo -e "${YELLOW}[2/4]${NC} 의존성 설치 중..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$EC2_HOST" << 'REMOTE'
  cd /home/ubuntu/linkmd

  # data, storage 디렉토리 보장 (첫 배포 시)
  mkdir -p data storage/originals storage/exports storage/templates

  # .env 없으면 경고
  if [ ! -f .env ]; then
    echo "[WARN] .env 파일이 없습니다! 서버에서 직접 생성하세요."
  fi

  # 의존성 설치
  npm install --production 2>&1 | tail -3
REMOTE

echo -e "${YELLOW}[3/4]${NC} PM2 재시작 중..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$EC2_HOST" << REMOTE
  cd /home/ubuntu/linkmd

  # PM2 프로세스 존재하면 restart, 없으면 start
  if pm2 describe $PM2_NAME > /dev/null 2>&1; then
    pm2 restart $PM2_NAME
  else
    pm2 start server.js --name $PM2_NAME
    pm2 save
  fi

  echo "--- PM2 상태 ---"
  pm2 list
REMOTE

# 4. 헬스체크
echo -e "${YELLOW}[4/4]${NC} 헬스체크..."
sleep 3
HEALTH=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$EC2_HOST" \
  "curl -s http://localhost:3500/api/health 2>/dev/null | head -1")

if echo "$HEALTH" | grep -q '"ok"'; then
  echo -e "${GREEN}[SUCCESS]${NC} 배포 완료! 서버 정상 작동 중"
else
  echo -e "${RED}[WARN]${NC} 헬스체크 실패 — PM2 로그 확인: ssh -i $SSH_KEY $EC2_HOST 'pm2 logs $PM2_NAME --lines 20'"
fi

echo -e "${GREEN}[LinkMD]${NC} 배포 끝."
