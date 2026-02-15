FROM node:20-slim

# Pandoc 설치
RUN apt-get update && \
    apt-get install -y --no-install-recommends wget && \
    wget -qO /tmp/pandoc.deb https://github.com/jgm/pandoc/releases/download/3.6.4/pandoc-3.6.4-1-amd64.deb && \
    dpkg -i /tmp/pandoc.deb && \
    rm /tmp/pandoc.deb && \
    apt-get purge -y wget && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성 먼저 (캐시 활용)
COPY package*.json ./
RUN npm install --production

# 소스 복사
COPY . .

# data, storage 볼륨 선언 — 재배포해도 보존됨
VOLUME ["/app/data", "/app/storage"]

EXPOSE 3500

CMD ["node", "server.js"]
